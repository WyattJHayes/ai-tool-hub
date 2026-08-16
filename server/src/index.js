import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import config, { validateConfig } from './config.js';
import authRoutes from './routes/auth.js';
import resumeRoutes from './routes/resume.js';
import paymentRoutes from './routes/payment.js';
import { rateLimitMiddleware } from './middleware/rateLimit.js';
import { requestIdMiddleware } from './middleware/requestId.js';
import logger from './utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

validateConfig();

const app = express();

const morganFormat = process.env.NODE_ENV === 'production' 
  ? ':method :url :status :res[content-length] - :response-time ms - :req[x-request-id]'
  : 'dev';

app.use(morgan(morganFormat, {
  stream: {
    write: (message) => logger.http(message.trim())
  },
  skip: (req) => req.url === '/api/v1/health'
}));

const allowedOrigins = config.CORS_ORIGIN.split(',').map(o => o.trim());
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
      callback(null, true);
    } else {
      callback(null, false);
    }
  },
  credentials: true,
  maxAge: 86400
}));

app.set('trust proxy', 1);

app.use((req, res, next) => {
    res.setHeader('Content-Security-Policy', [
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self'",
        "img-src 'self' data:",
        "font-src 'self'",
        "connect-src 'self'",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'"
    ].join('; '));
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
});

app.use(requestIdMiddleware);
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());
app.use(rateLimitMiddleware);

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/resume', resumeRoutes);
app.use('/api/v1/payment', paymentRoutes);

app.get('/api/v1/health', (req, res) => {
  res.json({
    status: 'ok',
    version: '1.0.0',
    deepseek: !!config.DEEPSEEK_API_KEY,
    timestamp: new Date().toISOString()
  });
});

app.use((req, res) => {
  res.status(404).json({ error: '接口不存在', path: req.path });
});

app.use((err, req, res, _next) => {
  logger.error(`[${req.requestId}] Unhandled error:`, err);
  if (res.headersSent) return;
  const errorMsg = config.NODE_ENV === 'production' 
    ? '服务器内部错误' 
    : err.message || '服务器内部错误';
  res.status(err.status || 500).json({ 
    error: errorMsg,
    requestId: req.requestId 
  });
});

const server = app.listen(config.PORT, () => {
  logger.info(`AI Tool Hub API running on port ${config.PORT}`);
  logger.info(`DeepSeek API: ${config.DEEPSEEK_API_KEY ? 'configured' : 'NOT configured'}`);
  logger.info(`Daily quota per user: ${config.DAILY_QUOTA}`);
  logger.info(`CORS origins: ${allowedOrigins.join(', ')}`);
});

function gracefulShutdown(signal) {
  logger.info(`Received ${signal}. Shutting down gracefully...`);
  server.close(() => {
    logger.info('HTTP server closed.');
    process.exit(0);
  });
  setTimeout(() => {
    logger.error('Forced shutdown after timeout.');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Promise Rejection:', reason);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

export default app;
