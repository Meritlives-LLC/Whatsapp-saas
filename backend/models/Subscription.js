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

  // Usage tracking (resets monthly)
  usage: {
    aiRepliesCount:   { type: Number,  default: 0 },
    usagePeriodStart: { type: Date,    default: Date.now },
    // resetAt is used by the cron job to know when to reset the counter
    resetAt:          { type: Date,    default: () => new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1) },
    // Prevent the 80% warning email from firing on every cron run
    warningEmailSent: { type: Boolean, default: false },
  },

  // Billing history reference
  lastPaymentAt: { type: Date },
  lastPaymentAmount: { type: Number },
}, { timestamps: true });

// Auto-set period end to 30 days from start if not set
subscriptionSchema.pre('save', function (next) {
  if (this.isModified('currentPeriodStart') && !this.currentPeriodEnd) {
    this.currentPeriodEnd = new Date(this.currentPeriodStart.getTime() + 30 * 24 * 60 * 60 * 1000);
  }
  next();
});

// Check if usage period needs resetting (monthly)
subscriptionSchema.methods.resetUsageIfNeeded = async function () {
  const now = new Date();
  const periodStart = new Date(this.usage.usagePeriodStart);
  const monthPassed = (now - periodStart) >= 30 * 24 * 60 * 60 * 1000;
  if (monthPassed) {
    this.usage.aiRepliesCount = 0;
    this.usage.usagePeriodStart = now;
    await this.save();
  }
};

module.exports = mongoose.model('Subscription', subscriptionSchema);
