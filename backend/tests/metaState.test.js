const { buildState, verifyState } = require('../utils/metaState');

describe('metaState (classic OAuth redirect state signing)', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...OLD_ENV, JWT_SECRET: 'test-secret-do-not-use-in-prod' };
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  test('round-trips a valid state back to the same userId', () => {
    const userId = '64f0a1b2c3d4e5f678901234';
    const state = buildState(userId);
    expect(verifyState(state)).toBe(userId);
  });

  test('produces a different state each time (nonce)', () => {
    const userId = 'user-123';
    const a = buildState(userId);
    const b = buildState(userId);
    expect(a).not.toBe(b);
    expect(verifyState(a)).toBe(userId);
    expect(verifyState(b)).toBe(userId);
  });

  test('rejects a state whose userId was tampered with (signature no longer matches)', () => {
    const state = buildState('user-A');
    const decoded = Buffer.from(state, 'base64url').toString('utf8');
    const [, nonce, sig] = decoded.split(':');
    const tampered = Buffer.from(`user-B:${nonce}:${sig}`).toString('base64url');

    expect(() => verifyState(tampered)).toThrow(/signature mismatch/i);
  });

  test('rejects a state with a tampered signature', () => {
    const state = buildState('user-A');
    const decoded = Buffer.from(state, 'base64url').toString('utf8');
    const [userId, nonce] = decoded.split(':');
    const tampered = Buffer.from(`${userId}:${nonce}:deadbeef`).toString('base64url');

    expect(() => verifyState(tampered)).toThrow(/signature mismatch/i);
  });

  test('rejects malformed state (missing parts)', () => {
    const malformed = Buffer.from('just-one-part').toString('base64url');
    expect(() => verifyState(malformed)).toThrow(/malformed state/i);
  });

  test('rejects empty/undefined state', () => {
    expect(() => verifyState('')).toThrow(/malformed state/i);
    expect(() => verifyState(undefined)).toThrow(/malformed state/i);
  });

  test('this is exactly the bug that was fixed: the literal string "embedded" must never verify', () => {
    // The original frontend fell back to `resp.authResponse.state || 'embedded'`
    // whenever Embedded Signup's FB.login() (which never populates
    // authResponse.state) was used. That literal string must never pass
    // verification, confirming why the old code always failed here — and
    // why Embedded Signup no longer routes through verifyState() at all.
    expect(() => verifyState('embedded')).toThrow();
  });

  test('throws clearly when JWT_SECRET is not configured', () => {
    delete process.env.JWT_SECRET;
    expect(() => buildState('user-A')).toThrow(/JWT_SECRET/);
  });
});
