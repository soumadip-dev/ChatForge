import type { Request, Response, NextFunction } from 'express';
import { logger } from '../lib/logger.lib';

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  logger.error({ err }, 'Unhandled error');

  return res.status(500).json({
    success: false,
    message: 'Internal server error',
  });
}
