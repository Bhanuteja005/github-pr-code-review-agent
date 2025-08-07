const mongoose = require('mongoose');
const config = require('../config/config');
const logger = require('./logger');

class DatabaseConnection {
  constructor() {
    this.isConnected = false;
    this.retryCount = 0;
    this.maxRetries = 5;
    this.retryDelay = 5000; // 5 seconds
  }

  async connect() {
    if (this.isConnected) {
      return;
    }

    try {
      logger.info('Connecting to MongoDB...', { uri: this.getMaskedUri() });
      
      await mongoose.connect(config.MONGODB_URI, {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
        family: 4 // Use IPv4, skip trying IPv6
      });

      this.isConnected = true;
      this.retryCount = 0;
      
      logger.info('✅ Connected to MongoDB successfully');

      // Handle connection events
      mongoose.connection.on('error', (error) => {
        logger.error('MongoDB connection error:', error);
        this.isConnected = false;
      });

      mongoose.connection.on('disconnected', () => {
        logger.warn('MongoDB disconnected');
        this.isConnected = false;
        this.handleReconnect();
      });

      mongoose.connection.on('reconnected', () => {
        logger.info('MongoDB reconnected');
        this.isConnected = true;
        this.retryCount = 0;
      });

    } catch (error) {
      logger.error('Failed to connect to MongoDB:', {
        error: error.message,
        retryCount: this.retryCount
      });
      
      this.isConnected = false;
      
      if (this.retryCount < this.maxRetries) {
        this.retryCount++;
        logger.info(`Retrying connection in ${this.retryDelay / 1000} seconds... (${this.retryCount}/${this.maxRetries})`);
        
        setTimeout(() => {
          this.connect();
        }, this.retryDelay);
      } else {
        logger.error('Max retry attempts reached. Could not connect to MongoDB.');
        throw new Error('Database connection failed after maximum retries');
      }
    }
  }

  async disconnect() {
    try {
      if (this.isConnected) {
        await mongoose.disconnect();
        this.isConnected = false;
        logger.info('Disconnected from MongoDB');
      }
    } catch (error) {
      logger.error('Error disconnecting from MongoDB:', error);
    }
  }

  async handleReconnect() {
    if (this.retryCount >= this.maxRetries) {
      logger.error('Max reconnection attempts reached');
      return;
    }

    this.retryCount++;
    logger.info(`Attempting to reconnect to MongoDB... (${this.retryCount}/${this.maxRetries})`);
    
    setTimeout(async () => {
      try {
        await this.connect();
      } catch (error) {
        logger.error('Reconnection attempt failed:', error);
      }
    }, this.retryDelay);
  }

  getMaskedUri() {
    try {
      const uri = new URL(config.MONGODB_URI);
      if (uri.password) {
        uri.password = '***';
      }
      return uri.toString();
    } catch {
      return 'Invalid URI format';
    }
  }

  getConnectionStatus() {
    return {
      isConnected: this.isConnected,
      readyState: mongoose.connection.readyState,
      host: mongoose.connection.host,
      port: mongoose.connection.port,
      name: mongoose.connection.name
    };
  }

  async healthCheck() {
    try {
      if (!this.isConnected) {
        throw new Error('Database not connected');
      }

      // Simple ping to check connection
      await mongoose.connection.db.admin().ping();
      return { status: 'healthy' };
    } catch (error) {
      return { 
        status: 'unhealthy', 
        error: error.message 
      };
    }
  }
}

// Create singleton instance
const database = new DatabaseConnection();

// Initialize connection on module load
if (config.NODE_ENV !== 'test') {
  database.connect().catch(error => {
    logger.error('Failed to initialize database connection:', error);
  });
}

// Graceful shutdown
process.on('SIGINT', async () => {
  await database.disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await database.disconnect();
  process.exit(0);
});

module.exports = database;
