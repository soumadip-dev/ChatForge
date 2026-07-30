import type { CookieOptions } from 'express';
import { env } from './env.config';

export const cookieOptions: CookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: 60 * 60 * 1000, // 1 hour
};
