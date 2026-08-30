// backend/middlewares/verifyMetaSignature.js
// Verifies that an incoming /api/webhook POST really came from Meta, using
// the X-Hub-Signature-256 header Meta signs with your app secret. Without
// this, anyone who learns (or guesses) a business's phone_number_id can post
// arbitrary "messages" to your webhook and trigger real AI replies + spend.
//
// Requires the raw request body (see server.js — express.json's `verify`
// option stashes it on req.rawBody before parsing).

const crypto = require('crypto');
const logger = require('../config/logger');

module.exports = (req, res, next) => {
  const appSecret = process.env.META_APP_SECRET;

  if (!appSecret) {
    logger.error('META_APP_SECRET not configured — rejecting webhook (fail closed)');
    return res.status(500).send('Server misconfigured');
  }

  const signature = req.headers['x-hub-signature-256'];
  if (!signature || !req.rawBody) {
    logger.warn(`Webhook rejected: missing signature/body from IP ${req.ip}`);
    return res.status(401).send('Missing signature');
  }

  const expected = 'sha256=' + crypto
    .createHmac('sha256', appSecret)
    .update(req.rawBody)
    .digest('hex');

  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expected);

  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    logger.warn(`Webhook rejected: invalid signature from IP ${req.ip}`);
    return res.status(401).send('Invalid signature');
  }

  next();
};
