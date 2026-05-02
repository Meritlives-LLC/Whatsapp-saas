const Subscription = require('../models/Subscription');
const { PLANS, getPlan } = require('../config/plans');
const paystackService = require('../services/paystackService');
const crypto = require('crypto');
const axios = require('axios');

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
        // Store subscription code for future cancellations
        await Subscription.findOneAndUpdate(
          { business: business._id },
          { paystackSubscriptionCode: subResult.data.data?.subscription_code },
          { upsert: true }
        );
      } catch (subErr) {
        console.error('Paystack subscription create error:', subErr.message);
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
      ).catch(err => console.error('Paystack cancel error:', err.message));
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
 */
exports.paystackWebhook = async (req, res) => {
  const signature = req.headers['x-paystack-signature'];
  const hash = crypto
    .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
    .update(JSON.stringify(req.body))
    .digest('hex');

  if (hash !== signature) return res.status(401).send('Invalid signature');
  res.status(200).send('OK');

  const { event, data } = req.body;

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
      case 'subscription.disable': {
        // Paystack notifies us when a subscription is disabled
        const subCode = data.subscription_code;
        await Subscription.findOneAndUpdate(
          { paystackSubscriptionCode: subCode },
          { cancelAtPeriodEnd: true }
        );
        break;
      }
      case 'invoice.payment_failed': {
        // Mark as past_due — they can't use AI until they pay
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
    console.error('Subscription webhook error:', err.message);
  }
};
