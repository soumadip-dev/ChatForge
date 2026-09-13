import { env } from './env.config';
import { createClient } from 'redis';
import { logger } from '../lib/logger.lib';

const redisUrl = env.REDIS_URL;

export const redisClient = createClient({ url: redisUrl });

redisClient.on('ready', () => {
  logger.info(`Redis client connected`);
});

redisClient.on('error', error => {
  logger.error(error, `Redis client error`);
});

redisClient.on('end', () => {
  logger.info(`Redis client disconnected`);
});

export async function connectRedis(): Promise<void> {
  if (!redisClient.isOpen) {
    await redisClient.connect();
  }
  const pong = await redisClient.ping();
  logger.info(`Redis ping: ${pong}`);
}

export async function disconnectRedis(): Promise<void> {
  if (redisClient.isOpen) {
    await redisClient.quit();
  }
}
