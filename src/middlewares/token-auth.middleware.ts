import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors/AppError';
import { verifyToken } from '../lib/jwt.lib';
import { logger } from '../lib/logger.lib';
import { redisClient } from '../config/redis.config';

export async function authenticateToken(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const token = req.cookies.accessToken;

    const payload = verifyToken(token);

    const blockedToken = await redisClient.get(`blocklist:${token}`);

    if (blockedToken) {
      return next(new AppError(401, 'Please login again'));
    }

    req.token = token;
    req.tokenpayload = payload;

    return next();
  } catch (error) {
    logger.error(error);

    if (error instanceof AppError) {
      return next(error);
    }

    return next(new AppError(500, 'Internal server error'));
  }
}
