const mongoose = require('mongoose');
const logger = require('./logger');

const WHATSAPP_PHONE_INDEX_NAME = 'whatsappPhoneNumberId_unique_partial';

/**
 * Enforce the tenant-isolation invariant "one WhatsApp Phone Number ID ->
 * one SaaS Business" at the database level.
 *
 * The webhook handler routes every inbound message with effectively
 * `Business.findOne({ whatsappPhoneNumberId })` — if two Business documents
 * could ever hold the same phone_number_id, one customer's messages could
 * be attributed to another customer's business. A previous version of this
 * index was `{ key: { whatsappPhoneNumberId: 1 }, sparse: true }`, which
 * only kept documents *without* the field out of the index — it never
 * enforced uniqueness at all.
 *
 * A plain `unique: true` index would be wrong here too: many Business
 * documents legitimately have no WhatsApp connection at all (the field is
 * entirely absent, via `$unset` on disconnect — see
 * metaOAuthController.disconnect), and a bare unique index would only ever
 * allow ONE such document across the whole collection. A partial unique
 * index scopes the uniqueness constraint to documents where the field
 * actually holds a value, exactly matching the intended invariant.
 */
async function ensureWhatsappPhoneNumberIdUniqueIndex(db) {
  const collection = db.collection('businesses');
  const existing = await collection.indexes();

  // If an old index on this same key exists with different options (e.g.
  // the previous non-unique sparse index), MongoDB will refuse to create
  // the new one due to an options conflict on the same key pattern. Drop it
  // first so the migration is self-healing on deploy rather than requiring
  // a manual DB migration step.
  const conflicting = existing.find(
    (idx) => idx.name !== WHATSAPP_PHONE_INDEX_NAME
      && idx.key
      && Object.keys(idx.key).length === 1
      && idx.key.whatsappPhoneNumberId === 1
  );
  if (conflicting) {
    logger.warn(`Dropping outdated index "${conflicting.name}" on businesses.whatsappPhoneNumberId before creating the partial unique index`);
    await collection.dropIndex(conflicting.name);
  }

  await collection.createIndex(
    { whatsappPhoneNumberId: 1 },
    {
      name: WHATSAPP_PHONE_INDEX_NAME,
      unique: true,
      // Only documents where the field is an actual string are subject to
      // the uniqueness constraint — documents missing the field (no
      // WhatsApp connection) never conflict with each other.
      partialFilterExpression: { whatsappPhoneNumberId: { $type: 'string' } },
    }
  );
}

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
    ]);
    await ensureWhatsappPhoneNumberIdUniqueIndex(db);

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
