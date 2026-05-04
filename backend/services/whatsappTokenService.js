const axios = require('axios');
const Business = require('../models/Business');
const logger = require('../config/logger');
const emailService = require('./emailService');
const User = require('../models/User');

/**
 * Verify a WhatsApp access token is still valid
 */
const verifyToken = async (phoneNumberId, accessToken) => {
  try {
    const res = await axios.get(
      `https://graph.facebook.com/v18.0/${phoneNumberId}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    return { valid: true, data: res.data };
  } catch (err) {
    const status = err.response?.status;
    const code = err.response?.data?.error?.code;
    return { valid: false, status, code, message: err.response?.data?.error?.message };
  }
};

/**
 * Check all connected businesses' WhatsApp tokens
 * Called by cron every 12 hours
 */
const checkAllTokens = async () => {
  try {
    const businesses = await Business.find({
      whatsappPhoneNumberId: { $exists: true, $ne: '' },
      whatsappAccessToken:   { $exists: true, $ne: '' },
      isActive: true,
    }).populate({ path: 'owner', model: User, select: 'name email' });

    logger.info(`WhatsApp token check: ${businesses.length} businesses`);

    for (const business of businesses) {
      const result = await verifyToken(
        business.whatsappPhoneNumberId,
        business.whatsappAccessToken
      );

      if (!result.valid) {
        logger.warn(
          `WhatsApp token EXPIRED for business: ${business.name} (${business._id}) — code ${result.code}`
        );

        // Alert the business owner
        if (business.owner?.email) {
          await emailService.sendEmail?.({
            to: business.owner.email,
            subject: '⚠️ WhatsApp connection needs renewal — WA AutoBot',
            html: `
              <p>Hi ${business.owner.name},</p>
              <p>Your WhatsApp access token for <strong>${business.name}</strong> has expired. AI auto-replies are currently paused.</p>
              <p>To fix this:</p>
              <ol>
                <li>Go to <a href="https://developers.facebook.com">developers.facebook.com</a></li>
                <li>Open your WhatsApp app → API Setup</li>
                <li>Copy your new Access Token</li>
                <li>Paste it in <a href="${process.env.FRONTEND_URL}/settings">WA AutoBot → Settings → WhatsApp</a></li>
              </ol>
              <p>If you're using a temporary token, switch to a <strong>permanent System User token</strong> to avoid this issue.</p>
            `,
          }).catch(() => {});
        }
      } else {
        logger.info(`WhatsApp token OK: ${business.name}`);
      }
    }
  } catch (err) {
    logger.error(`WhatsApp token check failed: ${err.message}`);
  }
};

module.exports = { verifyToken, checkAllTokens };
