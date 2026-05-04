// ─── Plan definitions — single source of truth ───────────────────────────────
// All prices in NGN (kobo for Paystack = price * 100)

const PLANS = {
  free: {
    id: 'free',
    name: 'Free',
    price: 0,
    interval: null,
    limits: {
      aiRepliesPerMonth: 30,
      whatsappNumbers: 1,
      products: 5,
      teamMembers: 1,
    },
    features: [
      '30 AI replies / month',
      '1 WhatsApp number',
      'Up to 5 products',
      'Basic analytics',
      'Paystack payments',
    ],
  },

  starter: {
    id: 'starter',
    name: 'Starter',
    price: 8000,        // ₦8,000/month
    interval: 'monthly',
    paystackPlanCode: process.env.PAYSTACK_PLAN_STARTER || '',
    limits: {
      aiRepliesPerMonth: 1000,
      whatsappNumbers: 1,
      products: 50,
      teamMembers: 2,
    },
    features: [
      '1,000 AI replies / month',
      '1 WhatsApp number',
      'Up to 50 products',
      'Full analytics',
      'Bookings & reminders',
      'Auto follow-up',
      'Lead capture',
      'Email support',
    ],
  },

  growth: {
    id: 'growth',
    name: 'Growth',
    price: 20000,       // ₦20,000/month
    interval: 'monthly',
    paystackPlanCode: process.env.PAYSTACK_PLAN_GROWTH || '',
    limits: {
      aiRepliesPerMonth: 5000,
      whatsappNumbers: 3,
      products: 200,
      teamMembers: 5,
    },
    features: [
      '5,000 AI replies / month',
      '3 WhatsApp numbers',
      'Unlimited products',
      'Advanced analytics',
      'All Starter features',
      'Priority support',
      'Custom AI persona',
    ],
    popular: true,
  },

  pro: {
    id: 'pro',
    name: 'Pro',
    price: 45000,       // ₦45,000/month
    interval: 'monthly',
    paystackPlanCode: process.env.PAYSTACK_PLAN_PRO || '',
    limits: {
      aiRepliesPerMonth: 999999,  // unlimited
      whatsappNumbers: 10,
      products: 999999,
      teamMembers: 999999,
    },
    features: [
      'Unlimited AI replies',
      'Up to 10 WhatsApp numbers',
      'Unlimited products & team',
      'White-label dashboard',
      'All Growth features',
      'Dedicated support',
      'SLA guarantee',
    ],
  },
};

const getPlan = (planId) => PLANS[planId] || PLANS.free;

const isWithinLimit = (plan, metric, currentCount) => {
  const limit = getPlan(plan).limits[metric];
  return currentCount < limit;
};

module.exports = { PLANS, getPlan, isWithinLimit };
