import type { CorsOptions } from 'cors';
import cors from 'cors';
import { env } from './env.config';
import { logger } from '../lib/logger.lib';

//* Function that creates and returns a configured CORS middleware instance
export const configCors = () => {
  const allowedOrigins = env.CORS_ORIGINS;

  const options: CorsOptions = {
    origin: (
      origin: string | undefined,
      callback: (error: Error | null, allow?: boolean) => void
    ) => {
      // Allow requests without Origin (Postman, mobile apps, server-to-server)
      if (!origin) {
        logger.info('CORS allowed for request without origin ✅');
        return callback(null, true);
      }

      // Check if the origin is in the allowedOrigins array
      if (allowedOrigins.includes(origin)) {
        logger.info(`CORS allowed for origin: ${origin} ✅`);
        return callback(null, true);
      }

      logger.warn(`CORS denied for origin: ${origin} ❌`);
      return callback(new Error('Not allowed by CORS'));
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept-Version'],
    exposedHeaders: ['X-Total-Count', 'Content-Range'],
    credentials: true,
    preflightContinue: false,
    maxAge: 600,
    optionsSuccessStatus: 204,
  };
  logger.info(`CORS middleware configured with origins: ${allowedOrigins.join(', ')} ✅`);

  return cors(options);
};
