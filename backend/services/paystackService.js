const axios = require('axios');
const crypto = require('crypto');
const logger = require('../config/logger');

const BASE = 'https://api.paystack.co';

const headers = () => ({
  Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
  'Content-Type': 'application/json',
});

// ─── Idempotency store (prevent duplicate webhook processing) ─────────────
const processedRefs = new Set();
const isAlreadyProcessed = (ref) => {
  if (processedRefs.has(ref)) return true;
  processedRefs.add(ref);
  // Auto-clean after 24h to prevent memory growth
  setTimeout(() => processedRefs.delete(ref), 24 * 60 * 60 * 1000);
  return false;
};

// ── TRANSACTIONS ─────────────────────────────────────────────────────────────

/**
 * Initialize a payment — supports card, bank transfer, USSD, mobile money
 * channels: ['card'] | ['bank_transfer'] | ['card','bank_transfer'] etc.
 */
const initializePayment = async ({
  email, amount, reference, metadata = {}, callbackUrl, channels
}) => {
  const payload = {
    email,
    amount: Math.round(amount * 100), // kobo
    reference,
    metadata,
    callback_url: callbackUrl || `${process.env.FRONTEND_URL}/payment/verify`,
  };

  // If specific channels requested, pass them
  if (channels && channels.length > 0) {
    payload.channels = channels;
  }

  const response = await axios.post(`${BASE}/transaction/initialize`, payload, { headers: headers() });
  logger.info(`Payment initialized: ${reference} — ₦${amount}`);
  return response.data.data; // { authorization_url, access_code, reference }
};

/**
 * Verify a transaction
 */
const verifyPayment = async (reference) => {
  const response = await axios.get(`${BASE}/transaction/verify/${reference}`, { headers: headers() });
  return response.data.data;
};

/**
 * Validate Paystack webhook HMAC signature
 */
const validateWebhookSignature = (rawBody, signature) => {
  // rawBody must be the raw Buffer/string, not parsed JSON
  const body = typeof rawBody === 'object' && !Buffer.isBuffer(rawBody)
    ? JSON.stringify(rawBody)
    : rawBody;

  const hash = crypto
    .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
    .update(body)
    .digest('hex');
  return hash === signature;
};

/**
 * Generate unique payment reference
 */
const generateReference = (prefix = 'WA') =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

// ── BANK TRANSFER ─────────────────────────────────────────────────────────────

/**
 * Get list of all Nigerian banks from Paystack
 */
const getBanks = async () => {
  const response = await axios.get(`${BASE}/bank?country=nigeria&perPage=100`, { headers: headers() });
  return response.data.data; // array of { name, slug, code, ... }
};

/**
 * Verify a bank account number and return account name
 */
const verifyBankAccount = async (accountNumber, bankCode) => {
  const response = await axios.get(
    `${BASE}/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`,
    { headers: headers() }
  );
  return response.data.data; // { account_number, account_name, bank_id }
};

/**
 * Create a transfer recipient (save for future transfers)
 */
const createTransferRecipient = async ({ accountName, accountNumber, bankCode }) => {
  const response = await axios.post(`${BASE}/transferrecipient`, {
    type: 'nuban',
    name: accountName,
    account_number: accountNumber,
    bank_code: bankCode,
    currency: 'NGN',
  }, { headers: headers() });
  return response.data.data; // { recipient_code, ... }
};

/**
 * Initiate a transfer to a bank account
 * (Used to pay out to business owners if your platform collects money)
 */
const initiateTransfer = async ({ amount, recipientCode, reason, reference }) => {
  const response = await axios.post(`${BASE}/transfer`, {
    source: 'balance',
    amount: Math.round(amount * 100), // kobo
    recipient: recipientCode,
    reason: reason || 'WA AutoBot Payout',
    reference: reference || generateReference('TRF'),
  }, { headers: headers() });
  logger.info(`Transfer initiated: ₦${amount} to ${recipientCode}`);
  return response.data.data;
};

/**
 * Verify a transfer status
 */
const verifyTransfer = async (reference) => {
  const response = await axios.get(`${BASE}/transfer/verify/${reference}`, { headers: headers() });
  return response.data.data;
};

/**
 * Initialize payment with bank transfer channel only
 * Returns virtual account details for the customer to pay into
 */
const initializeBankTransfer = async ({ email, amount, reference, metadata, customerName }) => {
  return await initializePayment({
    email,
    amount,
    reference,
    metadata: { ...metadata, customerName },
    channels: ['bank_transfer'],
  });
};

/**
 * Initialize payment accepting all channels (card + bank transfer + USSD)
 */
const initializeAllChannels = async ({ email, amount, reference, metadata }) => {
  return await initializePayment({
    email,
    amount,
    reference,
    metadata,
    channels: ['card', 'bank_transfer', 'ussd', 'mobile_money', 'qr'],
  });
};

module.exports = {
  initializePayment,
  initializeBankTransfer,
  initializeAllChannels,
  verifyPayment,
  validateWebhookSignature,
  generateReference,
  getBanks,
  verifyBankAccount,
  createTransferRecipient,
  initiateTransfer,
  verifyTransfer,
  isAlreadyProcessed,
};
