const cron = require('node-cron');
const Conversation = require('../models/Conversation');
const { Appointment } = require('../models/index');
const Business = require('../models/Business');
const Subscription = require('../models/Subscription');
const { sendTextMessage } = require('./whatsappService');
const { checkAllTokens } = require('./whatsappTokenService');
const emailService = require('./emailService');
const User = require('../models/User');
const logger = require('../config/logger');

// ─── Auto follow-up (every hour) ─────────────────────────────────────────────
const setupFollowUpCron = () => {
  cron.schedule('0 * * * *', async () => {
    try {
      logger.info('Cron: running follow-up check');
      const businesses = await Business.find({ 'settings.autoFollowUp': true, isActive: true });

      for (const business of businesses) {
        const delayHours = business.settings.followUpDelayHours || 24;
        const cutoff = new Date(Date.now() - delayHours * 60 * 60 * 1000);

        const conversations = await Conversation.find({
          business: business._id,
          status: 'open',
          followUpSent: false,
          lastMessageAt: { $lt: cutoff },
        }).limit(50);

        for (const conv of conversations) {
          try {
            const message = `Hi ${conv.customerName || 'there'}! 👋 Just checking in — do you still need help? We're here for you.`;
            await sendTextMessage(
              business.whatsappPhoneNumberId,
              business.whatsappAccessToken,
              conv.customerPhone,
              message
            );
            conv.followUpSent = true;
            conv.messages.push({ direction: 'outbound', content: message, sentBy: 'system' });
            await conv.save();
          } catch (err) {
            logger.error(`Follow-up failed for ${conv.customerPhone}: ${err.message}`);
          }
        }
      }
    } catch (err) {
      logger.error(`Follow-up cron error: ${err.message}`);
    }
  });
};

// ─── Appointment reminders (every 30 minutes) ─────────────────────────────────
const setupReminderCron = () => {
  cron.schedule('*/30 * * * *', async () => {
    try {
      const now = new Date();
      const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      const upcoming = await Appointment.find({
        status: 'confirmed',
        reminderSent: false,
        scheduledAt: { $gte: now, $lte: in24h },
      }).populate('business');

      for (const appt of upcoming) {
        const business = appt.business;
        const hoursLeft = Math.round((appt.scheduledAt - now) / (1000 * 60 * 60));
        const message = `⏰ Reminder: Your appointment${appt.service ? ` for ${appt.service}` : ''} is in ${hoursLeft} hour(s).\n📅 ${appt.scheduledAt.toLocaleString()}\n\nReply CANCEL to cancel. See you soon! 😊`;

        try {
          await sendTextMessage(
            business.whatsappPhoneNumberId,
            business.whatsappAccessToken,
            appt.customerPhone,
            message
          );
          appt.reminderSent = true;
          await appt.save();
          logger.info(`Reminder sent to ${appt.customerPhone}`);
        } catch (err) {
          logger.error(`Reminder failed for ${appt.customerPhone}: ${err.message}`);
        }
      }
    } catch (err) {
      logger.error(`Reminder cron error: ${err.message}`);
    }
  });
};

// ─── Subscription expiry check (daily at midnight) ────────────────────────────
const setupSubscriptionCron = () => {
  cron.schedule('0 0 * * *', async () => {
    try {
      logger.info('Cron: checking subscription expiries');
      const now = new Date();

      // Downgrade expired subscriptions
      const expired = await Subscription.find({
        status: 'active',
        plan: { $ne: 'free' },
        currentPeriodEnd: { $lt: now },
        cancelAtPeriodEnd: true,
      }).populate({ path: 'business', populate: { path: 'owner', model: User } });

      for (const sub of expired) {
        sub.plan = 'free';
        sub.status = 'active';
        sub.cancelAtPeriodEnd = false;
        sub.limits = { aiRepliesPerMonth: 100, whatsappNumbers: 1, products: 5 };
        await sub.save();

        const owner = sub.business?.owner;
        if (owner?.email) {
          await emailService.sendEmail({
            to: owner.email,
            subject: 'Your WA AutoBot subscription has ended',
            html: `<p>Hi ${owner.name},</p><p>Your subscription has ended and you've been moved to the Free plan (100 AI replies/month). <a href="${process.env.FRONTEND_URL}/subscription">Resubscribe anytime</a>.</p>`,
          }).catch(() => {});
        }
        logger.info(`Subscription expired & downgraded: ${sub.business?.name}`);
      }

      // ── AI limit warning at 80% ────────────────────────────────────────
      const nearLimit = await Subscription.find({
        plan: { $ne: 'free' },
        status: 'active',
        'usage.warningEmailSent': { $ne: true },
      }).populate({ path: 'business', populate: { path: 'owner', model: User } });

      for (const sub of nearLimit) {
        const limit = sub.limits?.aiRepliesPerMonth || 100;
        const used  = sub.usage?.aiRepliesCount || 0;
        const pct   = (used / limit) * 100;

        if (pct >= 80 && limit < 999999) {
          const owner = sub.business?.owner;
          if (owner?.email) {
            await emailService.sendLimitWarningEmail(owner, used, limit).catch(() => {});
            sub.usage.warningEmailSent = true;
            await sub.save();
            logger.info(`AI limit warning sent to ${owner.email} (${Math.round(pct)}%)`);
          }
        }
      }

      // ── Reset monthly usage on billing cycle ───────────────────────────
      const toReset = await Subscription.find({
        'usage.resetAt': { $lt: now },
      });

      for (const sub of toReset) {
        sub.usage.aiRepliesCount = 0;
        sub.usage.warningEmailSent = false;
        sub.usage.resetAt = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        await sub.save();
      }
      if (toReset.length > 0) logger.info(`Usage reset for ${toReset.length} subscriptions`);

    } catch (err) {
      logger.error(`Subscription cron error: ${err.message}`);
    }
  });
};

// ─── WhatsApp token health check (every 12 hours) ─────────────────────────────
const setupTokenHealthCron = () => {
  cron.schedule('0 */12 * * *', async () => {
    try {
      logger.info('Cron: checking WhatsApp token health');
      await checkAllTokens();
    } catch (err) {
      logger.error(`Token health cron error: ${err.message}`);
    }
  });
};

const startCronJobs = () => {
  setupFollowUpCron();
  setupReminderCron();
  setupSubscriptionCron();
  setupTokenHealthCron();
  logger.info('⏰ All cron jobs started');
};

module.exports = { startCronJobs };
