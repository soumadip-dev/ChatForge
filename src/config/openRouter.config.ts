import { OpenRouter } from '@openrouter/sdk';
import { env } from './env.config';
import { AppError } from '../errors/AppError';

if (!env.OPENROUTER_API_KEY) {
  throw new AppError(500, 'OPENROUTER_API_KEY is not set');
}

export const openRouter = new OpenRouter({
  apiKey: env.OPENROUTER_API_KEY,
});
