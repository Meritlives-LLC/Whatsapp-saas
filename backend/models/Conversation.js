const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  direction: { type: String, enum: ['inbound', 'outbound'], required: true },
  type: { type: String, enum: ['text', 'button', 'list', 'image', 'document'], default: 'text' },
  content: { type: String, required: true },
  whatsappMessageId: { type: String },
  sentBy: { type: String, enum: ['ai', 'human', 'system'], default: 'ai' },
  status: { type: String, enum: ['sent', 'delivered', 'read', 'failed'], default: 'sent' },
  timestamp: { type: Date, default: Date.now },
});

const conversationSchema = new mongoose.Schema({
  business: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true },
  customerPhone: { type: String, required: true },
  customerName: { type: String, default: 'Unknown' },
  customerEmail: { type: String },
  customerInterest: { type: String },

  messages: [messageSchema],

  status: { type: String, enum: ['open', 'pending', 'closed'], default: 'open' },
  isLead: { type: Boolean, default: false },
  lastMessageAt: { type: Date, default: Date.now },
  followUpSent: { type: Boolean, default: false },
  followUpAt: { type: Date },

  tags: [String],
  notes: { type: String },
}, { timestamps: true });

// Index for fast queries
conversationSchema.index({ business: 1, customerPhone: 1 }, { unique: true });
conversationSchema.index({ business: 1, status: 1 });
conversationSchema.index({ lastMessageAt: -1 });

module.exports = mongoose.model('Conversation', conversationSchema);
