import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { env } from './env.config';
import { AppError } from '../errors/AppError';

if (!env.GEMINI_API_KEY) {
  throw new AppError(500, 'GEMINI_API_KEY is not set');
}

export const createGeminiModel = (model: string) => {
  return new ChatGoogleGenerativeAI({
    model,
    temperature: 0,
    maxRetries: 2,
    apiKey: env.GEMINI_API_KEY,
  });
};
