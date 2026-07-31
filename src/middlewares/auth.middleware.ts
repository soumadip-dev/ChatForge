import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors/AppError';
import { verifyToken } from '../lib/jwt.lib';
import { findUserById } from '../repositories/user.repository';
import { logger } from '../lib/logger.lib';

export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const token = req.cookies.accessToken;

    const payload = verifyToken(token);

    const existingUser = await findUserById(payload.id);

    if (!existingUser) {
      return next(new AppError(401, 'User not found'));
    }

    req.user = existingUser;

    return next();
  } catch (error) {
    logger.error(error);
    return next(new AppError(500, 'Internal server error'));
  }
}
