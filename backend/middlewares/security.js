const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const logger = require('../config/logger');

// ── Helmet (HTTP security headers) ──────────────────────────────────────────
exports.helmetConfig = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
    },
  },
  crossOriginEmbedderPolicy: false, // Allow Socket.io
});

// ── Mongo sanitize (prevent NoSQL injection) ─────────────────────────────────
exports.sanitize = mongoSanitize({
  replaceWith: '_',
  onSanitize: ({ req, key }) => {
    logger.warn(`Sanitized potential injection attempt in field: ${key} from IP: ${req.ip}`);
  },
});

// ── Rate limiters ────────────────────────────────────────────────────────────

// Global API rate limit: 200 req/15min per IP
exports.globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests. Please try again in 15 minutes.' },
  handler: (req, res, next, options) => {
    logger.warn(`Rate limit hit: ${req.ip} on ${req.path}`);
    res.status(429).json(options.message);
  },
});

// Strict auth rate limit: 10 req/15min per IP (brute force protection)
exports.authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Only count failed attempts
  message: { success: false, message: 'Too many login attempts. Please wait 15 minutes.' },
  handler: (req, res, next, options) => {
    logger.warn(`Auth rate limit hit: ${req.ip} — possible brute force`);
    res.status(429).json(options.message);
  },
});

// Password reset: 3 req/hour
exports.passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: { success: false, message: 'Too many password reset requests. Try again in 1 hour.' },
});

// Webhook: relaxed — Meta/Paystack may send bursts
exports.webhookLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 100,
  message: { success: false, message: 'Webhook rate limit exceeded.' },
});

// ── Suspend check ─────────────────────────────────────────────────────────────
// Runs after protect middleware — blocks suspended accounts from any action
exports.checkActive = (req, res, next) => {
  if (req.user && !req.user.isActive) {
    return res.status(403).json({
      success: false,
      message: 'Your account has been suspended. Contact support.',
    });
  }
  next();
};

// ── Request logger ────────────────────────────────────────────────────────────
exports.requestLogger = (req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'http';
    logger[level] || logger.info;
    logger.info(`${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms — ${req.ip}`);
  });
  next();
};
