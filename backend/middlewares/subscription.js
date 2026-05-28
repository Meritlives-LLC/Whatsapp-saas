const Subscription = require('../models/Subscription');
const { getPlan } = require('../config/plans');
const logger = require('../config/logger');

/**
 * Attach subscription to req — call this on protected routes that need plan info
 */
exports.attachSubscription = async (req, res, next) => {
  try {
    if (!req.user?.business?._id) return next();

    let sub = await Subscription.findOne({ business: req.user.business._id });

    // Create free subscription if none exists
    if (!sub) {
      sub = await Subscription.create({ business: req.user.business._id, plan: 'free' });
    }

    // Downgrade if paid plan expired (cron handles the daily pass; this is a safety net
    // for users who hit a route between midnight and when the cron fires)
    if (['starter', 'growth', 'pro'].includes(sub.plan)) {
      if (sub.currentPeriodEnd && new Date() > sub.currentPeriodEnd && sub.cancelAtPeriodEnd) {
        sub.plan = 'free';
        sub.status = 'active';
        sub.cancelAtPeriodEnd = false;
        await sub.save();
      }
    }

    req.subscription = sub;
    req.plan = getPlan(sub.plan);
    next();
  } catch (err) {
    logger.error(`Subscription middleware error: ${err.message}`);
    next();
  }
};

/**
 * Check whether the AI reply limit is reached for this subscription.
 * Does NOT reset — reset is handled exclusively by the cron job.
 */
exports.checkAiLimit = (subscription) => {
  if (!subscription) return { allowed: true };

  const plan  = getPlan(subscription.plan);
  const limit = plan.limits.aiRepliesPerMonth;
  const used  = subscription.usage.aiRepliesCount;

  if (used >= limit) {
    return {
      allowed: false,
      message: `You've used all ${limit} AI replies on the ${plan.name} plan. Upgrade to continue.`,
      limitReached: true,
      plan: subscription.plan,
    };
  }
  return { allowed: true };
};

/**
 * Increment AI reply counter
 */
exports.incrementAiUsage = async (subscription) => {
  if (!subscription) return;
  subscription.usage.aiRepliesCount += 1;
  await subscription.save();
};

/**
 * Middleware: require a minimum plan level
 * Usage: requirePlan('starter') or requirePlan(['growth', 'pro'])
 */
exports.requirePlan = (minPlan) => {
  const order = ['free', 'starter', 'growth', 'pro'];
  return (req, res, next) => {
    const plans = Array.isArray(minPlan) ? minPlan : [minPlan];
    const userPlanIndex = order.indexOf(req.subscription?.plan || 'free');
    const minIndex = Math.min(...plans.map(p => order.indexOf(p)));
    if (userPlanIndex >= minIndex) return next();
    return res.status(403).json({
      success: false,
      message: `This feature requires the ${plans[0]} plan or higher.`,
      upgradeRequired: true,
      currentPlan: req.subscription?.plan || 'free',
    });
  };
};
