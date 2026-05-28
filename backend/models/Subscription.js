const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
  business: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true, unique: true },
  plan: { type: String, enum: ['free', 'starter', 'growth', 'pro'], default: 'free' },
  status: { type: String, enum: ['active', 'cancelled', 'expired', 'past_due'], default: 'active' },

  // Paystack subscription data
  paystackSubscriptionCode: { type: String },
  paystackCustomerCode: { type: String },
  paystackEmailToken: { type: String },

  // Billing cycle
  currentPeriodStart: { type: Date, default: Date.now },
  currentPeriodEnd: { type: Date },
  cancelAtPeriodEnd: { type: Boolean, default: false },

  // Usage tracking — reset by cron on the 1st of each calendar month (resetAt)
  // Do NOT reset elsewhere; the cron is the single source of truth for resets.
  usage: {
    aiRepliesCount:   { type: Number,  default: 0 },
    // resetAt: cron resets usage when now >= resetAt, then advances to next 1st
    resetAt:          { type: Date,    default: () => new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1) },
    // Prevent the 80%-warning email from firing more than once per cycle
    warningEmailSent: { type: Boolean, default: false },
  },

  // Billing history
  lastPaymentAt: { type: Date },
  lastPaymentAmount: { type: Number },
}, { timestamps: true });

// Auto-set period end to 30 days from start if not explicitly set
subscriptionSchema.pre('save', function (next) {
  if (this.isModified('currentPeriodStart') && !this.currentPeriodEnd) {
    this.currentPeriodEnd = new Date(this.currentPeriodStart.getTime() + 30 * 24 * 60 * 60 * 1000);
  }
  next();
});

module.exports = mongoose.model('Subscription', subscriptionSchema);
