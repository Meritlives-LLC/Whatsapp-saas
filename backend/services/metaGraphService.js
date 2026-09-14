// backend/services/metaGraphService.js
//
// Thin wrappers around the Meta Graph API calls needed to turn a completed
// Meta OAuth / Embedded Signup attempt into a working WhatsApp connection.
// Shared by both onboarding paths in controllers/metaOAuthController.js:
//   - Embedded Signup (FB.login() popup — the primary, recommended path)
//   - Classic OAuth redirect (fallback when META_CONFIG_ID isn't set)
//
// Docs consulted for this implementation:
//   https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/implementation
//   https://developers.facebook.com/documentation/business-messaging/whatsapp/solution-providers/manage-webhooks
//   https://developers.facebook.com/documentation/business-messaging/whatsapp/business-phone-numbers/registration
const axios = require('axios');
const logger = require('../config/logger');
const { GRAPH_URL } = require('../config/meta');

/**
 * Exchange a `code` from the classic full-page OAuth redirect
 * (`/dialog/oauth`) for a short-lived user access token. This path requires
 * `redirect_uri` to exactly match the one used to obtain the code.
 */
async function exchangeCodeForToken({ code, redirectUri }) {
  const { META_APP_ID, META_APP_SECRET } = process.env;
  const res = await axios.get(`${GRAPH_URL}/oauth/access_token`, {
    params: { client_id: META_APP_ID, client_secret: META_APP_SECRET, redirect_uri: redirectUri, code },
  });
  return res.data.access_token;
}

/**
 * Exchange a `code` returned by Embedded Signup's FB.login() popup callback
 * for a short-lived user access token.
 *
 * NOTE ON redirect_uri: FB.login() is a JS SDK popup flow, not a browser
 * redirect — there is no redirect_uri involved in obtaining the code, so
 * none is sent here. This matches how third-party Embedded Signup
 * integrations (e.g. Bird, Bootstrapping/Sinch-style ASP integrations)
 * perform this exchange. If your specific Meta app/Login Configuration
 * requires a redirect_uri here, that will surface as a Meta API error
 * (e.g. "redirect_uri is required") the first time this runs — check the
 * Meta Developer dashboard for your app's Facebook Login for Business
 * configuration if that happens.
 */
async function exchangeEmbeddedCodeForToken(code) {
  const { META_APP_ID, META_APP_SECRET } = process.env;
  const res = await axios.get(`${GRAPH_URL}/oauth/access_token`, {
    params: { client_id: META_APP_ID, client_secret: META_APP_SECRET, code },
  });
  return res.data.access_token;
}

/** Exchange a short-lived user token for a long-lived one (~60 days). */
async function getLongLivedToken(shortLivedToken) {
  const { META_APP_ID, META_APP_SECRET } = process.env;
  const res = await axios.get(`${GRAPH_URL}/oauth/access_token`, {
    params: {
      grant_type: 'fb_exchange_token',
      client_id: META_APP_ID,
      client_secret: META_APP_SECRET,
      fb_exchange_token: shortLivedToken,
    },
  });
  return res.data.access_token;
}

/**
 * Look up the phone numbers under a specific WABA. Used when Embedded
 * Signup's session-logging message event returns only a waba_id (e.g. the
 * `only_waba_sharing` bypass-phone-selection feature type) and we need to
 * find which number(s) to offer.
 */
async function getPhoneNumbersForWaba(wabaId, accessToken) {
  const res = await axios.get(`${GRAPH_URL}/${wabaId}`, {
    params: { fields: 'id,name,phone_numbers{id,display_phone_number,verified_name}' },
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const phones = res.data.phone_numbers?.data || [];
  return phones.map((p) => ({
    phoneNumberId: p.id,
    displayNumber: p.display_phone_number,
    verifiedName: p.verified_name,
    wabaId,
    wabaName: res.data.name,
  }));
}

/**
 * Classic-flow discovery: enumerate all businesses/WABAs/numbers visible to
 * this token via /me/businesses. This is a reasonable fallback for the
 * plain OAuth redirect path (where Embedded Signup's message event isn't
 * available), but it is NOT the mechanism Meta recommends for Embedded
 * Signup itself — for Embedded Signup, the waba_id/phone_number_id should
 * come from the WA_EMBEDDED_SIGNUP postMessage event fired to the page that
 * launched FB.login(), since that's what Meta actually guarantees reflects
 * the asset the customer just created/selected in the popup.
 */
async function getBusinessesAndPhoneNumbers(accessToken) {
  const res = await axios.get(`${GRAPH_URL}/me/businesses`, {
    params: {
      fields: 'id,name,whatsapp_business_accounts{id,name,phone_numbers{id,display_phone_number,verified_name}}',
    },
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const businesses = res.data.data || [];
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
  return phoneNumbers;
}

/** Fetch display name / phone number for a known phone_number_id. */
async function getPhoneNumberDetails(phoneNumberId, accessToken) {
  const res = await axios.get(`${GRAPH_URL}/${phoneNumberId}`, {
    params: { fields: 'display_phone_number,verified_name' },
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return { displayNumber: res.data.display_phone_number, verifiedName: res.data.verified_name };
}

/**
 * Subscribe this app to a customer's WABA so we start receiving webhooks
 * (incoming messages, status updates) for it. Required — per Meta's docs,
 * "You must individually subscribe to every WABA for which you wish to
 * receive webhooks." Never throws; failures are reported so the caller can
 * decide how to surface them (the WhatsApp connection can still be saved,
 * but messaging silently won't work until this succeeds).
 */
async function subscribeAppToWaba(wabaId, accessToken) {
  try {
    await axios.post(`${GRAPH_URL}/${wabaId}/subscribed_apps`, null, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return { subscribed: true };
  } catch (err) {
    const message = err.response?.data?.error?.message || err.message;
    logger.error(`Failed to subscribe app to WABA ${wabaId}: ${message}`);
    return { subscribed: false, error: message };
  }
}

/**
 * Register a business phone number for use with Cloud API. A number that
 * comes out of Embedded Signup is NOT yet usable for sending/receiving
 * messages until this succeeds — per Meta's docs, "To use your business
 * phone number with Cloud API you must register it," and doing so enforces
 * two-step verification with the given 6-digit PIN. Never throws; failures
 * (e.g. the number already has a different PIN set) are reported rather
 * than silently assumed successful.
 */
async function registerPhoneNumber(phoneNumberId, accessToken, pin) {
  try {
    await axios.post(
      `${GRAPH_URL}/${phoneNumberId}/register`,
      { messaging_product: 'whatsapp', pin },
      { headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' } }
    );
    return { registered: true };
  } catch (err) {
    const message = err.response?.data?.error?.message || err.message;
    const code = err.response?.data?.error?.code;
    logger.error(`Failed to register phone ${phoneNumberId} for Cloud API: ${message} (code: ${code ?? 'n/a'})`);
    return { registered: false, error: message, code };
  }
}

module.exports = {
  exchangeCodeForToken,
  exchangeEmbeddedCodeForToken,
  getLongLivedToken,
  getPhoneNumbersForWaba,
  getBusinessesAndPhoneNumbers,
  getPhoneNumberDetails,
  subscribeAppToWaba,
  registerPhoneNumber,
};
