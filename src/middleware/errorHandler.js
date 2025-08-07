const logger = require('../utils/logger');
const config = require('../config/config');

/**
 * Global error handling middleware
 * Captures and formats errors for consistent API responses
 */
function errorHandler(error, req, res, next) {
  // Log the error
  logger.error('Unhandled error', {
    error: error.message,
    stack: config.NODE_ENV === 'development' ? error.stack : undefined,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    webhookEvent: req.webhook?.event,
    webhookDelivery: req.webhook?.delivery
  });

  // Default error response
  let statusCode = 500;
  let message = 'Internal server error';
  let details = null;

  // Handle specific error types
  if (error.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation error';
    details = error.errors;
  } else if (error.name === 'CastError') {
    statusCode = 400;
    message = 'Invalid ID format';
  } else if (error.name === 'MongoNetworkError') {
    statusCode = 503;
    message = 'Database connection error';
  } else if (error.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token';
  } else if (error.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired';
  } else if (error.code === 'ENOTFOUND') {
    statusCode = 503;
    message = 'External service unavailable';
  } else if (error.statusCode || error.status) {
    statusCode = error.statusCode || error.status;
    message = error.message;
  }

  // Prepare error response
  const errorResponse = {
    error: {
      message,
      status: statusCode,
      timestamp: new Date().toISOString()
    }
  };

  // Add additional details in development mode
  if (config.NODE_ENV === 'development') {
    errorResponse.error.stack = error.stack;
    errorResponse.error.details = details;
  }

  // Add request ID if available
  if (req.webhook?.delivery) {
    errorResponse.error.requestId = req.webhook.delivery;
  }

  res.status(statusCode).json(errorResponse);
}

/**
 * Handle 404 errors for undefined routes
 */
function notFoundHandler(req, res) {
  logger.warn('Route not found', {
    url: req.originalUrl,
    method: req.method,
    ip: req.ip
  });

  res.status(404).json({
    error: {
      message: 'Route not found',
      status: 404,
      timestamp: new Date().toISOString()
    }
  });
}

/**
 * Async error wrapper
 * Wraps async route handlers to catch errors automatically
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Custom error class for application-specific errors
 */
class AppError extends Error {
  constructor(message, statusCode = 500, details = null) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * GitHub API error handler
 */
class GitHubError extends AppError {
  constructor(message, statusCode = 500, githubError = null) {
    super(message, statusCode);
    this.name = 'GitHubError';
    this.githubError = githubError;
  }

  static fromGitHubResponse(error) {
    let message = 'GitHub API error';
    let statusCode = 500;

    if (error.response) {
      statusCode = error.response.status;
      message = error.response.data?.message || error.message;
    } else if (error.request) {
      statusCode = 503;
      message = 'GitHub API unavailable';
    } else {
      message = error.message;
    }

    return new GitHubError(message, statusCode, error);
  }
}

/**
 * Gemini AI error handler
 */
class GeminiError extends AppError {
  constructor(message, statusCode = 500, geminiError = null) {
    super(message, statusCode);
    this.name = 'GeminiError';
    this.geminiError = geminiError;
  }

  static fromGeminiResponse(error) {
    let message = 'Gemini AI error';
    let statusCode = 500;

    if (error.status === 429) {
      statusCode = 429;
      message = 'Gemini API rate limit exceeded';
    } else if (error.status === 401) {
      statusCode = 401;
      message = 'Invalid Gemini API key';
    } else if (error.status >= 400 && error.status < 500) {
      statusCode = 400;
      message = 'Invalid request to Gemini API';
    } else if (error.status >= 500) {
      statusCode = 503;
      message = 'Gemini API service unavailable';
    } else {
      message = error.message || 'Gemini AI processing error';
    }

    return new GeminiError(message, statusCode, error);
  }
}

module.exports = {
  errorHandler,
  notFoundHandler,
  asyncHandler,
  AppError,
  GitHubError,
  GeminiError
};
