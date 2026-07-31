// entry file for express
// express related logic
import express from 'express';
import helmet from 'helmet';

import { configCors } from './config/cors.config';

import { NotFound } from './middlewares/notFound.middleware';
import { errorHandler } from './middlewares/errorhandler.middleware';

import { apiRouter } from './routes';

export function createApp() {
  const app = express();

  app.use(configCors());
  app.use(helmet());

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.use('/api', apiRouter);

  app.use(NotFound);
  app.use(errorHandler);

  return app;
}
