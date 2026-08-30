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

let KEY = null;
if (process.env.ENCRYPTION_KEY) {
  const buf = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');
  if (buf.length === 32) {
    KEY = buf;
  } else {
    logger.error('ENCRYPTION_KEY must be a 64-character hex string (32 bytes). Encryption disabled.');
  }
}

/**
 * Encrypt a plaintext string. Returns the original value unchanged if
 * empty/nullish, or if no valid ENCRYPTION_KEY is configured (dev fallback —
 * a warning is logged so this isn't silently insecure in production).
 */
function encrypt(text) {
  if (text === undefined || text === null || text === '') return text;
  if (typeof text !== 'string') text = String(text);
  if (text.startsWith('enc:')) return text; // already encrypted, don't double-encrypt
  if (!KEY) {
    logger.warn('ENCRYPTION_KEY not configured — storing sensitive field as plaintext');
    return text;
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
 * next re-saved.
 */
function decrypt(value) {
  if (!value || typeof value !== 'string') return value;
  if (!value.startsWith('enc:')) return value; // legacy plaintext
  if (!KEY) {
    logger.error('Cannot decrypt: ENCRYPTION_KEY not configured');
    return null;
  }

  try {
    const [, ivHex, tagHex, dataHex] = value.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(tagHex, 'hex');
    const data = Buffer.from(dataHex, 'hex');

    const decipher = crypto.createDecipheriv(ALGO, KEY, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
    return decrypted.toString('utf8');
  } catch (err) {
    logger.error(`Decrypt failed: ${err.message}`);
    return null;
  }
}

module.exports = { encrypt, decrypt };
