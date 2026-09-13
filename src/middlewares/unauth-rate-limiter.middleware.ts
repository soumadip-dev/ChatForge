import type { Request, Response, NextFunction } from 'express';

import { redisClient } from '../config/redis.config';
import { AppError } from '../errors/AppError';
import { logger } from '../lib/logger.lib';

const RATE_LIMIT_WINDOW_SECONDS = 60;
const RATE_LIMIT_MAX_REQUESTS = 10;

export async function unauthenticatedRateLimiterMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const clientIpAddress = req.ip || 'unknown';
    const rateLimitKey = `rate_limit:unauthenticated:${clientIpAddress}`;

    // Increment the request count for this IP address.
    const requestCount = await redisClient.incr(rateLimitKey);

    // Set the expiration only when the key is created.
    if (requestCount === 1) {
      await redisClient.expire(rateLimitKey, RATE_LIMIT_WINDOW_SECONDS);
    }

    const remainingRequests = Math.max(0, RATE_LIMIT_MAX_REQUESTS - requestCount);

    res.setHeader('X-RateLimit-Limit', RATE_LIMIT_MAX_REQUESTS);
    res.setHeader('X-RateLimit-Remaining', remainingRequests);

    if (requestCount > RATE_LIMIT_MAX_REQUESTS) {
      return next(new AppError(429, 'Too many requests. Please try again later.'));
    }

    return next();
  } catch (error) {
    logger.error(error);

    if (error instanceof AppError) {
      return next(error);
    }

    return next();
  }
}
