const crypto = require('crypto');
const config = require('../config/config');
const logger = require('../utils/logger');

/**
 * Middleware to validate GitHub webhook signatures
 * Ensures webhook requests are authentic and from GitHub
 */
function validateGitHubWebhook(req, res, next) {
  try {
    const signature = req.get('X-Hub-Signature-256');
    const event = req.get('X-GitHub-Event');
    const delivery = req.get('X-GitHub-Delivery');

    // Log webhook details
    logger.info('GitHub webhook received', {
      event,
      delivery,
      hasSignature: !!signature,
      contentLength: req.get('Content-Length')
    });

    // Validate required headers
    if (!event) {
      logger.warn('Missing X-GitHub-Event header');
      return res.status(400).json({ error: 'Missing X-GitHub-Event header' });
    }

    if (!delivery) {
      logger.warn('Missing X-GitHub-Delivery header');
      return res.status(400).json({ error: 'Missing X-GitHub-Delivery header' });
    }

    // Verify webhook signature if secret is configured
    if (config.GITHUB_WEBHOOK_SECRET) {
      if (!signature) {
        logger.warn('Missing webhook signature');
        return res.status(401).json({ error: 'Missing webhook signature' });
      }

      if (!verifySignature(req.body, signature, config.GITHUB_WEBHOOK_SECRET)) {
        logger.warn('Invalid webhook signature', { delivery });
        return res.status(401).json({ error: 'Invalid webhook signature' });
      }

      logger.debug('Webhook signature verified successfully');
    } else {
      logger.warn('Webhook secret not configured - signature verification skipped');
    }

    // Add webhook metadata to request
    req.webhook = {
      event,
      delivery,
      signature
    };

    next();
  } catch (error) {
    logger.error('Error validating webhook', {
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Verify GitHub webhook signature
 * @param {Buffer} payload - Raw request body
 * @param {string} signature - GitHub signature header
 * @param {string} secret - Webhook secret
 * @returns {boolean} True if signature is valid
 */
function verifySignature(payload, signature, secret) {
  try {
    // GitHub sends signature as sha256=<hash>
    const sigHashAlg = 'sha256';
    const sigHashPrefix = 'sha256=';
    
    if (!signature.startsWith(sigHashPrefix)) {
      logger.warn('Invalid signature format');
      return false;
    }

    const receivedHash = signature.slice(sigHashPrefix.length);
    const expectedHash = crypto
      .createHmac(sigHashAlg, secret)
      .update(payload)
      .digest('hex');

    // Use crypto.timingSafeEqual to prevent timing attacks
    const receivedBuffer = Buffer.from(receivedHash, 'hex');
    const expectedBuffer = Buffer.from(expectedHash, 'hex');

    if (receivedBuffer.length !== expectedBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(receivedBuffer, expectedBuffer);
  } catch (error) {
    logger.error('Error verifying signature', { error: error.message });
    return false;
  }
}

/**
 * Middleware to validate webhook payload content
 */
function validateWebhookPayload(req, res, next) {
  try {
    // Parse JSON payload
    if (req.body && Buffer.isBuffer(req.body)) {
      try {
        req.body = JSON.parse(req.body.toString());
      } catch (error) {
        logger.warn('Invalid JSON payload', { error: error.message });
        return res.status(400).json({ error: 'Invalid JSON payload' });
      }
    }

    // Validate payload structure based on event type
    const event = req.webhook.event;
    const payload = req.body;

    if (!payload) {
      return res.status(400).json({ error: 'Empty payload' });
    }

    // Event-specific validation
    switch (event) {
      case 'pull_request':
        if (!payload.pull_request || !payload.repository) {
          return res.status(400).json({ error: 'Invalid pull_request payload' });
        }
        break;
      
      case 'pull_request_review':
        if (!payload.review || !payload.pull_request || !payload.repository) {
          return res.status(400).json({ error: 'Invalid pull_request_review payload' });
        }
        break;
      
      case 'ping':
        // Ping events are valid with minimal payload
        break;
      
      default:
        logger.debug('Unhandled webhook event type', { event });
    }

    // Add parsed payload metadata
    req.webhook.payload = payload;
    req.webhook.isValid = true;

    next();
  } catch (error) {
    logger.error('Error validating payload', {
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Rate limiting for webhook endpoints
 */
function webhookRateLimit(req, res, next) {
  const delivery = req.webhook?.delivery;
  
  if (!delivery) {
    return next();
  }

  // Simple in-memory rate limiting (for production, use Redis)
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute
  const maxRequests = 100;

  if (!webhookRateLimit.requests) {
    webhookRateLimit.requests = new Map();
  }

  const requests = webhookRateLimit.requests;
  const key = req.ip || 'unknown';
  const userRequests = requests.get(key) || [];

  // Remove old requests outside the window
  const validRequests = userRequests.filter(timestamp => now - timestamp < windowMs);
  
  if (validRequests.length >= maxRequests) {
    logger.warn('Webhook rate limit exceeded', { 
      ip: key, 
      requests: validRequests.length 
    });
    return res.status(429).json({ error: 'Rate limit exceeded' });
  }

  // Add current request
  validRequests.push(now);
  requests.set(key, validRequests);

  // Clean up old entries periodically
  if (requests.size > 1000) {
    for (const [k, v] of requests.entries()) {
      if (v.length === 0 || now - v[v.length - 1] > windowMs * 2) {
        requests.delete(k);
      }
    }
  }

  next();
}

module.exports = [
  validateGitHubWebhook,
  webhookRateLimit,
  validateWebhookPayload
];
