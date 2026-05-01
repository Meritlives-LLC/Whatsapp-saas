require('dotenv').config();
const express    = require('express');
const http       = require('http');
const cors       = require('cors');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const { Server } = require('socket.io');

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
  checkActive,
} = require('./middlewares/security');

const app    = express();
const server = http.createServer(app);

// ─── Allowed origins ───────────────────────────────────────
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:3000',
  'http://localhost:5173',
].filter(Boolean);

// ─── Socket.io ─────────────────────────────────────────────
const io = new Server(server, {
  cors: { origin: allowedOrigins, credentials: true },
  pingTimeout: 60000,
});

io.on('connection', (socket) => {
  logger.info(`Socket connected: ${socket.id} — ${socket.handshake.address}`);

  socket.on('join_business', (businessId) => {
    socket.join(`business_${businessId}`);
  });

  socket.on('disconnect', (reason) => {
    logger.info(`Socket disconnected: ${socket.id} — ${reason}`);
  });
});

webhookCtrl.setIO(io);

// ─── Security middleware (order matters) ───────────────────
app.set('trust proxy', 1);           // Required for Railway/Render reverse proxy
app.use(helmetConfig);               // Security headers
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (Paystack/Meta webhooks, curl, mobile apps)
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
}));
app.use(compression());              // Gzip responses
app.use(cookieParser());             // Parse refresh token cookie
app.use(express.json({ limit: '10kb' }));   // Limit body size
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(sanitize);                   // Prevent NoSQL injection
app.use(requestLogger);              // HTTP access logs
app.use(globalLimiter);              // Rate limit all routes

// ─── Routes ────────────────────────────────────────────────
app.use('/api', routes);

// ─── Health check ──────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()) + 's',
  });
});

// ─── 404 handler ───────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.method} ${req.path} not found` });
});

// ─── Central error handler ─────────────────────────────────
app.use(errorHandler);

// ─── Graceful shutdown ─────────────────────────────────────
const shutdown = (signal) => {
  logger.info(`${signal} received — shutting down gracefully`);
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
  setTimeout(() => { logger.error('Forced shutdown'); process.exit(1); }, 15000);
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

// ─── Uncaught errors ───────────────────────────────────────
process.on('uncaughtException', (err) => {
  logger.error(`Uncaught Exception: ${err.message}\n${err.stack}`);
  process.exit(1);
});
process.on('unhandledRejection', (reason) => {
  logger.error(`Unhandled Rejection: ${reason}`);
});

// ─── Boot ──────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

(async () => {
  await connectDB();
  await createIndexes();
  startCronJobs();
  server.listen(PORT, () => {
    logger.info(`🚀 Server running on port ${PORT} [${process.env.NODE_ENV}]`);
  });
})();
