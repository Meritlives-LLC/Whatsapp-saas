// ─── Plan definitions — single source of truth ───────────────────────────────
// prices: NGN is the base. Others are approximate equivalents shown to foreign users.
// Paystack only accepts NGN; USD/GHS/KES/ZAR are display-only conversions.

const PLANS = {
  free: {
    id: 'free',
    name: 'Free',
    price: 0,           // always free regardless of currency
    prices: { NGN: 0, USD: 0, GHS: 0, KES: 0, ZAR: 0 },
    interval: null,
    limits: {
      aiRepliesPerMonth: 100,
      whatsappNumbers: 1,
      products: 5,
      teamMembers: 1,
    },
    features: [
      '100 AI replies / month',
      '1 WhatsApp number',
      'Up to 5 products',
      'Basic analytics',
      'Paystack payments',
    ],
  },

  starter: {
    id: 'starter',
    name: 'Starter',
    price: 8000,        // ₦8,000/month — Paystack charge amount
    prices: { NGN: 8000, USD: 5, GHS: 75, KES: 650, ZAR: 95 },
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
    prices: { NGN: 20000, USD: 13, GHS: 185, KES: 1650, ZAR: 240 },
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
    prices: { NGN: 45000, USD: 29, GHS: 415, KES: 3750, ZAR: 540 },
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

// Currency display metadata
const CURRENCIES = {
  NGN: { symbol: '₦', name: 'Nigerian Naira',    locale: 'en-NG' },
  USD: { symbol: '$', name: 'US Dollar',          locale: 'en-US' },
  GHS: { symbol: '₵', name: 'Ghanaian Cedi',     locale: 'en-GH' },
  KES: { symbol: 'KSh', name: 'Kenyan Shilling', locale: 'en-KE' },
  ZAR: { symbol: 'R',  name: 'South African Rand', locale: 'en-ZA' },
};

// Countries that map to each currency
const COUNTRY_CURRENCY_MAP = {
  NG: 'NGN',
  GH: 'GHS',
  KE: 'KES',
  ZA: 'ZAR',
  US: 'USD', CA: 'USD', GB: 'USD', AU: 'USD', // anglophone non-Africa → USD
};

const getPlan = (planId) => PLANS[planId] || PLANS.free;

const getCurrencyForCountry = (countryCode) => {
  if (process.env.DEFAULT_CURRENCY) return process.env.DEFAULT_CURRENCY;
  return COUNTRY_CURRENCY_MAP[countryCode] || 'USD';
};

/**
 * Return plans with display prices for the given currency.
 * The `price` field always stays NGN (for Paystack), `displayPrice` is localised.
 */
const getPlansForCurrency = (currency = 'NGN') => {
  const cur = CURRENCIES[currency] || CURRENCIES.NGN;
  return Object.fromEntries(
    Object.entries(PLANS).map(([id, plan]) => [
      id,
      {
        ...plan,
        displayPrice: plan.prices[currency] ?? plan.prices.NGN,
        displayCurrency: currency,
        currencySymbol: cur.symbol,
      },
    ])
  );
};

const isWithinLimit = (plan, metric, currentCount) => {
  const limit = getPlan(plan).limits[metric];
  return currentCount < limit;
};

module.exports = { PLANS, CURRENCIES, getPlan, getCurrencyForCountry, getPlansForCurrency, isWithinLimit };
