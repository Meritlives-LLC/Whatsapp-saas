// backend/controllers/metaOAuthController.js
// Handles the full Meta OAuth 2.0 flow for WhatsApp Business connection

const axios = require('axios');
const crypto = require('crypto');
const Business = require('../models/Business');
const logger = require('../config/logger');

const META_API_VERSION = 'v21.0';
const GRAPH_URL = `https://graph.facebook.com/${META_API_VERSION}`;

// ── Temporary server-side handoff store ────────────────────────────────────
// Meta's redirect back to us can only carry a `code`, not our session — so we
// exchange the code for a long-lived token here, then need to hand that
// token to the frontend if the user has multiple WhatsApp numbers to pick
// from. Previously this was done by putting the token in the redirect URL
// query string, which leaks it into browser history and server access logs.
// Instead we stash it server-side behind a random opaque key with a short
// TTL, and only ever put that key in the URL.
//
// NOTE: this is in-memory and per-process. If you run more than one backend
// instance behind a load balancer, replace this with Redis (or similar)
// so the handoff survives landing on a different instance.
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

// ── State signing (prevents tampering with the userId embedded in state) ──
function signState(userId, nonce) {
  return crypto.createHmac('sha256', process.env.JWT_SECRET).update(`${userId}:${nonce}`).digest('hex');
}

// ── Step 1: Build and return the Meta OAuth URL ───────────────────────────────
// Frontend hits GET /api/meta/oauth-url?state=<jwt_user_id>
// We return the URL; frontend does window.location.href = url
exports.getOAuthUrl = (req, res) => {

  // ✅ ADD THIS FIRST (BEFORE ANYTHING ELSE)
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized'
    });
  }

  const { META_APP_ID, META_CONFIG_ID, FRONTEND_URL, BACKEND_URL } = process.env;

  if (!META_APP_ID) {
    return res.status(500).json({
      success: false,
      message: 'META_APP_ID is not configured on the server.',
    });
  }

  const nonce = crypto.randomBytes(16).toString('hex');
  const sig = signState(req.user._id, nonce);
  const statePayload = Buffer.from(`${req.user._id}:${nonce}:${sig}`).toString('base64url');

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

  // If META_CONFIG_ID is set, use the Embedded Signup flow.
  // This gives non-technical users a guided in-app experience instead of
  // a raw OAuth redirect.  The config_id tells Meta which login
  // configuration (permissions, UI customisation) to use.
  if (META_CONFIG_ID) {
    oauthParams.config_id = META_CONFIG_ID;
  }

  const params = new URLSearchParams(oauthParams);

  const oauthUrl = `https://www.facebook.com/dialog/oauth?${params.toString()}`;

  return res.json({ success: true, url: oauthUrl, state: statePayload });
};

// ── Step 2: Meta redirects back here with ?code=xxx&state=xxx ─────────────────
// GET /api/meta/oauth-callback
exports.oauthCallback = async (req, res) => {
  const { code, state, error, error_description } = req.query;
  const { META_APP_ID, META_APP_SECRET, BACKEND_URL, FRONTEND_URL } = process.env;

  // Handle user denial
  if (error) {
    logger.warn(`Meta OAuth denied: ${error} — ${error_description}`);
    return res.redirect(`${FRONTEND_URL}/connect-whatsapp?error=denied`);
  }

  if (!code || !state) {
    return res.redirect(`${FRONTEND_URL}/connect-whatsapp?error=invalid_callback`);
  }

  // Decode state to get userId, and verify it wasn't tampered with
  let userId;
  try {
    const decoded = Buffer.from(state, 'base64url').toString('utf8');
    const [decodedUserId, nonce, sig] = decoded.split(':');
    if (!decodedUserId || !nonce || !sig) throw new Error('Malformed state');

    const expectedSig = signState(decodedUserId, nonce);
    const sigBuf = Buffer.from(sig);
    const expBuf = Buffer.from(expectedSig);
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      throw new Error('State signature mismatch');
    }
    userId = decodedUserId;
  } catch (err) {
    logger.warn(`Meta OAuth callback: invalid state — ${err.message}`);
    return res.redirect(`${FRONTEND_URL}/connect-whatsapp?error=invalid_state`);
  }

  try {
    // ── Exchange authorization code for user access token ──────────────────
    const tokenRes = await axios.get(`${GRAPH_URL}/oauth/access_token`, {
      params: {
        client_id: META_APP_ID,
        client_secret: META_APP_SECRET,
        redirect_uri: `${BACKEND_URL}/api/meta/oauth-callback`,
        code,
      },
    });

    const userAccessToken = tokenRes.data.access_token;

    // ── Exchange short-lived token for a long-lived token (60 days) ────────
    const longLivedRes = await axios.get(`${GRAPH_URL}/oauth/access_token`, {
      params: {
        grant_type: 'fb_exchange_token',
        client_id: META_APP_ID,
        client_secret: META_APP_SECRET,
        fb_exchange_token: userAccessToken,
      },
    });

    const longLivedToken = longLivedRes.data.access_token;

    // ── Fetch the WhatsApp Business Account(s) linked to this user ─────────
    const wabaRes = await axios.get(`${GRAPH_URL}/me/businesses`, {
      params: {
        fields: 'id,name,whatsapp_business_accounts{id,name,phone_numbers{id,display_phone_number,verified_name}}',
        access_token: longLivedToken,
      },
    });

    const businesses = wabaRes.data.data || [];

    // Collect all phone numbers across all WABAs
    const phoneNumbers = [];
    for (const biz of businesses) {
      const wabas = biz.whatsapp_business_accounts?.data || [];
      for (const waba of wabas) {
        const phones = waba.phone_numbers?.data || [];
        for (const phone of phones) {
          phoneNumbers.push({
            phoneNumberId: phone.id,
            displayNumber: phone.display_phone_number,
            verifiedName: phone.verified_name,
            wabaId: waba.id,
            wabaName: waba.name,
          });
        }
      }
    }

    

    if (phoneNumbers.length === 0) {
      // No WhatsApp numbers found — nothing actionable for the frontend to
      // do with the token, so just report the error. (Previously this put
      // the long-lived token straight into the redirect URL.)
      return res.redirect(`${FRONTEND_URL}/connect-whatsapp?error=no_phone_numbers`);
    }

    if (phoneNumbers.length === 1) {
      // Only one phone — auto-save it
      const phone = phoneNumbers[0];
      await Business.findOneAndUpdate(
        { owner: userId },
        {
          whatsappPhoneNumberId: phone.phoneNumberId,
          whatsappAccessToken: longLivedToken,
          whatsappVerifyToken: process.env.WHATSAPP_VERIFY_TOKEN || 'wa_verify_token',
        }
      );

      logger.info(`WhatsApp auto-connected for user ${userId}: ${phone.displayNumber}`);
      return res.redirect(`${FRONTEND_URL}/connect-whatsapp?success=true&phone=${encodeURIComponent(phone.displayNumber)}`);
    }

    // Multiple phones — stash the token + options server-side and hand the
    // frontend only an opaque key, instead of the token itself.
    const key = stashPending({ userId, token: longLivedToken, phones: phoneNumbers });
    return res.redirect(`${FRONTEND_URL}/connect-whatsapp?step=pick_phone&key=${key}`);

  } catch (err) {
    const metaError = err.response?.data?.error?.message || err.message;
    logger.error(`Meta OAuth callback error: ${metaError}`);
    return res.redirect(`${FRONTEND_URL}/connect-whatsapp?error=token_exchange&detail=${encodeURIComponent(metaError)}`);
  }
};

// ── Step 2b (multi-phone): frontend fetches the pending options ──────────────
// GET /api/meta/pending-connection?key=xxx
// Returns the phone numbers found for this OAuth attempt, without ever
// exposing the underlying access token to the client.
exports.getPendingConnection = (req, res) => {
  const { key } = req.query;
  if (!key) return res.status(400).json({ success: false, message: 'key is required' });

  const pending = peekPending(key);
  if (!pending || String(pending.userId) !== String(req.user._id)) {
    return res.status(404).json({ success: false, message: 'This connection request has expired. Please reconnect WhatsApp.' });
  }

  res.json({
    success: true,
    data: {
      phones: pending.phones.map(({ phoneNumberId, displayNumber, verifiedName, wabaId, wabaName }) => ({
        phoneNumberId, displayNumber, verifiedName, wabaId, wabaName,
      })),
    },
  });
};

// ── Step 3 (multi-phone): User picks which number to use ──────────────────────
// POST /api/meta/select-phone  { key, phoneNumberId }
// The access token is never sent by the client — it's pulled from the
// server-side stash created in oauthCallback, keyed by the opaque `key`.
exports.selectPhone = async (req, res) => {
  const { key, phoneNumberId } = req.body;

  if (!key || !phoneNumberId) {
    return res.status(400).json({ success: false, message: 'key and phoneNumberId are required' });
  }

  const pending = peekPending(key);
  if (!pending || String(pending.userId) !== String(req.user._id)) {
    return res.status(400).json({ success: false, message: 'This connection request has expired. Please reconnect WhatsApp.' });
  }

  const phone = pending.phones.find(p => p.phoneNumberId === phoneNumberId);
  if (!phone) {
    return res.status(400).json({ success: false, message: 'Invalid phone number selection' });
  }

  const accessToken = pending.token;

  try {
    // Verify the token actually works for this phone number
    await axios.get(`${GRAPH_URL}/${phoneNumberId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    // Save to this user's business
    const business = await Business.findOneAndUpdate(
      { owner: req.user._id },
      {
        whatsappPhoneNumberId: phoneNumberId,
        whatsappAccessToken: accessToken,
        whatsappVerifyToken: process.env.WHATSAPP_VERIFY_TOKEN || 'wa_verify_token',
      },
      { new: true }
    );

    if (!business) {
      return res.status(404).json({ success: false, message: 'Business not found' });
    }

    consumePending(key); // one-time use — burn it once the connection succeeds

    logger.info(`WhatsApp phone selected for user ${req.user._id}: ${phoneNumberId}`);
    res.json({ success: true, message: 'WhatsApp connected successfully', business });

  } catch (err) {
    const metaError = err.response?.data?.error?.message || err.message;
    logger.error(`selectPhone error: ${metaError}`);
    res.status(400).json({ success: false, message: `Connection failed: ${metaError}` });
  }
};

// ── Disconnect WhatsApp ────────────────────────────────────────────────────────
// DELETE /api/meta/disconnect
exports.disconnect = async (req, res) => {
  try {
    await Business.findOneAndUpdate(
      { owner: req.user._id },
      { $unset: { whatsappPhoneNumberId: '', whatsappAccessToken: '' } }
    );
    logger.info(`WhatsApp disconnected for user ${req.user._id}`);
    res.json({ success: true, message: 'WhatsApp disconnected' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Disconnect failed' });
  }
};

// ── Token status check ────────────────────────────────────────────────────────
// GET /api/meta/token-status
exports.tokenStatus = async (req, res) => {
  try {
    const business = await Business.findOne({ owner: req.user._id });
    if (!business?.whatsappAccessToken || !business?.whatsappPhoneNumberId) {
      return res.json({ success: true, connected: false });
    }

    const result = await axios.get(`${GRAPH_URL}/${business.whatsappPhoneNumberId}`, {
      headers: { Authorization: `Bearer ${business.whatsappAccessToken}` },
    }).catch(err => ({ data: null, error: err.response?.data?.error }));

    const connected = !!result.data?.id;
    res.json({
      success: true,
      connected,
      phoneNumberId: business.whatsappPhoneNumberId,
    });
  } catch (err) {
    res.json({ success: true, connected: false });
  }
};