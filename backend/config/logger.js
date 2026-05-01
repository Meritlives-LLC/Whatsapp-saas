const winston = require('winston');
const path = require('path');
const fs = require('fs');

const { combine, timestamp, printf, colorize, errors } = winston.format;

const logFormat = printf(({ level, message, timestamp, stack }) => {
  return `${timestamp} [${level}]: ${stack || message}`;
});

// Ensure logs directory exists before adding file transports
const logsDir = path.join(__dirname, '../../logs');
const fileTransports = [];

try {
  if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
  fileTransports.push(
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      maxsize: 5 * 1024 * 1024,
      maxFiles: 5,
    }),
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      maxsize: 10 * 1024 * 1024,
      maxFiles: 5,
    })
  );
} catch (e) {
  // On read-only filesystems (some PaaS), just skip file logging
  console.warn('Warning: Could not set up file logging:', e.message);
}

const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: combine(timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), errors({ stack: true }), logFormat),
  transports: [
    new winston.transports.Console({
      format: combine(colorize(), timestamp({ format: 'HH:mm:ss' }), logFormat),
    }),
    ...fileTransports,
  ],
});

module.exports = logger;