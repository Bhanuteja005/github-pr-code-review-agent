require('dotenv').config();

const config = {
  // Server Configuration
  PORT: process.env.PORT || 3000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  WEBHOOK_URL: process.env.WEBHOOK_URL,
  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS?.split(',') || ['*'],

  // GitHub Configuration
  GITHUB_TOKEN: process.env.GITHUB_TOKEN,
  GITHUB_WEBHOOK_SECRET: process.env.GITHUB_WEBHOOK_SECRET,
  GITHUB_APP_ID: process.env.GITHUB_APP_ID,
  GITHUB_PRIVATE_KEY: process.env.GITHUB_PRIVATE_KEY,

  // Gemini AI Configuration
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  GEMINI_MODEL: process.env.GEMINI_MODEL || 'gemini-1.5-flash',

  // Database Configuration
  MONGODB_URI: process.env.MONGODB_URI || process.env.MONGO_URL || 'mongodb://localhost:27017/code-review-agent',

  // Review Configuration
  MAX_FILES_PER_PR: parseInt(process.env.MAX_FILES_PER_PR) || 50,
  MAX_DIFF_SIZE: parseInt(process.env.MAX_DIFF_SIZE) || 100000, // 100KB
  REVIEW_TIMEOUT: parseInt(process.env.REVIEW_TIMEOUT) || 300000, // 5 minutes
  
  // Rate Limiting
  RATE_LIMIT_WINDOW: parseInt(process.env.RATE_LIMIT_WINDOW) || 900000, // 15 minutes
  RATE_LIMIT_MAX: parseInt(process.env.RATE_LIMIT_MAX) || 100,

  // Logging
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  LOG_FORMAT: process.env.LOG_FORMAT || 'combined',

  // Review Criteria Configuration
  REVIEW_CRITERIA: {
    checkSecurity: process.env.CHECK_SECURITY !== 'false',
    checkPerformance: process.env.CHECK_PERFORMANCE !== 'false',
    checkReadability: process.env.CHECK_READABILITY !== 'false',
    checkBestPractices: process.env.CHECK_BEST_PRACTICES !== 'false',
    checkTesting: process.env.CHECK_TESTING !== 'false',
    checkDocumentation: process.env.CHECK_DOCUMENTATION !== 'false'
  },

  // Language-specific configurations
  LANGUAGE_CONFIGS: {
    javascript: {
      extensions: ['.js', '.jsx', '.ts', '.tsx'],
      frameworks: ['react', 'vue', 'angular', 'node'],
      linting: ['eslint', 'prettier']
    },
    python: {
      extensions: ['.py'],
      frameworks: ['django', 'flask', 'fastapi'],
      linting: ['pylint', 'black', 'flake8']
    },
    java: {
      extensions: ['.java'],
      frameworks: ['spring', 'hibernate'],
      linting: ['checkstyle', 'spotbugs']
    }
  }
};

// Validation
const requiredEnvVars = ['GITHUB_TOKEN', 'GEMINI_API_KEY'];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.error(`❌ Missing required environment variables: ${missingVars.join(', ')}`);
  console.error('Please check your .env file or environment configuration.');
  process.exit(1);
}

module.exports = config;
