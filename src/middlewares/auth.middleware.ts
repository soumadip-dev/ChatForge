import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors/AppError';
import { verifyToken } from '../lib/jwt.lib';
import { findUserById } from '../repositories/user.repository';
import { logger } from '../lib/logger.lib';
import { redisClient } from '../config/redis.config';

export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const token = req.cookies.accessToken;

    const payload = verifyToken(token);

    const blockedToken = await redisClient.get(`blocklist:${token}`);

    if (blockedToken) {
      logger.info(`Token blocked: ${token}`);
      return next(new AppError(401, 'Please login again'));
    }

    const existingUser = await findUserById(payload.id);

    if (!existingUser) {
      return next(new AppError(401, 'User not found'));
    }

    req.user = existingUser;
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
