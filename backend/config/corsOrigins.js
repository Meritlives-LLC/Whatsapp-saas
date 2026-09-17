// backend/config/corsOrigins.js
//
// Origin allowlist for CORS and socket.io. Extracted from server.js so the
// production-trust rules are unit-testable without booting the server.
//
// Production trust is EXPLICIT ONLY: FRONTEND_URL plus anything listed in
// ADDITIONAL_ALLOWED_ORIGINS (comma-separated). Arbitrary Vercel preview
// deployments are convenient in development but must never be trusted by
// default in production — a *.vercel.app wildcard would let anyone who can
// deploy a Vercel project make credentialed cross-origin requests against
// this multi-tenant API. If a specific preview URL genuinely needs access in
// production, add it explicitly to ADDITIONAL_ALLOWED_ORIGINS.

function buildAllowedOrigins(env = process.env) {
  const isProduction = env.NODE_ENV === 'production';

  const explicit = [
    env.FRONTEND_URL,
    ...(env.ADDITIONAL_ALLOWED_ORIGINS
      ? env.ADDITIONAL_ALLOWED_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean)
      : []),
  ].filter(Boolean);

  // Local dev convenience only — never trusted in production.
  const dev = isProduction ? [] : ['http://localhost:3000', 'http://localhost:5173'];

  return [...explicit, ...dev];
}

function makeIsAllowedOrigin(env = process.env) {
  const isProduction = env.NODE_ENV === 'production';
  const allowedOrigins = buildAllowedOrigins(env);

  return function isAllowedOrigin(origin) {
    // Non-browser requests (curl, server-to-server, native mobile apps) send
    // no Origin header at all — CORS is not the control boundary for those.
    if (!origin) return true;
    if (allowedOrigins.includes(origin)) return true;
    // Vercel preview deployments: allowed only OUTSIDE production.
    if (!isProduction && /\.vercel\.app$/.test(origin)) return true;
    return false;
  };
}

module.exports = { buildAllowedOrigins, makeIsAllowedOrigin };
