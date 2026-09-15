// backend/utils/crypto.js
// AES-256-GCM helpers used to encrypt sensitive fields (e.g. WhatsApp access
// tokens) at rest in MongoDB. Requires a 32-byte key in ENCRYPTION_KEY,
// provided as a 64-character hex string.
//
// Generate one with:
//   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

const crypto = require('crypto');
const logger = require('../config/logger');

const ALGO = 'aes-256-gcm';

/**
 * Validate a candidate ENCRYPTION_KEY value.
 * Must be a 64-character hex string (32 bytes) for aes-256-gcm.
 * Returns the decoded Buffer on success, or null if invalid/missing.
 * Never logs the key itself.
 */
function validateEncryptionKey(rawKey) {
  if (!rawKey || typeof rawKey !== 'string') return null;
  if (!/^[0-9a-fA-F]{64}$/.test(rawKey)) return null;
  const buf = Buffer.from(rawKey, 'hex');
  return buf.length === 32 ? buf : null;
}

// Resolved once at module load. Deliberately NOT lazily re-read per-call —
// this is what lets server.js validate the exact same value at startup
// (see requireValidEncryptionKeyOrExit()) and guarantee the process either
// boots with working encryption or doesn't boot at all.
let KEY = validateEncryptionKey(process.env.ENCRYPTION_KEY);
if (process.env.ENCRYPTION_KEY && !KEY) {
  // Value is present but malformed. Do NOT fall back to plaintext storage —
  // encrypt() below throws instead. This is intentionally also logged here
  // (in addition to the server.js startup check) so any code path that
  // requires this module directly, e.g. in tests, still surfaces the problem.
  logger.error('ENCRYPTION_KEY is set but is not a valid 64-character hex string (32 bytes). Encryption is disabled until this is fixed — sensitive fields will fail to save rather than being stored as plaintext.');
}

/**
 * Encrypt a plaintext string.
 *
 * FAIL-CLOSED: if no valid ENCRYPTION_KEY is configured, this throws rather
 * than silently returning the plaintext. A WhatsApp access token (or other
 * sensitive field) must never be written to MongoDB unencrypted just because
 * the server was misconfigured — better to fail the save loudly than to
 * leak a live credential into the database in cleartext.
 */
function encrypt(text) {
  if (text === undefined || text === null || text === '') return text;
  if (typeof text !== 'string') text = String(text);
  if (text.startsWith('enc:')) return text; // already encrypted, don't double-encrypt

  if (!KEY) {
    throw new Error(
      'Cannot store sensitive field: ENCRYPTION_KEY is missing or invalid. Refusing to fall back to plaintext.'
    );
  }

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, KEY, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `enc:${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Decrypt a value produced by encrypt(). Values that don't carry the "enc:"
 * prefix are assumed to be legacy plaintext (written before encryption was
 * added) and are returned as-is, so existing rows keep working until they're
 * next re-saved. This is a read-path compatibility allowance only — it does
 * not affect the fail-closed behavior of encrypt() above, and it never
 * causes a plaintext value to be written back out as plaintext.
 *
 * Corrupted or tampered ciphertext (wrong auth tag, truncated data, etc.)
 * fails closed: returns null rather than throwing partial/garbage bytes or
 * ever falling back to treating the ciphertext blob as if it were plaintext.
 */
function decrypt(value) {
  if (!value || typeof value !== 'string') return value;
  if (!value.startsWith('enc:')) return value; // legacy plaintext, pre-dates encryption
  if (!KEY) {
    logger.error('Cannot decrypt sensitive field: ENCRYPTION_KEY is missing or invalid.');
    return null;
  }

  try {
    const [, ivHex, tagHex, dataHex] = value.split(':');
    if (!ivHex || !tagHex || !dataHex) throw new Error('Malformed ciphertext');
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(tagHex, 'hex');
    const data = Buffer.from(dataHex, 'hex');

    const decipher = crypto.createDecipheriv(ALGO, KEY, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
    return decrypted.toString('utf8');
  } catch (err) {
    // Never log the ciphertext or key material — only the generic reason.
    logger.error(`Decrypt failed (corrupted or tampered ciphertext): ${err.message}`);
    return null;
  }
}

/** True if a valid ENCRYPTION_KEY is currently loaded. */
function isEncryptionConfigured() {
  return KEY !== null;
}

module.exports = { encrypt, decrypt, validateEncryptionKey, isEncryptionConfigured };
