import { redisClient } from '../config/redis.config';
import { env } from '../config/env.config';

function getTokenKey(userId: string): string {
  return `token_usage:${userId}`;
}

export async function getTokenUsage(userId: string): Promise<number> {
  const key = getTokenKey(userId);

  const usage = await redisClient.GET(key);

  return usage ? Number(usage) : 0;
}

export async function incrementTokenUsage(userId: string, tokens: number): Promise<number> {
  const key = getTokenKey(userId);

  const newUsage = await redisClient.INCRBY(key, tokens);

  // Set the TTL only when the usage key is created.
  if (newUsage === tokens) {
    await redisClient.expire(key, env.TOKEN_WINDOW_SECONDS);
  }

  return newUsage;
}
