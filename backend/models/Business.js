const mongoose = require('mongoose');
const { encrypt, decrypt } = require('../utils/crypto');

const businessSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true },
  description: { type: String },
  phone: { type: String },
  email: { type: String },
  website: { type: String },
  industry: { type: String },

  // WhatsApp Config
  whatsappPhoneNumberId: { type: String },
  // The WhatsApp Business Account (WABA) that owns whatsappPhoneNumberId.
  // Needed to subscribe this app to the customer's webhooks
  // (POST /{wabaId}/subscribed_apps) and to re-discover phone numbers later.
  whatsappBusinessAccountId: { type: String },
  // Human-readable copies of the phone's identity, for display only — the
  // source of truth is always Meta, looked up via whatsappPhoneNumberId.
  whatsappDisplayNumber: { type: String },
  whatsappVerifiedName: { type: String },
  // Encrypted at rest (see utils/crypto.js). The set/get run transparently:
  // application code reading `business.whatsappAccessToken` still gets the
  // plaintext token; only the DB document stores ciphertext.
  whatsappAccessToken: {
    type: String,
    set: encrypt,
    get: decrypt,
  },
  whatsappVerifyToken: { type: String },
  // The two-step-verification PIN used to register whatsappPhoneNumberId
  // with Cloud API (POST /{phoneNumberId}/register). Kept (encrypted) so a
  // future re-registration doesn't require the customer to reset it.
  whatsappRegistrationPin: {
    type: String,
    set: encrypt,
    get: decrypt,
  },

  // Payment Details (bank transfer)
  paymentDetails: {
    bankName:      { type: String },
    accountNumber: { type: String },
    accountName:   { type: String },
    instructions:  { type: String },
  },

  // AI Knowledge Base
  aiKnowledge: {
    greeting:           { type: String, default: 'Hello! Welcome to our business. How can I help you today?' },
    faqs:               [{ question: String, answer: String }],
    policies:           { type: String },
    workingHours:       { type: String, default: 'Monday - Friday, 9am - 5pm' },
    customInstructions: { type: String },
  },

  // Settings
  settings: {
    autoReply:          { type: Boolean, default: true },
    autoFollowUp:       { type: Boolean, default: true },
    followUpDelayHours: { type: Number,  default: 24 },
    leadCapture:        { type: Boolean, default: true },
  },

  isActive: { type: Boolean, default: true },
}, {
  timestamps: true,
  // Never let the raw or encrypted token leave the server in an API response.
  // Applies whether the document is sent via res.json(business) directly or
  // nested inside another payload (e.g. { data: business }).
  toJSON: {
    transform(doc, ret) {
      delete ret.whatsappAccessToken;
      delete ret.whatsappVerifyToken;
      delete ret.whatsappRegistrationPin;
      return ret;
    },
  },
});

module.exports = mongoose.model('Business', businessSchema);