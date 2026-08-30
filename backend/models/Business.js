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
  // Encrypted at rest (see utils/crypto.js). The set/get run transparently:
  // application code reading `business.whatsappAccessToken` still gets the
  // plaintext token; only the DB document stores ciphertext.
  whatsappAccessToken: {
    type: String,
    set: encrypt,
    get: decrypt,
  },
  whatsappVerifyToken: { type: String },

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
      return ret;
    },
  },
});

module.exports = mongoose.model('Business', businessSchema);