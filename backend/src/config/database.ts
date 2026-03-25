import mongoose from 'mongoose';
import { env } from './env';
import { logger } from '../utils/logger';

const MONGOOSE_OPTIONS: mongoose.ConnectOptions = {
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
  family: 4,
};

export async function connectDatabase(): Promise<void> {
  try {
    mongoose.set('strictQuery', true);

    // Security: disable debug logging in production
    if (env.NODE_ENV !== 'production') {
      mongoose.set('debug', false);
    }

    await mongoose.connect(env.MONGODB_URI, MONGOOSE_OPTIONS);
    logger.info('✅ MongoDB connected successfully');
  } catch (error) {
    logger.error('❌ MongoDB connection failed:', error);
    process.exit(1);
  }
}

// Graceful disconnect
export async function disconnectDatabase(): Promise<void> {
  try {
    await mongoose.disconnect();
    logger.info('MongoDB disconnected');
  } catch (error) {
    logger.error('MongoDB disconnect error:', error);
  }
}

// Connection event listeners
mongoose.connection.on('disconnected', () => {
  logger.warn('MongoDB disconnected — attempting reconnect...');
});

mongoose.connection.on('error', (err) => {
  logger.error('MongoDB connection error:', err);
});

process.on('SIGINT', async () => {
  await disconnectDatabase();
  process.exit(0);
});
