const Business = require('../models/Business');
const { Product, Appointment, Transaction, BankAccount } = require('../models/index');
const Conversation = require('../models/Conversation');
const paystackService = require('../services/paystackService');
const emailService = require('../services/emailService');
const logger = require('../config/logger');
const Subscription = require('../models/Subscription');
const { getPlan } = require('../config/plans');

// ─── Helper: safely get businessId ───────────────────────────────────────────
const getBizId = (req) => {
  try { return req.user?.business?._id || null; }
  catch { return null; }
};

// ─── BUSINESS ────────────────────────────────────────────────────────────────
exports.getBusiness = async (req, res) => {
  try {
    const bizId = getBizId(req);
    if (!bizId) return res.status(400).json({ success: false, message: 'No business on this account.' });
    const business = await Business.findById(bizId);
    res.json({ success: true, data: business });
  } catch (err) {
    logger.error(`getBusiness: ${err.message}`);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateBusiness = async (req, res) => {
  try {
    const bizId = getBizId(req);
    if (!bizId) return res.status(400).json({ success: false, message: 'No business on this account.' });
    const ALLOWED = [
      'name', 'description', 'phone', 'email', 'website', 'industry',
      'aiKnowledge', 'settings',
      'whatsappPhoneNumberId', 'whatsappVerifyToken',
    ];
    const update = {};
    for (const key of ALLOWED) {
      if (req.body[key] !== undefined) update[key] = req.body[key];
    }
    const business = await Business.findByIdAndUpdate(
      bizId, { $set: update }, { new: true, runValidators: true }
    );
    res.json({ success: true, data: business });
  } catch (err) {
    logger.error(`updateBusiness: ${err.message}`);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── PRODUCTS ─────────────────────────────────────────────────────────────────
exports.getProducts = async (req, res) => {
  try {
    const bizId = getBizId(req);
    if (!bizId) return res.json({ success: true, data: [] });
    const products = await Product.find({ business: bizId }).sort({ createdAt: -1 });
    res.json({ success: true, data: products });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.createProduct = async (req, res) => {
  try {
    const bizId = getBizId(req);
    if (!bizId) return res.status(400).json({ success: false, message: 'No business on this account.' });
    const sub = await Subscription.findOne({ business: bizId });
    const plan = getPlan(sub?.plan || 'free');
    const productCount = await Product.countDocuments({ business: bizId });
    if (productCount >= plan.limits.products) {
      return res.status(403).json({
        success: false,
        message: `Your ${plan.name} plan allows up to ${plan.limits.products} products. Upgrade to add more.`,
        upgradeRequired: true,
      });
    }
    const product = await Product.create({ ...req.body, business: bizId });
    res.status(201).json({ success: true, data: product });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateProduct = async (req, res) => {
  try {
    const bizId = getBizId(req);
    if (!bizId) return res.status(400).json({ success: false, message: 'No business on this account.' });
    const product = await Product.findOneAndUpdate(
      { _id: req.params.id, business: bizId }, req.body, { new: true }
    );
    res.json({ success: true, data: product });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteProduct = async (req, res) => {
  try {
    const bizId = getBizId(req);
    if (!bizId) return res.status(400).json({ success: false, message: 'No business on this account.' });
    await Product.findOneAndDelete({ _id: req.params.id, business: bizId });
    res.json({ success: true, message: 'Product deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── APPOINTMENTS ──────────────────────────────────────────────────────────────
exports.getAppointments = async (req, res) => {
  try {
    const bizId = getBizId(req);
    if (!bizId) return res.json({ success: true, data: [] });
    const appointments = await Appointment.find({ business: bizId }).sort({ scheduledAt: 1 });
    res.json({ success: true, data: appointments });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateAppointment = async (req, res) => {
  try {
    const bizId = getBizId(req);
    if (!bizId) return res.status(400).json({ success: false, message: 'No business on this account.' });
    const appointment = await Appointment.findOneAndUpdate(
      { _id: req.params.id, business: bizId }, req.body, { new: true }
    );
    res.json({ success: true, data: appointment });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── PAYMENTS — Create Link ───────────────────────────────────────────────────
exports.createPaymentLink = async (req, res) => {
  try {
    const bizId = getBizId(req);
    if (!bizId) return res.status(400).json({ success: false, message: 'No business on this account.' });

    const { customerEmail, amount, customerName, productId, conversationId, paymentMethod } = req.body;
    if (!customerEmail || !amount) {
      return res.status(400).json({ success: false, message: 'Customer email and amount are required' });
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Amount must be a valid positive number' });
    }

    const reference = paystackService.generateReference('WA');
    let result;
    let resolvedMethod;

    if (paymentMethod === 'bank_transfer') {
      result = await paystackService.initializeBankTransfer({
        email: customerEmail, amount: parsedAmount, reference,
        customerName,
        metadata: { customerName, businessId: bizId, productId },
      });
      resolvedMethod = 'bank_transfer';
    } else if (paymentMethod === 'card') {
      result = await paystackService.initializePayment({
        email: customerEmail, amount: parsedAmount, reference,
        metadata: { customerName, businessId: bizId, productId },
        channels: ['card'],
      });
      resolvedMethod = 'card';
    } else {
      result = await paystackService.initializeAllChannels({
        email: customerEmail, amount: parsedAmount, reference,
        metadata: { customerName, businessId: bizId, productId },
      });
      resolvedMethod = 'card';
    }

    await Transaction.create({
      business: bizId,
      conversation: conversationId || null,
      customerEmail, customerName, amount: parsedAmount, reference,
      paystackReference: result.reference,
      paymentLink: result.authorization_url,
      paymentMethod: resolvedMethod,
      product: productId || null,
    });

    logger.info(`Payment link created: ${reference} ₦${parsedAmount} for ${customerEmail}`);
    if (!res.headersSent) {
      res.json({ success: true, data: { paymentLink: result.authorization_url, reference } });
    }
  } catch (err) {
    logger.error(`createPaymentLink: ${err.message}\n${err.stack}`);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: 'Payment link creation failed. Check your Paystack configuration.' });
    }
  }
};

// ─── PAYMENTS — Bank Transfer specific ───────────────────────────────────────
exports.getBanks = async (req, res) => {
  try {
    const banks = await paystackService.getBanks();
    res.json({ success: true, data: banks });
  } catch (err) {
    logger.error(`getBanks: ${err.message}`);
    res.status(500).json({ success: false, message: 'Could not fetch banks. Try again.' });
  }
};

exports.verifyBankAccount = async (req, res) => {
  try {
    const { accountNumber, bankCode } = req.query;
    if (!accountNumber || !bankCode) {
      return res.status(400).json({ success: false, message: 'accountNumber and bankCode are required' });
    }
    const data = await paystackService.verifyBankAccount(accountNumber, bankCode);
    res.json({ success: true, data });
  } catch (err) {
    res.status(400).json({ success: false, message: 'Could not verify account. Check the details.' });
  }
};

exports.saveBankAccount = async (req, res) => {
  try {
    const bizId = getBizId(req);
    if (!bizId) return res.status(400).json({ success: false, message: 'No business on this account.' });

    const { accountName, accountNumber, bankCode, bankName, isDefault } = req.body;
    if (!accountName || !accountNumber || !bankCode || !bankName) {
      return res.status(400).json({ success: false, message: 'All bank account fields are required' });
    }

    let recipientCode = null;
    try {
      const recipient = await paystackService.createTransferRecipient({ accountName, accountNumber, bankCode });
      recipientCode = recipient.recipient_code;
    } catch (e) {
      logger.warn(`Could not create Paystack recipient: ${e.message}`);
    }

    if (isDefault) {
      await BankAccount.updateMany({ business: bizId }, { isDefault: false });
    }

    const account = await BankAccount.create({
      business: bizId,
      accountName, accountNumber, bankCode, bankName,
      recipientCode, isDefault: !!isDefault,
    });

    res.status(201).json({ success: true, data: account });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getBankAccounts = async (req, res) => {
  try {
    const bizId = getBizId(req);
    if (!bizId) return res.json({ success: true, data: [] });
    const accounts = await BankAccount.find({ business: bizId }).sort({ isDefault: -1, createdAt: -1 });
    res.json({ success: true, data: accounts });
  } catch (err) {
    logger.error(`getBankAccounts: ${err.message}`);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteBankAccount = async (req, res) => {
  try {
    const bizId = getBizId(req);
    if (!bizId) return res.status(400).json({ success: false, message: 'No business on this account.' });
    const deleted = await BankAccount.findOneAndDelete({ _id: req.params.id, business: bizId });
    if (!deleted) return res.status(404).json({ success: false, message: 'Bank account not found' });
    res.json({ success: true, message: 'Bank account removed' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── PAYMENTS — Paystack Webhook ─────────────────────────────────────────────
exports.paystackWebhook = async (req, res) => {
  try {
    const signature = req.headers['x-paystack-signature'];
    const rawBody = req.body;

    if (!paystackService.validateWebhookSignature(rawBody, signature)) {
      logger.warn('Paystack webhook: invalid signature');
      return res.status(401).send('Invalid signature');
    }

    const payload = JSON.parse(rawBody.toString());
    const { event, data } = payload;

    const webhookRef = data.reference || data.subscription_code || data.transfer_code || JSON.stringify(data).slice(0, 40);
    if (paystackService.isAlreadyProcessed(webhookRef)) {
      logger.info(`Webhook duplicate skipped: ${webhookRef}`);
      return res.status(200).send('OK');
    }

    res.status(200).send('OK');
    logger.info(`Paystack webhook: ${event} — ${data.reference}`);

    if (event === 'charge.success') {
      const tx = await Transaction.findOneAndUpdate(
        { reference: data.reference },
        { status: 'success', paidAt: new Date(), paymentMethod: data.channel || 'card', metadata: data },
        { new: true }
      ).populate('business');

      if (tx?.customerEmail && tx?.business) {
        await emailService.sendPaymentReceiptEmail(
          { email: tx.customerEmail, name: tx.customerName },
          tx.amount, tx.reference, tx.business.name
        ).catch(() => {});
      }
    }

    if (event === 'charge.failed' || event === 'transfer.failed') {
      await Transaction.findOneAndUpdate(
        { reference: data.reference },
        { status: 'failed', metadata: data }
      );
    }

    if (event === 'transfer.success') {
      logger.info(`Transfer successful: ${data.reference}`);
    }
  } catch (err) {
    logger.error(`paystackWebhook: ${err.message}`);
  }
};

// ─── TRANSACTIONS ─────────────────────────────────────────────────────────────
exports.getTransactions = async (req, res) => {
  try {
    const bizId = getBizId(req);
    if (!bizId) return res.json({ success: true, data: [], total: 0 });

    const { status, paymentMethod, page = 1, limit = 20 } = req.query;
    const filter = { business: bizId };
    if (status) filter.status = status;
    if (paymentMethod) filter.paymentMethod = paymentMethod;

    const [transactions, total] = await Promise.all([
      Transaction.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(Number(limit))
        .populate('product', 'name price'),
      Transaction.countDocuments(filter),
    ]);

    res.json({ success: true, data: transactions, total });
  } catch (err) {
    logger.error(`getTransactions: ${err.message}`);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── ANALYTICS ────────────────────────────────────────────────────────────────
exports.getAnalytics = async (req, res) => {
  try {
    const mongoose = require('mongoose');
    const bizId = getBizId(req);

    if (!bizId) {
      return res.json({
        success: true,
        data: {
          conversations: { total: 0, open: 0, closed: 0, leads: 0 },
          revenue: { total: 0, count: 0 },
          conversionRate: 0,
          recentConversations: [],
          paymentBreakdown: [],
          weeklyMessages: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(day => ({ day, messages: 0 })),
        },
      });
    }

    const businessId = new mongoose.Types.ObjectId(String(bizId));

    const safeAgg = async (model, pipeline, label) => {
      try { return await model.aggregate(pipeline); }
      catch (e) { logger.error(`analytics [${label}]: ${e.message}`); return []; }
    };

    const now = new Date();
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(now.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const [convStatsRaw, revenueRaw, recentConvs, paymentBreakdown, weeklyRaw] = await Promise.all([
      safeAgg(Conversation, [
        { $match: { business: businessId } },
        { $group: {
            _id: null,
            total:  { $sum: 1 },
            open:   { $sum: { $cond: [{ $eq: ['$status', 'open'] },   1, 0] } },
            closed: { $sum: { $cond: [{ $eq: ['$status', 'closed'] }, 1, 0] } },
            leads:  { $sum: { $cond: [{ $eq: ['$isLead', true] },     1, 0] } },
        }},
      ], 'convStats'),
      safeAgg(Transaction, [
        { $match: { business: businessId, status: 'success' } },
        { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
      ], 'revenue'),
      Conversation.find({ business: businessId })
        .sort({ lastMessageAt: -1 }).limit(7)
        .select('customerName customerPhone status lastMessageAt isLead')
        .lean()
        .catch(() => []),
      safeAgg(Transaction, [
        { $match: { business: businessId, status: 'success' } },
        { $group: { _id: '$paymentMethod', total: { $sum: '$amount' }, count: { $sum: 1 } } },
      ], 'paymentBreakdown'),
      safeAgg(Conversation, [
        { $match: { business: businessId, lastMessageAt: { $gte: sevenDaysAgo } } },
        { $group: {
            _id: { year: { $year: '$lastMessageAt' }, month: { $month: '$lastMessageAt' }, day: { $dayOfMonth: '$lastMessageAt' } },
            messages: { $sum: 1 },
        }},
      ], 'weeklyMessages'),
    ]);

    const stats       = convStatsRaw[0] || { total: 0, open: 0, closed: 0, leads: 0 };
    const revenueData = revenueRaw[0]   || { total: 0, count: 0 };

    const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const weeklyMap  = {};
    weeklyRaw.forEach(r => {
      if (r._id) weeklyMap[`${r._id.year}-${r._id.month}-${r._id.day}`] = r.messages;
    });
    const weeklyMessages = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      weeklyMessages.push({
        day: DAY_LABELS[d.getDay()],
        messages: weeklyMap[`${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`] || 0,
      });
    }

    return res.json({
      success: true,
      data: {
        conversations: stats,
        revenue: revenueData,
        conversionRate: stats.total > 0 ? parseFloat(((stats.leads / stats.total) * 100).toFixed(1)) : 0,
        recentConversations: recentConvs,
        paymentBreakdown,
        weeklyMessages,
      },
    });
  } catch (err) {
    logger.error(`getAnalytics fatal: ${err.message}\n${err.stack}`);
    return res.status(500).json({ success: false, message: err.message });
  }
};