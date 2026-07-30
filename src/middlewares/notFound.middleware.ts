import type { NextFunction, Request, Response } from 'express';
import { logger } from '../lib/logger.lib';

export function NotFound(req: Request, res: Response, next: NextFunction) {
  res.status(404).json({ success: false, message: 'Route not found' });
  logger.error(`Route not found ${req.method} ${req.url}`);
}
