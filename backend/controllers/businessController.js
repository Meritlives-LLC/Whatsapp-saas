const Business = require('../models/Business');
const { Product, Appointment, Transaction, BankAccount } = require('../models/index');
const Conversation = require('../models/Conversation');
const paystackService = require('../services/paystackService');
const emailService = require('../services/emailService');
const logger = require('../config/logger');
const Subscription = require('../models/Subscription');
const { getPlan } = require('../config/plans');

// ─── BUSINESS ────────────────────────────────────────────────────────────────
exports.getBusiness = async (req, res) => {
  try {
    const business = await Business.findById(req.user.business._id);
    res.json({ success: true, data: business });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateBusiness = async (req, res) => {
  try {
    // Whitelist: only allow safe fields. Never let users touch owner, isActive, or WhatsApp tokens here.
    // whatsappAccessToken is intentionally excluded — it must only be written by the Meta OAuth callback.
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
      req.user.business._id,
      { $set: update },
      { new: true, runValidators: true }
    );
    res.json({ success: true, data: business });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── PRODUCTS ─────────────────────────────────────────────────────────────────
exports.getProducts = async (req, res) => {
  try {
    const products = await Product.find({ business: req.user.business._id }).sort({ createdAt: -1 });
    res.json({ success: true, data: products });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.createProduct = async (req, res) => {
  try {
    // Enforce plan product limit
    const sub = await Subscription.findOne({ business: req.user.business._id });
    const plan = getPlan(sub?.plan || 'free');
    const productCount = await Product.countDocuments({ business: req.user.business._id });
    if (productCount >= plan.limits.products) {
      return res.status(403).json({
        success: false,
        message: `Your ${plan.name} plan allows up to ${plan.limits.products} products. Upgrade to add more.`,
        upgradeRequired: true,
      });
    }
    const product = await Product.create({ ...req.body, business: req.user.business._id });
    res.status(201).json({ success: true, data: product });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateProduct = async (req, res) => {
  try {
    const product = await Product.findOneAndUpdate(
      { _id: req.params.id, business: req.user.business._id },
      req.body, { new: true }
    );
    res.json({ success: true, data: product });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteProduct = async (req, res) => {
  try {
    await Product.findOneAndDelete({ _id: req.params.id, business: req.user.business._id });
    res.json({ success: true, message: 'Product deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── APPOINTMENTS ──────────────────────────────────────────────────────────────
exports.getAppointments = async (req, res) => {
  try {
    const appointments = await Appointment.find({ business: req.user.business._id }).sort({ scheduledAt: 1 });
    res.json({ success: true, data: appointments });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateAppointment = async (req, res) => {
  try {
    const appointment = await Appointment.findOneAndUpdate(
      { _id: req.params.id, business: req.user.business._id },
      req.body, { new: true }
    );
    res.json({ success: true, data: appointment });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── PAYMENTS — Card ──────────────────────────────────────────────────────────
exports.createPaymentLink = async (req, res) => {
  try {
    const { customerEmail, amount, customerName, productId, conversationId, paymentMethod } = req.body;

    if (!customerEmail || !amount) {
      return res.status(400).json({ success: false, message: 'Customer email and amount are required' });
    }

    const reference = paystackService.generateReference('WA');

    // Choose payment method
    let result;
    let resolvedMethod;
    if (paymentMethod === 'bank_transfer') {
      result = await paystackService.initializeBankTransfer({
        email: customerEmail, amount, reference,
        customerName,
        metadata: { customerName, businessId: req.user.business._id, productId },
      });
      resolvedMethod = 'bank_transfer';
    } else if (paymentMethod === 'card') {
      // Card only — restrict channels to card
      result = await paystackService.initializePayment({
        email: customerEmail, amount, reference,
        metadata: { customerName, businessId: req.user.business._id, productId },
        channels: ['card'],
      });
      resolvedMethod = 'card';
    } else {
      // Default: all channels (card + bank transfer + USSD etc.)
      result = await paystackService.initializeAllChannels({
        email: customerEmail, amount, reference,
        metadata: { customerName, businessId: req.user.business._id, productId },
      });
      resolvedMethod = 'card'; // default label
    }

    await Transaction.create({
      business: req.user.business._id,
      conversation: conversationId || null,
      customerEmail, customerName, amount, reference,
      paystackReference: result.reference,
      paymentLink: result.authorization_url,
      paymentMethod: resolvedMethod,
      product: productId || null,
    });

    logger.info(`Payment link created: ${reference} ₦${amount} for ${customerEmail}`);
    res.json({ success: true, data: { paymentLink: result.authorization_url, reference } });
  } catch (err) {
    logger.error(`Create payment link error: ${err.message}`);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── PAYMENTS — Bank Transfer specific ───────────────────────────────────────

/** Get list of Nigerian banks */
exports.getBanks = async (req, res) => {
  try {
    const banks = await paystackService.getBanks();
    res.json({ success: true, data: banks });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Could not fetch banks. Try again.' });
  }
};

/** Verify customer bank account (name lookup) */
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

/** Save business payout bank account */
exports.saveBankAccount = async (req, res) => {
  try {
    const { accountName, accountNumber, bankCode, bankName, isDefault } = req.body;

    if (!accountName || !accountNumber || !bankCode || !bankName) {
      return res.status(400).json({ success: false, message: 'All bank account fields are required' });
    }

    // Create Paystack recipient for future payouts
    let recipientCode = null;
    try {
      const recipient = await paystackService.createTransferRecipient({ accountName, accountNumber, bankCode });
      recipientCode = recipient.recipient_code;
    } catch (e) {
      logger.warn(`Could not create Paystack recipient: ${e.message}`);
    }

    // If setting as default, unset others
    if (isDefault) {
      await BankAccount.updateMany({ business: req.user.business._id }, { isDefault: false });
    }

    const account = await BankAccount.create({
      business: req.user.business._id,
      accountName, accountNumber, bankCode, bankName,
      recipientCode, isDefault: !!isDefault,
    });

    res.status(201).json({ success: true, data: account });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/** Get saved bank accounts */
exports.getBankAccounts = async (req, res) => {
  try {
    const accounts = await BankAccount.find({ business: req.user.business._id }).sort({ isDefault: -1, createdAt: -1 });
    res.json({ success: true, data: accounts });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/** Delete a saved bank account */
exports.deleteBankAccount = async (req, res) => {
  try {
    const deleted = await BankAccount.findOneAndDelete({ _id: req.params.id, business: req.user.business._id });
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Bank account not found' });
    }
    res.json({ success: true, message: 'Bank account removed' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── PAYMENTS — Paystack Webhook ─────────────────────────────────────────────
exports.paystackWebhook = async (req, res) => {
  try {
    const signature = req.headers['x-paystack-signature'];
    const rawBody = req.body; // raw buffer from express.raw()

    if (!paystackService.validateWebhookSignature(rawBody, signature)) {
      logger.warn('Paystack webhook: invalid signature');
      return res.status(401).send('Invalid signature');
    }

    // Parse body (it's a Buffer from express.raw)
    const payload = JSON.parse(rawBody.toString());
    const { event, data } = payload;

    // Idempotency — don't process same ref twice
    const webhookRef = data.reference || data.subscription_code || data.transfer_code || JSON.stringify(data).slice(0, 40);
    if (paystackService.isAlreadyProcessed(webhookRef)) {
      logger.info(`Webhook duplicate skipped: ${webhookRef}`);
      return res.status(200).send('OK');
    }

    res.status(200).send('OK'); // respond immediately

    logger.info(`Paystack webhook: ${event} — ${data.reference}`);

    if (event === 'charge.success') {
      const tx = await Transaction.findOneAndUpdate(
        { reference: data.reference },
        {
          status: 'success',
          paidAt: new Date(),
          paymentMethod: data.channel || 'card',
          metadata: data,
        },
        { new: true }
      ).populate('business');

      if (tx?.customerEmail && tx?.business) {
        // Send payment receipt email
        await emailService.sendPaymentReceiptEmail(
          { email: tx.customerEmail, name: tx.customerName },
          tx.amount,
          tx.reference,
          tx.business.name
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
    logger.error(`Paystack webhook error: ${err.message}`);
  }
};

// ─── TRANSACTIONS ─────────────────────────────────────────────────────────────
exports.getTransactions = async (req, res) => {
  try {
    const { status, paymentMethod, page = 1, limit = 20 } = req.query;
    const filter = { business: req.user.business._id };
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
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── ANALYTICS ────────────────────────────────────────────────────────────────
exports.getAnalytics = async (req, res) => {
  try {
    const businessId = req.user.business._id;

    const [convStats, revenue, recentConvs, paymentBreakdown] = await Promise.all([
      Conversation.aggregate([
        { $match: { business: businessId } },
        { $group: {
            _id: null,
            total: { $sum: 1 },
            open:   { $sum: { $cond: [{ $eq: ['$status', 'open'] }, 1, 0] } },
            closed: { $sum: { $cond: [{ $eq: ['$status', 'closed'] }, 1, 0] } },
            leads:  { $sum: { $cond: ['$isLead', 1, 0] } },
        }},
      ]),
      Transaction.aggregate([
        { $match: { business: businessId, status: 'success' } },
        { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
      ]),
      Conversation.find({ business: businessId })
        .sort({ lastMessageAt: -1 }).limit(7)
        .select('customerName customerPhone status lastMessageAt isLead'),
      Transaction.aggregate([
        { $match: { business: businessId, status: 'success' } },
        { $group: { _id: '$paymentMethod', total: { $sum: '$amount' }, count: { $sum: 1 } } },
      ]),
    ]);

    const stats = convStats[0] || { total: 0, open: 0, closed: 0, leads: 0 };
    const revenueData = revenue[0] || { total: 0, count: 0 };

    res.json({
      success: true,
      data: {
        conversations: stats,
        revenue: revenueData,
        conversionRate: stats.total > 0 ? ((stats.leads / stats.total) * 100).toFixed(1) : 0,
        recentConversations: recentConvs,
        paymentBreakdown,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
