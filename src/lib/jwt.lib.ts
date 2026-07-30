import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../config/env.config';
import type { TokenPayload } from '../types/user.types';
import { AppError } from '../errors/AppError';

//* Create a new token and return it
export function createToken(payload: TokenPayload): string {
  const secret = env.JWT_SECRET;

  if (!secret) {
    throw new Error('JWT_SECRET is missing');
  }

  const options: SignOptions = {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN as SignOptions['expiresIn'],
  };

  return jwt.sign(payload, secret, options);
}

//* Verify the token and return the decoded payload
export function verifyToken(token: string): TokenPayload {
  try {
    const secret = env.JWT_SECRET;

    if (!secret) {
      throw new Error('JWT_SECRET is missing');
    }
    return jwt.verify(token, secret) as TokenPayload;
  } catch (error) {
    throw new AppError(401, 'Invalid or expired access token');
  }
}
