import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors/AppError';
import { findUserById } from '../repositories/user.repository';
import { logger } from '../lib/logger.lib';

export async function authenticateUser(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const existingUser = await findUserById(req.tokenpayload.id);

    if (!existingUser) {
      return next(new AppError(401, 'User not found'));
    }

    req.user = existingUser;

    return next();
  } catch (error) {
    logger.error(error);

    if (error instanceof AppError) {
      return next(error);
    }

    return next(new AppError(500, 'Internal server error'));
  }
}
