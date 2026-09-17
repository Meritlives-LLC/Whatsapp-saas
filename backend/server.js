require('dotenv').config();

// ─── Startup environment validation ─────────────────────────
// Fail fast with a clear message rather than cryptic runtime errors.
const REQUIRED_ENV = [
  'MONGODB_URI',
  'JWT_SECRET',
  'JWT_REFRESH_SECRET',
  'WHATSAPP_VERIFY_TOKEN',
  'DEEPSEEK_API_KEY',
  'PAYSTACK_SECRET_KEY',
  'FRONTEND_URL',
  'BACKEND_URL',
  'META_APP_ID',
  'META_APP_SECRET',
  'ENCRYPTION_KEY',
];
const missing = REQUIRED_ENV.filter(k => !process.env[k]);
if (missing.length > 0) {
  console.error(`\n❌  Missing required environment variables:\n   ${missing.join('\n   ')}\n\nCopy backend/.env.example to backend/.env and fill in the values.\n`);
  process.exit(1);
}

// ─── Encryption key validation (fail-closed) ─────────────────
// ENCRYPTION_KEY being *present* (checked above) isn't enough — it must
// actually be usable for aes-256-gcm. Without this check, a malformed value
// (wrong length, non-hex, copy-paste typo) would previously fall through to
// utils/crypto.js silently storing WhatsApp access tokens as plaintext. We
// now refuse to boot instead, so a bad key is caught at deploy time, not
// discovered later by inspecting the database.
const { validateEncryptionKey } = require('./utils/crypto');
if (!validateEncryptionKey(process.env.ENCRYPTION_KEY)) {
  console.error(`\n❌  ENCRYPTION_KEY is set but is not a valid 64-character hex string (32 bytes).\n\nGenerate one with:\n   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"\n\nRefusing to start — sensitive fields (WhatsApp access tokens) must never be stored as plaintext.\n`);
  process.exit(1);
}

if (process.env.NODE_ENV === 'production') {
  const PROD_EMAIL = ['EMAIL_HOST', 'EMAIL_USER', 'EMAIL_PASS'];
  const missingEmail = PROD_EMAIL.filter(k => !process.env[k]);
  if (missingEmail.length > 0) {
    console.warn(`⚠️  Production email vars missing (${missingEmail.join(', ')}) — falling back to Ethereal (no real emails)`);
  }
}
const express     = require('express');
const http        = require('http');
const cors        = require('cors');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const { Server }  = require('socket.io');

const connectDB      = require('./config/db');
const createIndexes  = require('./config/indexes');
const routes         = require('./routes/index');
const webhookCtrl    = require('./controllers/webhookController');
const { startCronJobs } = require('./services/cronService');
const errorHandler   = require('./middlewares/errorHandler');
const logger         = require('./config/logger');
const {
  helmetConfig,
  sanitize,
  globalLimiter,
  requestLogger,
  webhookLimiter,
} = require('./middlewares/security');
const verifyMetaSignature = require('./middlewares/verifyMetaSignature');
const { socketAuth } = require('./middlewares/socketAuth');
const xss = require('xss-clean');

// Ensure logs directory exists
const fs   = require('fs');
const path = require('path');
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });

const app    = express();
const server = http.createServer(app);

// ─── Allowed origins ────────────────────────────────────────
// See config/corsOrigins.js for the trust rules (production trusts only
// FRONTEND_URL + ADDITIONAL_ALLOWED_ORIGINS; *.vercel.app previews are
// never auto-trusted in production).
const { makeIsAllowedOrigin } = require('./config/corsOrigins');
const isAllowedOrigin = makeIsAllowedOrigin(process.env);

// ─── Socket.io ──────────────────────────────────────────────
const io = new Server(server, {
  cors: { origin: (origin, cb) => cb(null, isAllowedOrigin(origin)), credentials: true },
  pingTimeout: 60000,
});

// ── AUTH GATE ──────────────────────────────────────────────
// Every socket must present the same JWT used for REST auth before the
// connection is accepted. socketAuth() resolves the caller's OWN
// business id server-side (socket.data.businessId) — a client can never
// supply or influence which business's room it lands in.
io.use(socketAuth());

io.on('connection', (socket) => {
  logger.info(`Socket connected: ${socket.id} (business ${socket.data.businessId || 'none'})`);

  // Join only the caller's own room, resolved from their verified JWT —
  // never from anything the client sends. There is deliberately no
  // client-facing 'join_business' event anymore; the old version took a
  // businessId straight from the client and joined that room unchecked,
  // letting any socket eavesdrop on any tenant's live conversations.
  if (socket.data.businessId) {
    socket.join(`business_${socket.data.businessId}`);
  }

  socket.on('disconnect', (reason) => logger.info(`Socket disconnected: ${socket.id} — ${reason}`));
});

webhookCtrl.setIO(io);

// ─── Trust proxy (Railway / Render) ─────────────────────────
app.set('trust proxy', 1);

// ─── CRITICAL: Webhook routes BEFORE any body parsing ────────
// Meta sends the webhook as plain JSON. We must handle it before
// helmet / sanitize / global rate-limiter modifies or blocks anything.
// The GET verification endpoint must return plain text, not JSON.
//
// The POST route still gets its OWN rate limiter (webhookLimiter) and a
// mandatory signature check (verifyMetaSignature) — this is the only thing
// standing between the public internet and your AI/DB, since phoneNumberId
// alone is not a secret. express.json's `verify` callback stashes the raw
// body on req.rawBody so the signature can be checked against the exact
// bytes Meta signed (parsing first, then re-stringifying, would not match).
app.get('/api/webhook', (req, res) => webhookCtrl.verifyWebhook(req, res));
app.post(
  '/api/webhook',
  webhookLimiter,
  express.json({ verify: (req, res, buf) => { req.rawBody = buf; } }),
  verifyMetaSignature,
  (req, res) => webhookCtrl.receiveMessage(req, res)
);

// ─── Security middleware (applied AFTER webhook routes) ──────
app.use(helmetConfig);
app.use(cors({
  origin: (origin, callback) => {
    if (isAllowedOrigin(origin)) return callback(null, true);
    callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
}));
app.use(compression());
app.use(cookieParser());

// ─── Passport (Google OAuth) ─────────────────────────────────
const passport = require('passport');
app.use(passport.initialize());

app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(sanitize);
app.use(xss());
app.use(requestLogger);
app.use(globalLimiter);

// ─── All other routes ────────────────────────────────────────
app.use('/api', routes);

// ─── Health check (Meta also pings this during review) ───────
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()) + 's',
  });
});

// ─── 404 ─────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.method} ${req.path} not found` });
});

// ─── Error handler ───────────────────────────────────────────
app.use(errorHandler);

// ─── Graceful shutdown ───────────────────────────────────────
const shutdown = (signal) => {
  logger.info(`${signal} — shutting down`);
  server.close(() => { logger.info('Server closed'); process.exit(0); });
  setTimeout(() => process.exit(1), 15000);
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
process.on('uncaughtException',  (err) => { logger.error(`Uncaught: ${err.message}`); process.exit(1); });
process.on('unhandledRejection', (r)   => { logger.error(`Unhandled rejection: ${r}`); });

// ─── Boot ────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
(async () => {
  await connectDB();
  await createIndexes();
  startCronJobs();
  server.listen(PORT, () => {
    logger.info(`🚀 Server on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
  });
})();
