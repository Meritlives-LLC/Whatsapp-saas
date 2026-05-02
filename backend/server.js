require('dotenv').config();
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
} = require('./middlewares/security');

// Ensure logs directory exists
const fs   = require('fs');
const path = require('path');
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });

const app    = express();
const server = http.createServer(app);

// ─── Allowed origins ────────────────────────────────────────
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:3000',
  'http://localhost:5173',
].filter(Boolean);

const isAllowedOrigin = (origin) => {
  if (!origin) return true;
  if (allowedOrigins.includes(origin)) return true;
  // Allow any Vercel preview deployment
  if (/\.vercel\.app$/.test(origin)) return true;
  return false;
};

// ─── Socket.io ──────────────────────────────────────────────
const io = new Server(server, {
  cors: { origin: (origin, cb) => cb(null, isAllowedOrigin(origin)), credentials: true },
  pingTimeout: 60000,
});

io.on('connection', (socket) => {
  logger.info(`Socket connected: ${socket.id}`);
  socket.on('join_business', (businessId) => socket.join(`business_${businessId}`));
  socket.on('disconnect', (reason) => logger.info(`Socket disconnected: ${socket.id} — ${reason}`));
});

webhookCtrl.setIO(io);

// ─── Trust proxy (Railway / Render) ─────────────────────────
app.set('trust proxy', 1);

// ─── CRITICAL: Webhook routes BEFORE any body parsing ────────
// Meta sends the webhook as plain JSON. We must handle it before
// helmet / sanitize / rate-limiter modifies or blocks anything.
// The GET verification endpoint must return plain text, not JSON.
app.get('/api/webhook',  (req, res) => webhookCtrl.verifyWebhook(req, res));
app.post('/api/webhook', express.json(), (req, res) => webhookCtrl.receiveMessage(req, res));

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
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(sanitize);
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
