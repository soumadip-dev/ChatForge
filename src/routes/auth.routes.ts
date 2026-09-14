import { Router } from 'express';

import { login, logout, register, profile, deleteAccount } from '../controllers/auth.controller';

import { authenticateToken } from '../middlewares/token-auth.middleware';
import { authenticateUser } from '../middlewares/user-auth.middleware';
import { unauthenticatedRateLimiterMiddleware } from '../middlewares/unauth-rate-limiter.middleware';
import { validate } from '../middlewares/validate.middleware';

import { loginSchema, registerSchema } from '../validators/auth.validator';
import { authenticatedRateLimiterMiddleware } from '../middlewares/auth-rate-limiter.middleware';

export const authRouter = Router();

authRouter.post(
  '/register',
  unauthenticatedRateLimiterMiddleware,
  validate(registerSchema),
  register
);
authRouter.post('/login', unauthenticatedRateLimiterMiddleware, validate(loginSchema), login);
authRouter.post(
  '/logout',
  authenticateToken,
  authenticatedRateLimiterMiddleware,
  authenticateUser,
  logout
);

authRouter.get(
  '/profile',
  authenticateToken,
  authenticatedRateLimiterMiddleware,
  authenticateUser,
  profile
);

authRouter.delete(
  '/delete',
  authenticateToken,
  authenticatedRateLimiterMiddleware,
  authenticateUser,
  deleteAccount
);
