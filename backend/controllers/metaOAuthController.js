// backend/controllers/metaOAuthController.js
// Handles WhatsApp Business connection for SaaS customers via two paths:
//
//   1. Embedded Signup (FB.login() popup) — the primary, Meta-recommended
//      path. See embeddedSignupCallback() below.
//   2. Classic OAuth redirect (/dialog/oauth) — fallback used only when
//      META_CONFIG_ID isn't configured on the server. See getOAuthUrl() /
//      oauthCallback() below.
//
// Both paths end up at finalizeConnection(), which performs the Meta
// post-signup operations (subscribe the app to the customer's WABA,
// register the phone number for Cloud API) and saves the connection
// against the currently authenticated SaaS user's Business record.

const crypto = require('crypto');
const axios = require('axios');
const Business = require('../models/Business');
const logger = require('../config/logger');
const { GRAPH_URL } = require('../config/meta');
const { buildState, verifyState } = require('../utils/metaState');
const metaGraph = require('../services/metaGraphService');

// ── Temporary server-side handoff store (multi-phone selection) ───────────
// Used when a connection attempt surfaces more than one eligible phone
// number and the customer needs to pick one. We stash the long-lived token
// + candidate phones behind a random opaque key with a short TTL, and only
// ever hand the frontend that key — never the token itself.
//
// NOTE: this is in-memory and per-process. If you run more than one backend
// instance behind a load balancer, replace this with Redis (or similar) so
// the handoff survives landing on a different instance.
const pendingConnections = new Map(); // key -> { data, expiresAt }
const PENDING_TTL_MS = 10 * 60 * 1000; // 10 minutes to complete phone selection

function stashPending(data) {
  const key = crypto.randomBytes(24).toString('hex');
  pendingConnections.set(key, { data, expiresAt: Date.now() + PENDING_TTL_MS });
  return key;
}
function peekPending(key) {
  const entry = pendingConnections.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    pendingConnections.delete(key);
    return null;
  }
  return entry.data;
}
function consumePending(key) {
  const data = peekPending(key);
  pendingConnections.delete(key);
  return data;
}
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of pendingConnections) {
    if (now > entry.expiresAt) pendingConnections.delete(key);
  }
}, 5 * 60 * 1000).unref();

const publicPhone = ({ phoneNumberId, displayNumber, verifiedName, wabaId, wabaName }) => ({
  phoneNumberId, displayNumber, verifiedName, wabaId, wabaName,
});

// ── Shared post-signup finalization ────────────────────────────────────────
// Performs the Meta operations that must happen after a customer completes
// signup, before their number can actually send/receive messages:
//   1. Confirm the phone resource itself is reachable with the exchanged
//      token (VALIDATION GATE — see below).
//   2. Subscribe this app to the customer's WABA (required for webhooks).
//   3. Register the phone number for Cloud API with a generated 2FA PIN
//      (required — a freshly-signed-up number cannot send/receive until
//      this succeeds). VERIFIED against Meta's official docs
//      (developers.facebook.com/documentation/business-messaging/whatsapp/
//      business-phone-numbers/registration, and .../solution-providers/
//      manage-phone-numbers — "After a client successfully completes the
//      Embedded Signup flow ... you must register the number for Cloud API
//      use"). Per Meta's official Manage Webhooks doc, the integrating app
//      — not Embedded Signup itself — is responsible for performing both
//      (2) and (3) server-to-server after the code exchange.
//
// (1) is a hard gate: if Meta cannot confirm the phone resource with this
// token, nothing is saved and finalizeConnection() throws — this must never
// silently continue with empty phone details (a business record with no
// verified phone identity is not a valid connection).
//
// (2) and (3) failing does NOT block saving the WABA/phone IDs and token —
// they're still valid and the customer is still the verified owner, and
// saving them lets a retry reuse the same connection rather than starting
// over. But this must NEVER be reported to the customer as a full
// "connected" state: connectionStatus reflects the real, verifiable outcome
// (see Business.js), and callers (embeddedSignupCallback / oauthCallback /
// selectPhone) must relay that status rather than assuming success.
async function finalizeConnection({ userId, wabaId, phoneNumberId, accessToken }) {
  // ── VALIDATION GATE: the phone resource must be confirmed with the
  // exchanged token before anything is persisted. This is deliberately not
  // caught-and-ignored — a failure here means we cannot prove the token
  // actually has access to this phone number, so the connection must not be
  // saved as valid at all (P0 requirement: phone details lookup is a
  // validation gate, not optional display info).
  let details;
  try {
    details = await metaGraph.getPhoneNumberDetails(phoneNumberId, accessToken);
  } catch (err) {
    const message = err.response?.data?.error?.message || err.message;
    logger.error(`Phone validation failed for ${phoneNumberId} (user ${userId}): ${message}`);
    const validationError = new Error(`Could not validate the selected WhatsApp number with Meta: ${message}`);
    validationError.code = 'PHONE_VALIDATION_FAILED';
    throw validationError;
  }
  if (!details?.displayNumber) {
    // Meta responded without throwing but didn't return a usable phone
    // identity — treat this the same as a hard failure rather than saving a
    // record with blank phone details.
    logger.error(`Phone validation returned no display number for ${phoneNumberId} (user ${userId})`);
    const validationError = new Error('Meta did not return a valid phone number for this connection.');
    validationError.code = 'PHONE_VALIDATION_FAILED';
    throw validationError;
  }

  // ── Application-level tenant-isolation check ──────────────────────────
  // Belt-and-suspenders alongside the DB-level partial unique index on
  // whatsappPhoneNumberId (see config/indexes.js): catch a cross-tenant
  // collision here with a clear, specific error message, rather than
  // relying solely on a raw duplicate-key exception from MongoDB.
  const conflictingBusiness = await Business.findOne({
    whatsappPhoneNumberId: phoneNumberId,
    owner: { $ne: userId },
  });
  if (conflictingBusiness) {
    logger.error(`Phone ${phoneNumberId} is already connected to a different business (attempted by user ${userId})`);
    const conflictError = new Error('This WhatsApp number is already connected to a different account. Disconnect it there first, or contact support.');
    conflictError.code = 'PHONE_ALREADY_CLAIMED';
    throw conflictError;
  }

  const subscribeResult = await metaGraph.subscribeAppToWaba(wabaId, accessToken);

  const pin = crypto.randomInt(100000, 999999).toString();
  const registerResult = await metaGraph.registerPhoneNumber(phoneNumberId, accessToken, pin);

  const fullyActivated = !!subscribeResult.subscribed && !!registerResult.registered;

  const update = {
    whatsappPhoneNumberId: phoneNumberId,
    whatsappBusinessAccountId: wabaId,
    whatsappAccessToken: accessToken,
    whatsappVerifyToken: process.env.WHATSAPP_VERIFY_TOKEN || 'wa_verify_token',
    whatsappDisplayNumber: details.displayNumber || '',
    whatsappVerifiedName: details.verifiedName || '',
    whatsappConnectionStatus: fullyActivated ? 'connected' : 'activation_pending',
  };
  if (registerResult.registered) {
    update.whatsappRegistrationPin = pin;
  }

  // Safety net for a race between the check above and this write (two
  // concurrent requests claiming the same number at once): the DB-level
  // partial unique index on whatsappPhoneNumberId (config/indexes.js) is
  // the actual enforcement point and will reject the loser with E11000.
  let business;
  try {
    business = await Business.findOneAndUpdate({ owner: userId }, update, { new: true });
  } catch (err) {
    if (err?.code === 11000) {
      logger.error(`Duplicate-key race on whatsappPhoneNumberId ${phoneNumberId} for user ${userId}`);
      const conflictError = new Error('This WhatsApp number is already connected to a different account. Disconnect it there first, or contact support.');
      conflictError.code = 'PHONE_ALREADY_CLAIMED';
      throw conflictError;
    }
    throw err;
  }

  const warnings = [];
  if (!subscribeResult.subscribed) {
    warnings.push(
      'We could not subscribe your account to WhatsApp webhooks automatically, so incoming messages may not arrive yet. Please contact support.'
    );
  }
  if (!registerResult.registered) {
    warnings.push(
      'We could not automatically activate this number for messaging. It may need its two-step verification PIN reset in Meta Business Manager before it can send or receive messages.'
    );
  }

  return {
    business,
    displayNumber: details.displayNumber,
    warnings,
    connected: fullyActivated,
    connectionStatus: fullyActivated ? 'connected' : 'activation_pending',
  };
}

// ══════════════════════════════════════════════════════════════════════════
// PATH 1 — EMBEDDED SIGNUP (primary path)
// ══════════════════════════════════════════════════════════════════════════
//
// The frontend launches FB.login() with config_id (see WhatsAppConnect.jsx).
// On completion, Meta gives the page two independent things:
//   - FB.login()'s own callback fires with resp.authResponse.code
//   - A `window.postMessage` event of type WA_EMBEDDED_SIGNUP carries the
//     waba_id and (usually) phone_number_id the customer just set up
// resp.authResponse never contains a usable `state` — that field is a
// `/dialog/oauth`-only concept — so this endpoint identifies the user the
// normal way: it's a protected route, called in-page while the SaaS session
// is still live, and req.user comes from the standard auth middleware. No
// state token is needed here at all.
//
// POST /api/meta/embedded-signup-callback  { code, wabaId, phoneNumberId }
exports.embeddedSignupCallback = async (req, res) => {
  const { code, wabaId, phoneNumberId } = req.body || {};

  if (!code) {
    return res.status(400).json({ success: false, message: 'Missing authorization code from Meta.' });
  }
  if (!wabaId) {
    // The WA_EMBEDDED_SIGNUP FINISH event should always include this on a
    // successful completion. If it's missing, either the customer's domain
    // isn't in the Meta app's Allowed Domains / Valid OAuth Redirect URIs
    // (required for the postMessage to be delivered at all), or the flow
    // didn't actually finish.
    return res.status(400).json({
      success: false,
      message: 'Meta did not return a WhatsApp Business Account for this connection. Please try again, or contact support if this keeps happening.',
    });
  }

  const { META_APP_ID, META_APP_SECRET } = process.env;
  if (!META_APP_ID || !META_APP_SECRET) {
    return res.status(500).json({ success: false, message: 'META_APP_ID/META_APP_SECRET is not configured on the server.' });
  }

  try {
    const shortLivedToken = await metaGraph.exchangeEmbeddedCodeForToken(code);
    const longLivedToken = await metaGraph.getLongLivedToken(shortLivedToken);

    // ── P0: server-side authorization check ─────────────────────────────
    // The browser's WA_EMBEDDED_SIGNUP message is only a hint about which
    // WABA/phone the customer picked in the popup — it is NOT authoritative.
    // We now ask Meta, using the token we just exchanged, which phone
    // numbers are actually reachable under the submitted wabaId. This one
    // call does double duty without inventing any new endpoint:
    //   - If the token has no access to wabaId at all, Meta rejects this
    //     request (permission error), closing the "unauthorized WABA" gap.
    //   - The response is the authoritative phone list under that WABA,
    //     which the submitted phoneNumberId is checked against below,
    //     closing the "unauthorized/mismatched phone" gap.
    let authorizedPhones;
    try {
      authorizedPhones = await metaGraph.getPhoneNumbersForWaba(wabaId, longLivedToken);
    } catch (err) {
      const metaError = err.response?.data?.error?.message || err.message;
      logger.warn(`Embedded Signup: token cannot access WABA ${wabaId} for user ${req.user._id}: ${metaError}`);
      return res.status(400).json({
        success: false,
        message: 'We could not verify that this WhatsApp Business Account is authorized for your Meta login. Please try again.',
      });
    }

    if (authorizedPhones.length === 0) {
      return res.status(400).json({ success: false, message: 'No eligible WhatsApp phone numbers were found on this account.' });
    }

    let targetPhone;
    if (phoneNumberId) {
      // The browser suggested a specific number — it must be one Meta
      // actually confirms belongs to this WABA/token. A mismatch (wrong ID,
      // stale data, or a tampered/replayed request) is rejected outright
      // rather than trusted.
      targetPhone = authorizedPhones.find((p) => p.phoneNumberId === phoneNumberId);
      if (!targetPhone) {
        logger.warn(`Embedded Signup: submitted phoneNumberId ${phoneNumberId} not found under WABA ${wabaId} for user ${req.user._id}`);
        return res.status(400).json({
          success: false,
          message: 'The selected WhatsApp number could not be verified against your Meta account. Please try again.',
        });
      }
    } else if (authorizedPhones.length === 1) {
      // Bypass-phone-selection configurations (featureType: only_waba_sharing)
      // return only a waba_id from the message event — safe to auto-select
      // when there's exactly one authorized number.
      targetPhone = authorizedPhones[0];
    } else {
      // Multiple eligible numbers and none pre-selected — let the customer
      // pick, but only from the server-verified list (never the raw
      // browser-supplied value).
      const key = stashPending({ userId: req.user._id, token: longLivedToken, phones: authorizedPhones });
      return res.json({ success: true, step: 'pick_phone', key, phones: authorizedPhones.map(publicPhone) });
    }

    const { business, displayNumber, warnings, connected, connectionStatus } = await finalizeConnection({
      userId: req.user._id,
      wabaId,
      phoneNumberId: targetPhone.phoneNumberId,
      accessToken: longLivedToken,
    });

    if (!business) {
      return res.status(404).json({ success: false, message: 'Business not found for this account.' });
    }

    logger.info(`WhatsApp ${connected ? 'connected' : 'saved (activation pending)'} via Embedded Signup for user ${req.user._id}: waba=${wabaId} phone=${targetPhone.phoneNumberId}`);
    // `success: true` only means the request itself completed without error —
    // `connected` / `connectionStatus` carry the real, verified outcome. Never
    // collapse these into a single "connected" flag the frontend can't tell
    // apart from a genuine full connection.
    return res.json({ success: true, connected, connectionStatus, phone: displayNumber || '', warnings });
  } catch (err) {
    const metaError = err.response?.data?.error?.message || err.message;
    logger.error(`Embedded Signup callback error for user ${req.user._id}: ${metaError}`);
    return res.status(400).json({ success: false, message: `Connection failed: ${metaError}` });
  }
};

// ══════════════════════════════════════════════════════════════════════════
// PATH 2 — CLASSIC OAUTH REDIRECT (fallback when META_CONFIG_ID is unset)
// ══════════════════════════════════════════════════════════════════════════

// Step 1: Build and return the Meta OAuth URL.
// GET /api/meta/oauth-url
exports.getOAuthUrl = (req, res) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  const { META_APP_ID, META_CONFIG_ID, BACKEND_URL } = process.env;

  if (!META_APP_ID) {
    return res.status(500).json({ success: false, message: 'META_APP_ID is not configured on the server.' });
  }

  let statePayload;
  try {
    statePayload = buildState(req.user._id);
  } catch (err) {
    logger.error(`Could not build OAuth state: ${err.message}`);
    return res.status(500).json({ success: false, message: 'Server misconfigured (JWT_SECRET missing).' });
  }

  const redirectUri = `${BACKEND_URL}/api/meta/oauth-callback`;

  const oauthParams = {
    client_id: META_APP_ID,
    redirect_uri: redirectUri,
    scope: [
      'whatsapp_business_management',
      'whatsapp_business_messaging',
      'business_management',
    ].join(','),
    response_type: 'code',
    state: statePayload,
  };

  // If META_CONFIG_ID is set, the frontend prefers the Embedded Signup path
  // above and only falls back to this URL if the FB JS SDK fails to load.
  // Still include config_id here so that fallback also gets the guided
  // Embedded Signup UI rather than a bare Facebook Login dialog.
  if (META_CONFIG_ID) {
    oauthParams.config_id = META_CONFIG_ID;
  }

  const params = new URLSearchParams(oauthParams);
  const oauthUrl = `https://www.facebook.com/dialog/oauth?${params.toString()}`;

  return res.json({ success: true, url: oauthUrl, state: statePayload });
};

// Step 2: Meta redirects back here with ?code=xxx&state=xxx
// GET /api/meta/oauth-callback
exports.oauthCallback = async (req, res) => {
  const { code, state, error, error_description } = req.query;
  const { BACKEND_URL, FRONTEND_URL } = process.env;

  if (error) {
    logger.warn(`Meta OAuth denied: ${error} — ${error_description}`);
    return res.redirect(`${FRONTEND_URL}/connect-whatsapp?error=denied`);
  }

  if (!code || !state) {
    return res.redirect(`${FRONTEND_URL}/connect-whatsapp?error=invalid_callback`);
  }

  let userId;
  try {
    userId = verifyState(state);
  } catch (err) {
    logger.warn(`Meta OAuth callback: invalid state — ${err.message}`);
    return res.redirect(`${FRONTEND_URL}/connect-whatsapp?error=invalid_state`);
  }

  try {
    const redirectUri = `${BACKEND_URL}/api/meta/oauth-callback`;
    const shortLivedToken = await metaGraph.exchangeCodeForToken({ code, redirectUri });
    const longLivedToken = await metaGraph.getLongLivedToken(shortLivedToken);

    const phoneNumbers = await metaGraph.getBusinessesAndPhoneNumbers(longLivedToken);

    if (phoneNumbers.length === 0) {
      return res.redirect(`${FRONTEND_URL}/connect-whatsapp?error=no_phone_numbers`);
    }

    if (phoneNumbers.length === 1) {
      const phone = phoneNumbers[0];
      const { displayNumber, connectionStatus } = await finalizeConnection({
        userId, wabaId: phone.wabaId, phoneNumberId: phone.phoneNumberId, accessToken: longLivedToken,
      });
      logger.info(`WhatsApp ${connectionStatus} for user ${userId}: ${displayNumber || phone.displayNumber}`);
      // `success=true` here means "no error occurred", not "fully connected" —
      // status is carried separately so the frontend shows activation_pending
      // rather than a false "Connected".
      return res.redirect(
        `${FRONTEND_URL}/connect-whatsapp?success=true&status=${connectionStatus}&phone=${encodeURIComponent(displayNumber || phone.displayNumber || '')}`
      );
    }

    // Multiple phones — stash the token + options server-side and hand the
    // frontend only an opaque key, instead of the token itself.
    const key = stashPending({ userId, token: longLivedToken, phones: phoneNumbers });
    return res.redirect(`${FRONTEND_URL}/connect-whatsapp?step=pick_phone&key=${key}`);
  } catch (err) {
    const metaError = err.response?.data?.error?.message || err.message;
    logger.error(`Meta OAuth callback error: ${metaError}`);
    // Covers token exchange, phone-validation-gate, and duplicate-phone
    // rejections alike — the human-readable reason travels in `detail`.
    return res.redirect(`${FRONTEND_URL}/connect-whatsapp?error=connection_failed&detail=${encodeURIComponent(metaError)}`);
  }
};

// ══════════════════════════════════════════════════════════════════════════
// SHARED — multi-phone selection, disconnect, token status
// ══════════════════════════════════════════════════════════════════════════

// GET /api/meta/pending-connection?key=xxx
// Returns the phone numbers found for this connection attempt, without
// ever exposing the underlying access token to the client.
exports.getPendingConnection = (req, res) => {
  const { key } = req.query;
  if (!key) return res.status(400).json({ success: false, message: 'key is required' });

  const pending = peekPending(key);
  if (!pending || String(pending.userId) !== String(req.user._id)) {
    return res.status(404).json({ success: false, message: 'This connection request has expired. Please reconnect WhatsApp.' });
  }

  res.json({ success: true, data: { phones: pending.phones.map(publicPhone) } });
};

// POST /api/meta/select-phone  { key, phoneNumberId }
// The access token is never sent by the client — it's pulled from the
// server-side stash created earlier, keyed by the opaque `key`.
exports.selectPhone = async (req, res) => {
  const { key, phoneNumberId } = req.body;

  if (!key || !phoneNumberId) {
    return res.status(400).json({ success: false, message: 'key and phoneNumberId are required' });
  }

  const pending = peekPending(key);
  if (!pending || String(pending.userId) !== String(req.user._id)) {
    return res.status(400).json({ success: false, message: 'This connection request has expired. Please reconnect WhatsApp.' });
  }

  const phone = pending.phones.find((p) => p.phoneNumberId === phoneNumberId);
  if (!phone) {
    return res.status(400).json({ success: false, message: 'Invalid phone number selection' });
  }

  try {
    const { business, displayNumber, warnings, connected, connectionStatus } = await finalizeConnection({
      userId: req.user._id,
      wabaId: phone.wabaId,
      phoneNumberId,
      accessToken: pending.token,
    });

    if (!business) {
      return res.status(404).json({ success: false, message: 'Business not found' });
    }

    consumePending(key); // one-time use — burn it once the connection attempt is finalized

    logger.info(`WhatsApp phone selected for user ${req.user._id}: ${phoneNumberId} (${connectionStatus})`);
    res.json({
      success: true,
      connected,
      connectionStatus,
      message: connected ? 'WhatsApp connected successfully' : 'WhatsApp setup is still being completed.',
      phone: displayNumber || phone.displayNumber,
      warnings,
      business,
    });
  } catch (err) {
    const metaError = err.response?.data?.error?.message || err.message;
    logger.error(`selectPhone error: ${metaError}`);
    res.status(400).json({ success: false, message: `Connection failed: ${metaError}` });
  }
};

// DELETE /api/meta/disconnect
exports.disconnect = async (req, res) => {
  try {
    await Business.findOneAndUpdate(
      { owner: req.user._id },
      {
        $unset: {
          whatsappPhoneNumberId: '',
          whatsappBusinessAccountId: '',
          whatsappAccessToken: '',
          whatsappDisplayNumber: '',
          whatsappVerifiedName: '',
          whatsappRegistrationPin: '',
        },
        whatsappConnectionStatus: 'disconnected',
      }
    );
    logger.info(`WhatsApp disconnected for user ${req.user._id}`);
    res.json({ success: true, message: 'WhatsApp disconnected' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Disconnect failed' });
  }
};

// GET /api/meta/token-status
exports.tokenStatus = async (req, res) => {
  try {
    const business = await Business.findOne({ owner: req.user._id });
    if (!business?.whatsappAccessToken || !business?.whatsappPhoneNumberId) {
      return res.json({ success: true, connected: false, connectionStatus: 'disconnected' });
    }

    const result = await axios.get(`${GRAPH_URL}/${business.whatsappPhoneNumberId}`, {
      headers: { Authorization: `Bearer ${business.whatsappAccessToken}` },
    }).catch((err) => ({ data: null, error: err.response?.data?.error }));

    const tokenValid = !!result.data?.id;
    // The stored status already reflects whether Meta's post-signup
    // activation (webhook subscription + Cloud API registration) actually
    // succeeded — a live token check alone can't tell us that, so we never
    // report "connected" on the strength of the token check by itself.
    const storedStatus = business.whatsappConnectionStatus || 'disconnected';
    const connectionStatus = !tokenValid ? 'connection_failed' : storedStatus;
    const connected = tokenValid && storedStatus === 'connected';

    res.json({
      success: true,
      connected,
      connectionStatus,
      phoneNumberId: business.whatsappPhoneNumberId,
      wabaId: business.whatsappBusinessAccountId || '',
      phone: business.whatsappDisplayNumber || '',
    });
  } catch (err) {
    res.json({ success: true, connected: false, connectionStatus: 'disconnected' });
  }
};
