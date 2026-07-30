import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().default(8080),
  DATABASE_URL: z.string().default(''),

  NODE_ENV: z.string().default('development'),
  LOG_LEVEL: z.string().default('info'),

  CORS_ORIGINS: z
    .string()
    .default('')
    .transform(value =>
      value
        .split(',')
        .map(origin => origin.trim())
        .filter(Boolean)
    ),
  JWT_SECRET: z.string().default('secret'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('1h'),
});

export const env = envSchema.parse(process.env);
