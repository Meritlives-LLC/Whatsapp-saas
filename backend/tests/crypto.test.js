// backend/tests/crypto.test.js
//
// Covers the fail-closed contract of utils/crypto.js: encrypt() must NEVER
// silently fall back to storing plaintext when ENCRYPTION_KEY is missing or
// malformed, and decrypt() must never turn corrupted/tampered ciphertext
// into a false plaintext value.
//
// Each test resets the module registry and re-requires the module so the
// module-load-time KEY validation (which reads process.env.ENCRYPTION_KEY
// once, at require time) is re-evaluated per test case.

const VALID_KEY = 'a'.repeat(64); // 32 bytes, valid hex
const OLD_ENV = process.env;

function freshCryptoModule(envOverrides) {
  jest.resetModules();
  process.env = { ...OLD_ENV, ...envOverrides };
  return require('../utils/crypto');
}

afterAll(() => {
  process.env = OLD_ENV;
});

describe('crypto utils — validateEncryptionKey', () => {
  const { validateEncryptionKey } = freshCryptoModule({ ENCRYPTION_KEY: VALID_KEY });

  test('accepts a valid 64-char hex string', () => {
    expect(validateEncryptionKey(VALID_KEY)).not.toBeNull();
    expect(validateEncryptionKey(VALID_KEY).length).toBe(32);
  });

  test('rejects missing/undefined/empty values', () => {
    expect(validateEncryptionKey(undefined)).toBeNull();
    expect(validateEncryptionKey('')).toBeNull();
  });

  test('rejects a key that is too short', () => {
    expect(validateEncryptionKey('a'.repeat(32))).toBeNull();
  });

  test('rejects a key that is too long', () => {
    expect(validateEncryptionKey('a'.repeat(128))).toBeNull();
  });

  test('rejects non-hex characters', () => {
    expect(validateEncryptionKey('z'.repeat(64))).toBeNull();
  });
});

describe('crypto utils — valid key configured', () => {
  let crypto;
  beforeEach(() => {
    crypto = freshCryptoModule({ ENCRYPTION_KEY: VALID_KEY });
  });

  test('isEncryptionConfigured() is true', () => {
    expect(crypto.isEncryptionConfigured()).toBe(true);
  });

  test('encrypt/decrypt round-trips a value', () => {
    const plaintext = 'EAAG_super_secret_whatsapp_access_token';
    const ciphertext = crypto.encrypt(plaintext);

    expect(ciphertext).not.toBe(plaintext);
    expect(ciphertext.startsWith('enc:')).toBe(true);
    expect(crypto.decrypt(ciphertext)).toBe(plaintext);
  });

  test('encrypt() produces different ciphertext for the same plaintext each time (random IV)', () => {
    const a = crypto.encrypt('same-value');
    const b = crypto.encrypt('same-value');
    expect(a).not.toBe(b);
    expect(crypto.decrypt(a)).toBe('same-value');
    expect(crypto.decrypt(b)).toBe('same-value');
  });

  test('encrypt() passes through null/undefined/empty string unchanged', () => {
    expect(crypto.encrypt(null)).toBeNull();
    expect(crypto.encrypt(undefined)).toBeUndefined();
    expect(crypto.encrypt('')).toBe('');
  });

  test('encrypt() does not double-encrypt an already-encrypted value', () => {
    const once = crypto.encrypt('token-123');
    const twice = crypto.encrypt(once);
    expect(twice).toBe(once);
  });

  test('decrypt() returns legacy plaintext (no "enc:" prefix) unchanged', () => {
    expect(crypto.decrypt('plain-legacy-token')).toBe('plain-legacy-token');
  });

  test('decrypt() fails closed on corrupted ciphertext (truncated data)', () => {
    const ciphertext = crypto.encrypt('a-token');
    const corrupted = ciphertext.slice(0, -4); // chop off part of the encrypted payload
    expect(crypto.decrypt(corrupted)).toBeNull();
  });

  test('decrypt() fails closed on tampered ciphertext (auth tag no longer matches)', () => {
    const ciphertext = crypto.encrypt('a-token');
    const [prefix, iv, tag, data] = ciphertext.split(':');
    // Flip a hex character in the actual encrypted data segment.
    const tamperedChar = data[0] === '0' ? '1' : '0';
    const tamperedData = tamperedChar + data.slice(1);
    const tampered = [prefix, iv, tag, tamperedData].join(':');

    expect(crypto.decrypt(tampered)).toBeNull();
  });

  test('decrypt() fails closed on a tampered IV', () => {
    const ciphertext = crypto.encrypt('a-token');
    const [prefix, iv, tag, data] = ciphertext.split(':');
    const tamperedIv = (iv[0] === '0' ? '1' : '0') + iv.slice(1);
    const tampered = [prefix, tamperedIv, tag, data].join(':');

    expect(crypto.decrypt(tampered)).toBeNull();
  });

  test('decrypt() fails closed on malformed ciphertext missing segments', () => {
    expect(crypto.decrypt('enc:onlyoneseg')).toBeNull();
  });
});

describe('crypto utils — ENCRYPTION_KEY missing (fail-closed, no plaintext fallback)', () => {
  let crypto;
  beforeEach(() => {
    crypto = freshCryptoModule({ ENCRYPTION_KEY: undefined });
    delete process.env.ENCRYPTION_KEY;
    jest.resetModules();
    crypto = require('../utils/crypto');
  });

  test('isEncryptionConfigured() is false', () => {
    expect(crypto.isEncryptionConfigured()).toBe(false);
  });

  test('encrypt() throws instead of returning plaintext', () => {
    expect(() => crypto.encrypt('super-secret-token')).toThrow(/ENCRYPTION_KEY/i);
  });

  test('encrypt() never returns the raw plaintext value on failure', () => {
    let thrown = null;
    try {
      crypto.encrypt('super-secret-token');
    } catch (err) {
      thrown = err;
    }
    expect(thrown).not.toBeNull();
    // Whatever we threw must not itself be the plaintext (i.e. we didn't
    // "return" it through an exception path either).
    expect(String(thrown)).not.toContain('super-secret-token');
  });

  test('decrypt() of a previously-encrypted value returns null, not garbage/plaintext', () => {
    // Simulate a value that was encrypted earlier when a key WAS configured.
    const withKey = freshCryptoModule({ ENCRYPTION_KEY: VALID_KEY });
    const ciphertext = withKey.encrypt('a-token');

    jest.resetModules();
    delete process.env.ENCRYPTION_KEY;
    const withoutKey = require('../utils/crypto');
    expect(withoutKey.decrypt(ciphertext)).toBeNull();
  });

  test('decrypt() still returns legacy plaintext as-is (no key needed for pre-encryption rows)', () => {
    expect(crypto.decrypt('legacy-plaintext-value')).toBe('legacy-plaintext-value');
  });
});

describe('crypto utils — ENCRYPTION_KEY present but invalid (fail-closed, no plaintext fallback)', () => {
  let crypto;
  beforeEach(() => {
    crypto = freshCryptoModule({ ENCRYPTION_KEY: 'not-a-valid-hex-key' });
  });

  test('isEncryptionConfigured() is false', () => {
    expect(crypto.isEncryptionConfigured()).toBe(false);
  });

  test('encrypt() throws instead of returning plaintext', () => {
    expect(() => crypto.encrypt('super-secret-token')).toThrow(/ENCRYPTION_KEY/i);
  });

  test('decrypt() of a valid ciphertext returns null (cannot decrypt with a bad key)', () => {
    const withKey = freshCryptoModule({ ENCRYPTION_KEY: VALID_KEY });
    const ciphertext = withKey.encrypt('a-token');

    jest.resetModules();
    process.env = { ...OLD_ENV, ENCRYPTION_KEY: 'not-a-valid-hex-key' };
    const withBadKey = require('../utils/crypto');
    expect(withBadKey.decrypt(ciphertext)).toBeNull();
  });
});
