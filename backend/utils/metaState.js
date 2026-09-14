// backend/utils/metaState.js
//
// Signs/verifies the opaque `state` token used by the classic, full-page
// Meta OAuth redirect flow (see controllers/metaOAuthController.js →
// getOAuthUrl / oauthCallback). Meta redirects the browser back to our
// backend with no session context of its own, so this binds that redirect
// to the SaaS user who started it.
//
// IMPORTANT: Meta's Embedded Signup (FB.login() popup, via the JS SDK)
// never returns this `state` value in its authResponse — that parameter
// only round-trips through the full-page `/dialog/oauth` redirect, not the
// JS SDK popup. This was the root cause of the original bug: the frontend
// tried to forward `resp.authResponse.state` (which FB.login() never
// populates) and fell back to the literal string "embedded", which could
// never satisfy verifyState() below.
//
// The Embedded Signup path (embeddedSignupCallback in
// metaOAuthController.js) doesn't need this at all: it's called in-page by
// an already-authenticated axios request while the SaaS session is still
// live, so `req.user` from the normal auth middleware is already trustworthy
// — there's no cross-navigation to bridge.
const crypto = require('crypto');

function signState(userId, nonce) {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not configured');
  }
  return crypto.createHmac('sha256', process.env.JWT_SECRET).update(`${userId}:${nonce}`).digest('hex');
}

/** Build a signed, opaque state token embedding userId. */
function buildState(userId) {
  const nonce = crypto.randomBytes(16).toString('hex');
  const sig = signState(userId, nonce);
  return Buffer.from(`${userId}:${nonce}:${sig}`).toString('base64url');
}

/**
 * Decode + verify a state token produced by buildState().
 * Returns the embedded userId on success; throws on any tampering or
 * malformed input.
 */
function verifyState(state) {
  if (!state || typeof state !== 'string') {
    throw new Error('Malformed state');
  }

  let decoded;
  try {
    decoded = Buffer.from(state, 'base64url').toString('utf8');
  } catch {
    throw new Error('Malformed state');
  }

  const [userId, nonce, sig] = decoded.split(':');
  if (!userId || !nonce || !sig) {
    throw new Error('Malformed state');
  }

  const expected = signState(userId, nonce);
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    throw new Error('State signature mismatch');
  }

  return userId;
}

module.exports = { signState, buildState, verifyState };
