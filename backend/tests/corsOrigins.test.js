// backend/tests/corsOrigins.test.js
//
// The API is multi-tenant and CORS runs with credentials: true, so a
// wildcard-ish origin check is a real cross-origin risk, not a nitpick.
// A previous version trusted ANY origin matching /\.vercel\.app$/ —
// including in production.

const { makeIsAllowedOrigin, buildAllowedOrigins } = require('../config/corsOrigins');

const prodEnv = {
  NODE_ENV: 'production',
  FRONTEND_URL: 'https://app.example.com',
};

describe('CORS origin allowlist — production', () => {
  test('does NOT trust an arbitrary *.vercel.app origin in production', () => {
    const isAllowed = makeIsAllowedOrigin(prodEnv);
    expect(isAllowed('https://some-random-attacker-project.vercel.app')).toBe(false);
    expect(isAllowed('https://totally-unrelated.vercel.app')).toBe(false);
  });

  test('trusts FRONTEND_URL exactly', () => {
    const isAllowed = makeIsAllowedOrigin(prodEnv);
    expect(isAllowed('https://app.example.com')).toBe(true);
  });

  test('does NOT trust localhost in production', () => {
    const isAllowed = makeIsAllowedOrigin(prodEnv);
    expect(isAllowed('http://localhost:5173')).toBe(false);
    expect(isAllowed('http://localhost:3000')).toBe(false);
  });

  test('trusts a specific preview URL only when explicitly listed in ADDITIONAL_ALLOWED_ORIGINS', () => {
    const isAllowed = makeIsAllowedOrigin({
      ...prodEnv,
      ADDITIONAL_ALLOWED_ORIGINS: 'https://staging-abc.vercel.app, https://admin.example.com',
    });

    expect(isAllowed('https://staging-abc.vercel.app')).toBe(true);
    expect(isAllowed('https://admin.example.com')).toBe(true);
    // ...but still not any OTHER vercel deployment.
    expect(isAllowed('https://different-project.vercel.app')).toBe(false);
  });

  test('rejects lookalike/suffix-style origins', () => {
    const isAllowed = makeIsAllowedOrigin(prodEnv);
    expect(isAllowed('https://app.example.com.evil.com')).toBe(false);
    expect(isAllowed('https://evil-app.example.com')).toBe(false);
    expect(isAllowed('http://app.example.com')).toBe(false); // scheme must match too
  });

  test('allows requests with no Origin header (curl / server-to-server / native apps)', () => {
    const isAllowed = makeIsAllowedOrigin(prodEnv);
    expect(isAllowed(undefined)).toBe(true);
    expect(isAllowed('')).toBe(true);
  });
});

describe('CORS origin allowlist — development', () => {
  const devEnv = { NODE_ENV: 'development', FRONTEND_URL: 'http://localhost:5173' };

  test('still allows localhost dev servers', () => {
    const isAllowed = makeIsAllowedOrigin(devEnv);
    expect(isAllowed('http://localhost:5173')).toBe(true);
    expect(isAllowed('http://localhost:3000')).toBe(true);
  });

  test('allows vercel previews outside production (staging convenience)', () => {
    const isAllowed = makeIsAllowedOrigin(devEnv);
    expect(isAllowed('https://my-preview.vercel.app')).toBe(true);
  });

  test('buildAllowedOrigins includes localhost only outside production', () => {
    expect(buildAllowedOrigins(devEnv)).toEqual(
      expect.arrayContaining(['http://localhost:3000', 'http://localhost:5173'])
    );
    expect(buildAllowedOrigins(prodEnv)).not.toEqual(
      expect.arrayContaining(['http://localhost:3000'])
    );
  });
});
