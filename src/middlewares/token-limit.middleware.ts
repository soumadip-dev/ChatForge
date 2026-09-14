import type { Request, Response, NextFunction } from 'express';

import { getTokenUsage } from '../lib/token-usage.lib';
import { env } from '../config/env.config';
import { AppError } from '../errors/AppError';

export async function tokenLimitMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.tokenpayload.id;
    const tokenUsed = await getTokenUsage(userId);

    if (tokenUsed >= env.TOKEN_LIMIT) {
      next(new AppError(429, 'Token limit reached. Please try again later.'));
      return;
    }
    next();
  } catch (error) {
    next(error);
  }
}
