const Subscription = require('../models/Subscription');
const { PLANS, getPlan } = require('../config/plans');
const paystackService = require('../services/paystackService');
const axios = require('axios');
const logger = require('../config/logger');

/**
 * GET /api/subscription — get current subscription + usage
 */
exports.getSubscription = async (req, res) => {
  try {
    let sub = await Subscription.findOne({ business: req.user.business._id });
    if (!sub) sub = await Subscription.create({ business: req.user.business._id, plan: 'free' });

    await sub.resetUsageIfNeeded();
    const plan = getPlan(sub.plan);

    res.json({
      success: true,
      data: {
        plan: sub.plan,
        planDetails: plan,
        status: sub.status,
        usage: sub.usage,
        limits: plan.limits,
        currentPeriodEnd: sub.currentPeriodEnd,
        cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * GET /api/subscription/plans — return all plans (public)
 */
exports.getPlans = (req, res) => {
  res.json({ success: true, data: PLANS });
};

/**
 * POST /api/subscription/upgrade — initialize Paystack subscription
 */
exports.upgrade = async (req, res) => {
  try {
    const { planId } = req.body;
    const plan = getPlan(planId);

    if (!plan || plan.price === 0) {
      return res.status(400).json({ success: false, message: 'Invalid plan selected' });
    }

    const business = req.user.business;
    const email = req.user.email;

    // Initialize Paystack transaction (one-time charge that activates subscription)
    const reference = paystackService.generateReference('SUB');
    const result = await paystackService.initializePayment({
      email,
      amount: plan.price,
      reference,
      metadata: {
        businessId: business._id.toString(),
        planId,
        type: 'subscription_upgrade',
        businessName: business.name,
      },
      callbackUrl: `${process.env.FRONTEND_URL}/subscription/verify?ref=${reference}`,
    });

    // If plan has a Paystack recurring plan code, use subscription API
    if (plan.paystackPlanCode) {
      try {
        const subResult = await axios.post(
          'https://api.paystack.co/subscription',
          { customer: email, plan: plan.paystackPlanCode },
          { headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` } }
        );
        const subData = subResult.data.data || {};
        // Store subscription code AND email token — both are required for cancellation
        await Subscription.findOneAndUpdate(
          { business: business._id },
          {
            paystackSubscriptionCode: subData.subscription_code,
            paystackEmailToken:       subData.email_token,
            paystackCustomerCode:     subData.customer?.customer_code,
          },
          { upsert: true }
        );
      } catch (subErr) {
        logger.error('Paystack subscription create error:', subErr.message);
      }
    }

    res.json({
      success: true,
      data: {
        paymentLink: result.authorization_url,
        reference,
        plan: planId,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * POST /api/subscription/verify — verify payment after redirect from Paystack
 */
exports.verifyUpgrade = async (req, res) => {
  try {
    const { reference } = req.body;
    const payment = await paystackService.verifyPayment(reference);

    if (payment.status !== 'success') {
      return res.status(400).json({ success: false, message: 'Payment not successful' });
    }

    const { businessId, planId } = payment.metadata;

    const now = new Date();
    const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const sub = await Subscription.findOneAndUpdate(
      { business: businessId },
      {
        plan: planId,
        status: 'active',
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: false,
        lastPaymentAt: now,
        lastPaymentAmount: payment.amount / 100,
      },
      { upsert: true, new: true }
    );

    res.json({ success: true, data: { plan: sub.plan, status: sub.status, periodEnd: sub.currentPeriodEnd } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * POST /api/subscription/cancel — cancel at period end
 */
exports.cancel = async (req, res) => {
  try {
    const sub = await Subscription.findOne({ business: req.user.business._id });
    if (!sub) return res.status(404).json({ success: false, message: 'No subscription found' });

    // Cancel on Paystack if recurring
    if (sub.paystackSubscriptionCode && sub.paystackEmailToken) {
      await axios.post(
        'https://api.paystack.co/subscription/disable',
        { code: sub.paystackSubscriptionCode, token: sub.paystackEmailToken },
        { headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` } }
      ).catch(err => logger.error(`Paystack cancel error: ${err.message}`));
    }

    sub.cancelAtPeriodEnd = true;
    await sub.save();

    res.json({
      success: true,
      message: `Subscription will cancel on ${sub.currentPeriodEnd?.toLocaleDateString()}. You keep access until then.`,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * POST /api/subscription/paystack-webhook — handle Paystack subscription events
 * Route uses express.raw() so req.body is a Buffer — must use .toString() for HMAC
 */
exports.paystackWebhook = async (req, res) => {
  const signature = req.headers['x-paystack-signature'];

  // CRITICAL: req.body is a raw Buffer (from express.raw middleware on this route).
  // JSON.stringify(Buffer) gives {"type":"Buffer","data":[...]} — wrong hash.
  // Call .toString() to get the original body string before hashing.
  if (!paystackService.validateWebhookSignature(req.body, signature)) {
    return res.status(401).send('Invalid signature');
  }

  res.status(200).send('OK');

  // Parse body now that signature is verified
  let event, data;
  try {
    ({ event, data } = JSON.parse(req.body.toString()));
  } catch {
    return;
  }

  // Idempotency guard — prevent duplicate processing across restarts
  const webhookRef = data?.subscription_code || data?.reference || data?.transfer_code
    || JSON.stringify(data).slice(0, 40);
  if (paystackService.isAlreadyProcessed(webhookRef)) return;

  try {
    switch (event) {
      case 'charge.success': {
        const meta = data.metadata;
        if (meta?.type === 'subscription_upgrade' && meta?.businessId) {
          const now = new Date();
          await Subscription.findOneAndUpdate(
            { business: meta.businessId },
            {
              plan: meta.planId,
              status: 'active',
              currentPeriodStart: now,
              currentPeriodEnd: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
              lastPaymentAt: now,
              lastPaymentAmount: data.amount / 100,
            },
            { upsert: true }
          );
        }
        break;
      }
      case 'subscription.create': {
        // Paystack sends this when a subscription is created — store email_token for cancellations
        const subCode   = data.subscription_code;
        const emailToken = data.email_token;
        const custCode  = data.customer?.customer_code;
        if (subCode) {
          await Subscription.findOneAndUpdate(
            { paystackSubscriptionCode: subCode },
            {
              ...(emailToken && { paystackEmailToken: emailToken }),
              ...(custCode   && { paystackCustomerCode: custCode }),
            }
          );
        }
        break;
      }
      case 'subscription.disable': {
        const subCode = data.subscription_code;
        await Subscription.findOneAndUpdate(
          { paystackSubscriptionCode: subCode },
          { cancelAtPeriodEnd: true }
        );
        break;
      }
      case 'invoice.payment_failed': {
        const customerCode = data.customer?.customer_code;
        if (customerCode) {
          await Subscription.findOneAndUpdate(
            { paystackCustomerCode: customerCode },
            { status: 'past_due' }
          );
        }
        break;
      }
    }
  } catch (err) {
    logger.error(`Subscription webhook error: ${err.message}`);
  }
};
