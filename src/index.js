const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const logger = require('./utils/logger');
const config = require('./config/config');
const database = require('./utils/database');
const githubWebhookController = require('./controllers/githubWebhookController');
const { errorHandler } = require('./middleware/errorHandler');
const webhookValidator = require('./middleware/webhookValidator');

const app = express();

// Trust proxy for rate limiting behind reverse proxies (localtunnel, nginx, etc.)
app.set('trust proxy', 1);

// Initialize database connection
database.connect().catch(error => {
  logger.error('Failed to connect to database during startup:', error);
});

// Security middleware
app.use(helmet());
app.use(cors({
  origin: config.ALLOWED_ORIGINS || '*',
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use(limiter);

// Body parsing middleware
app.use('/webhook', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', async (req, res) => {
  const dbHealth = await database.healthCheck();
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    database: dbHealth
  });
});

// GitHub webhook endpoint
app.post('/webhook/github', webhookValidator, githubWebhookController.handleWebhook);

// API endpoints
app.get('/api/reviews/:prId', githubWebhookController.getReviewStatus);
app.post('/api/reviews/:prId/retry', githubWebhookController.retryReview);

// Error handling middleware
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

const PORT = config.PORT || 3000;

const server = app.listen(PORT, () => {
  logger.info(`🤖 Code Review Agent started on port ${PORT}`);
  logger.info(`🔗 Webhook URL: ${config.WEBHOOK_URL || `http://localhost:${PORT}/webhook/github`}`);
});

// Graceful shutdown
const gracefulShutdown = (signal) => {
  logger.info(`${signal} received, shutting down gracefully`);
  server.close(async () => {
    await database.disconnect();
    process.exit(0);
  });
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

module.exports = app;
