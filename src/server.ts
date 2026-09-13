// root file

import { createApp } from './app';
import { env } from './config/env.config';
import { connectRedis, disconnectRedis } from './config/redis.config';
import { logger } from './lib/logger.lib';

const app = createApp();

const PORT = env.PORT || 8080;

async function startServer() {
  try {
    await connectRedis();
    const server = app.listen(PORT, () => {
      logger.info(`Server listening at http://localhost:${PORT} 🌐`);
    });

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info(`${signal} received. Shutting down server...`);

      server.close(async () => {
        await disconnectRedis();
        logger.info('Server shut down successfully');
        process.exit(0);
      });
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  } catch (error) {
    logger.error(error, 'Failed to start server');
    process.exit(1);
  }
}

startServer();
