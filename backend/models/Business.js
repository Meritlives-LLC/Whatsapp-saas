const mongoose = require('mongoose');

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
  whatsappAccessToken:   { type: String },
  whatsappVerifyToken:   { type: String },

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
}, { timestamps: true });

module.exports = mongoose.model('Business', businessSchema);