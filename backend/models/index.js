const mongoose = require('mongoose');

// ─── Product ────────────────────────────────────────────────────────────────
const productSchema = new mongoose.Schema({
  business:    { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true },
  name:        { type: String, required: true },
  description: { type: String },
  price:       { type: Number, required: true },
  currency:    { type: String, default: 'NGN' },
  category:    { type: String },
  imageUrl:    { type: String },
  isAvailable: { type: Boolean, default: true },
  paymentLink: { type: String },
}, { timestamps: true });

// ─── Appointment ─────────────────────────────────────────────────────────────
const appointmentSchema = new mongoose.Schema({
  business:     { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true },
  conversation: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation' },
  customerPhone:{ type: String, required: true },
  customerName: { type: String },
  service:      { type: String },
  scheduledAt:  { type: Date, required: true },
  duration:     { type: Number, default: 60 },
  status:       { type: String, enum: ['pending','confirmed','cancelled','completed'], default: 'pending' },
  notes:        { type: String },
  reminderSent: { type: Boolean, default: false },
}, { timestamps: true });

// ─── Transaction ─────────────────────────────────────────────────────────────
const transactionSchema = new mongoose.Schema({
  business:         { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true },
  conversation:     { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation' },
  customerPhone:    { type: String },
  customerName:     { type: String },
  customerEmail:    { type: String },
  customerBankAccount: { type: String },  // account number for bank transfer
  customerBankCode:    { type: String },  // bank code for bank transfer
  amount:           { type: Number, required: true },
  currency:         { type: String, default: 'NGN' },
  reference:        { type: String, unique: true },
  paystackReference:{ type: String },
  paymentLink:      { type: String },
  paymentMethod:    { type: String, enum: ['card','bank_transfer','ussd','qr','mobile_money'], default: 'card' },
  status:           { type: String, enum: ['pending','success','failed','abandoned'], default: 'pending' },
  product:          { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  paidAt:           { type: Date },
  metadata:         { type: mongoose.Schema.Types.Mixed },
}, { timestamps: true });

// ─── BankAccount (saved recipient accounts for transfers) ────────────────────
const bankAccountSchema = new mongoose.Schema({
  business:      { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true },
  accountName:   { type: String, required: true },
  accountNumber: { type: String, required: true },
  bankCode:      { type: String, required: true },
  bankName:      { type: String, required: true },
  recipientCode: { type: String },  // Paystack recipient code for transfers
  isDefault:     { type: Boolean, default: false },
}, { timestamps: true });

module.exports = {
  Product:     mongoose.model('Product',     productSchema),
  Appointment: mongoose.model('Appointment', appointmentSchema),
  Transaction: mongoose.model('Transaction', transactionSchema),
  BankAccount: mongoose.model('BankAccount', bankAccountSchema),
};
