import { ZodType, ZodError } from 'zod';
import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors/AppError';

export const validate = (schema: ZodType) => (req: Request, _res: Response, next: NextFunction) => {
  try {
    req.body = schema.parse(req.body);
    next();
  } catch (error) {
    if (error instanceof ZodError) {
      const message = error.issues.map(issue => issue.message).join(', ');

      return next(new AppError(400, message));
    }

    next(error);
  }
};
