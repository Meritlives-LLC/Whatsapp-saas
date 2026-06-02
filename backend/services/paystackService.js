const axios = require('axios');
const crypto = require('crypto');
const logger = require('../config/logger');

const BASE = 'https://api.paystack.co';

const headers = () => ({
  Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
  'Content-Type': 'application/json',
});

// Axios instance with 15s timeout — a slow/unreachable Paystack will never
// hang the server and trigger uncaughtException → process.exit(1)
const ax = axios.create({ timeout: 15000 });

// ─── Idempotency store (prevent duplicate webhook processing) ─────────────
const processedRefs = new Map();
const IDEMPOTENCY_TTL = 24 * 60 * 60 * 1000; // 24h
const isAlreadyProcessed = (ref) => {
  if (!ref) return false;
  const now = Date.now();
  for (const [key, ts] of processedRefs) {
    if (now - ts > IDEMPOTENCY_TTL) processedRefs.delete(key);
  }
  if (processedRefs.has(ref)) return true;
  processedRefs.set(ref, now);
  return false;
};

// ─── Bank list cache ──────────────────────────────────────────────────────
let banksCache = null;
let banksCacheTime = 0;
const BANKS_CACHE_TTL = 60 * 60 * 1000; // 1 hour

// ── TRANSACTIONS ──────────────────────────────────────────────────────────────

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
  if (channels && channels.length > 0) {
    payload.channels = channels;
  }
  const response = await ax.post(`${BASE}/transaction/initialize`, payload, { headers: headers() });
  logger.info(`Payment initialized: ${reference} — ₦${amount}`);
  return response.data.data;
};

const verifyPayment = async (reference) => {
  const response = await ax.get(`${BASE}/transaction/verify/${reference}`, { headers: headers() });
  return response.data.data;
};

const validateWebhookSignature = (rawBody, signature) => {
  const body = typeof rawBody === 'object' && !Buffer.isBuffer(rawBody)
    ? JSON.stringify(rawBody)
    : rawBody;
  const hash = crypto
    .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
    .update(body)
    .digest('hex');
  return hash === signature;
};

const generateReference = (prefix = 'WA') =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

// ── BANK TRANSFER ─────────────────────────────────────────────────────────────

const getBanks = async () => {
  const now = Date.now();
  if (banksCache && (now - banksCacheTime) < BANKS_CACHE_TTL) {
    return banksCache;
  }
  const response = await ax.get(`${BASE}/bank?country=nigeria&perPage=100`, { headers: headers() });
  banksCache = response.data.data;
  banksCacheTime = now;
  return banksCache;
};

const verifyBankAccount = async (accountNumber, bankCode) => {
  const response = await ax.get(
    `${BASE}/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`,
    { headers: headers() }
  );
  return response.data.data;
};

const createTransferRecipient = async ({ accountName, accountNumber, bankCode }) => {
  const response = await ax.post(`${BASE}/transferrecipient`, {
    type: 'nuban',
    name: accountName,
    account_number: accountNumber,
    bank_code: bankCode,
    currency: 'NGN',
  }, { headers: headers() });
  return response.data.data;
};

const initiateTransfer = async ({ amount, recipientCode, reason, reference }) => {
  const response = await ax.post(`${BASE}/transfer`, {
    source: 'balance',
    amount: Math.round(amount * 100),
    recipient: recipientCode,
    reason: reason || 'WA AutoBot Payout',
    reference: reference || generateReference('TRF'),
  }, { headers: headers() });
  logger.info(`Transfer initiated: ₦${amount} to ${recipientCode}`);
  return response.data.data;
};

const verifyTransfer = async (reference) => {
  const response = await ax.get(`${BASE}/transfer/verify/${reference}`, { headers: headers() });
  return response.data.data;
};

const initializeBankTransfer = async ({ email, amount, reference, metadata, customerName }) => {
  return await initializePayment({
    email, amount, reference,
    metadata: { ...metadata, customerName },
    channels: ['bank_transfer'],
  });
};

const initializeAllChannels = async ({ email, amount, reference, metadata }) => {
  return await initializePayment({
    email, amount, reference, metadata,
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