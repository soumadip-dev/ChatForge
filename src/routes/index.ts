// combine all your routes here
// plugging all your routes into one place

import { Router } from 'express';
import { healthRouter } from './health.routes';
import { authRouter } from './auth.routes';
import { chatRouter } from './chat.routes';
import { authenticateToken } from '../middlewares/token-auth.middleware';
import { authenticateUser } from '../middlewares/user-auth.middleware';
import { messageRouter } from './message.routes';
import { authenticatedRateLimiterMiddleware } from '../middlewares/auth-rate-limiter.middleware';

export const apiRouter = Router();

apiRouter.use(healthRouter);
apiRouter.use('/auth', authRouter);

apiRouter.use(
  '/chat',
  authenticateToken,
  authenticatedRateLimiterMiddleware,
  authenticateUser,
  chatRouter
);

apiRouter.use(
  '/message',
  authenticateToken,
  authenticatedRateLimiterMiddleware,
  authenticateUser,
  messageRouter
);
