import express from 'express';
import { applySecurityMiddleware } from './middleware/security.middleware';
import { globalErrorHandler, notFoundHandler } from './middleware/auth.middleware';
import { apiRouter } from './routes';
import { connectDatabase } from './config/database';
import { env } from './config/env';
import { logger } from './utils/logger';

async function bootstrap(): Promise<void> {
  const app = express();

  // ── Security & Parsing ──────────────────────────────────────────────────────
  applySecurityMiddleware(app);
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false, limit: '1mb' }));

  // ── Routes ──────────────────────────────────────────────────────────────────
  app.use('/api', apiRouter);

  // ── Error Handling ──────────────────────────────────────────────────────────
  app.use(notFoundHandler);
  app.use(globalErrorHandler);

  // ── Database ────────────────────────────────────────────────────────────────
  await connectDatabase();

  // ── Start Server ────────────────────────────────────────────────────────────
  const server = app.listen(env.PORT, () => {
    logger.info(`🚀 SecurePass API running on port ${env.PORT} [${env.NODE_ENV}]`);
  });

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info(`${signal} received — shutting down gracefully`);
    server.close(() => {
      logger.info('HTTP server closed');
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrap().catch((err) => {
  logger.error('Failed to start server:', err);
  process.exit(1);
});
