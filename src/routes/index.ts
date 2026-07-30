// combine all your routes here
// plugging all your routes into one place

import { Router } from 'express';
import { healthRouter } from './health.routes';

export const apiRouter = Router();

apiRouter.use('/health', healthRouter);
