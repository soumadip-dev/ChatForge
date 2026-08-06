// combine all your routes here
// plugging all your routes into one place

import { Router } from 'express';
import { healthRouter } from './health.routes';
import { authRouter } from './auth.routes';
import { chatRouter } from './chat.routes';
import { authenticate } from '../middlewares/auth.middleware';
import { messageRouter } from './message.routes';

export const apiRouter = Router();

apiRouter.use(healthRouter);
apiRouter.use('/auth', authRouter);
apiRouter.use('/chat', authenticate, chatRouter);
apiRouter.use('/message', authenticate, messageRouter);
