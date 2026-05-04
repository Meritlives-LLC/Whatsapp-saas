const mongoose = require('mongoose');
const logger = require('./logger');

/**
 * Create all MongoDB indexes for production performance.
 * Called once after DB connects.
 */
const createIndexes = async () => {
  try {
    const db = mongoose.connection.db;

    // ── Users ─────────────────────────────────────────────────────────────
    await db.collection('users').createIndexes([
      { key: { email: 1 }, unique: true },
      { key: { role: 1 } },
      { key: { createdAt: -1 } },
      { key: { passwordResetToken: 1 }, sparse: true },
    ]);

    // ── Businesses ────────────────────────────────────────────────────────
    await db.collection('businesses').createIndexes([
      { key: { owner: 1 }, unique: true },
      { key: { whatsappPhoneNumberId: 1 }, sparse: true },
    ]);

    // ── Conversations ─────────────────────────────────────────────────────
    await db.collection('conversations').createIndexes([
      { key: { business: 1, customerPhone: 1 }, unique: true },
      { key: { business: 1, status: 1 } },
      { key: { business: 1, isLead: 1 } },
      { key: { lastMessageAt: -1 } },
      { key: { business: 1, lastMessageAt: -1 } },
    ]);

    // ── Subscriptions ─────────────────────────────────────────────────────
    await db.collection('subscriptions').createIndexes([
      { key: { business: 1 }, unique: true },
      { key: { status: 1 } },
      { key: { plan: 1 } },
      { key: { currentPeriodEnd: 1 } },
      { key: { paystackSubscriptionCode: 1 }, sparse: true },
    ]);

    // ── Transactions ──────────────────────────────────────────────────────
    await db.collection('transactions').createIndexes([
      { key: { business: 1, createdAt: -1 } },
      { key: { reference: 1 }, unique: true },
      { key: { status: 1 } },
    ]);

    // ── Appointments ──────────────────────────────────────────────────────
    await db.collection('appointments').createIndexes([
      { key: { business: 1, scheduledAt: 1 } },
      { key: { status: 1 } },
      { key: { reminderSent: 1, scheduledAt: 1 } },
    ]);

    logger.info('✅ MongoDB indexes created/verified');
  } catch (err) {
    // Index creation errors are non-fatal (they may already exist)
    logger.warn(`Index creation warning: ${err.message}`);
  }
};

module.exports = createIndexes;
