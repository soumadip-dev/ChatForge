import type { NextFunction, Request, Response } from 'express';
import { deleteUserService, loginUserService, registerUserService } from '../services/auth.service';
import { cookieOptions } from '../config/cookie.config';
import { logger } from '../lib/logger.lib';
import { redisClient } from '../config/redis.config';
import { getTokenUsage } from '../lib/token-usage.lib';
import { env } from '../config/env.config';

//* Register a new user
export const register = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, age, email, password } = req.body;

    logger.info(`Registration attempt for email: ${email}`);

    const { accessToken, newUser } = await registerUserService({ name, age, email, password });

    res.cookie('accessToken', accessToken, cookieOptions);

    logger.info(`User registered successfully: ${email}`);

    res.status(201).json({
      succes: true,
      message: 'User registered successfully',
      data: {
        name: newUser.name,
        age: newUser.age,
        email: newUser.email,
      },
    });
  } catch (error) {
    logger.error(error as Error, `Error during registration for ${req.body?.email}`);
    next(error);
  }
};

//* Login a user
export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;

    logger.info(`Login attempt for email: ${email}`);

    const { accessToken, user } = await loginUserService({ email, password });

    const tokenUsed = await getTokenUsage(user.id);

    res.cookie('accessToken', accessToken, cookieOptions);

    logger.info(`User logged in successfully: ${email}`);

    res.status(200).json({
      success: true,
      message: 'User logged in successfully',
      data: {
        name: user.name,
        age: user.age,
        email: user.email,
        usage: {
          tokenUsed,
          tokenLimit: env.TOKEN_LIMIT,
          totalTokenUsed: user.total_token_used,
        },
      },
    });
  } catch (error) {
    logger.error(error as Error, `Login error for email ${req.body?.email}`);
    next(error);
  }
};

//* Logout a user
export const logout = async (req: Request, res: Response, next: NextFunction) => {
  try {
    logger.info(`Logout attempt for user: ${req.user?.email}`);

    const token = req.token;
    const payload = req.tokenpayload;

    if (token && payload?.exp) {
      const nowInSeconds = Math.floor(Date.now() / 1000);
      const remainingTtl = payload.exp - nowInSeconds;

      if (remainingTtl > 0) {
        await redisClient.SETEX(`blocklist:${token}`, remainingTtl, 'blocked');
      }
    }

    res.clearCookie('accessToken', cookieOptions);

    logger.info(`User logged out successfully:${req.user?.email}`);

    res.status(200).json({
      succes: true,
      message: 'User logged out successfully',
    });
  } catch (error) {
    logger.error(error as Error, 'Error during logout');
    next(error);
  }
};

//* Fetch user profile
export const profile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    logger.info(`Profile fetched for user: ${req.user.email}`);

    const tokenUsed = await getTokenUsage(req.user.id);

    res.status(200).json({
      success: true,
      message: 'User profile fetched successfully',
      data: {
        name: req.user.name,
        age: req.user.age,
        email: req.user.email,
        usage: {
          tokenUsed,
          tokenLimit: env.TOKEN_LIMIT,
          totalTokenUsed: req.user.total_token_used,
        },
      },
    });
  } catch (error) {
    logger.error(error as Error, `Error fetching profile for user ${req.user?.email}`);
    next(error);
  }
};

//* Delete user account
export const deleteAccount = async (req: Request, res: Response, next: NextFunction) => {
  try {
    logger.info(`Account deleted for user: ${req.user.email}`);

    const { id } = req.user;

    await deleteUserService(id);

    res.clearCookie('accessToken', cookieOptions);

    logger.info(`Account deleted successfully for user: ${req.user.email}`);

    res.status(200).json({
      succes: true,
      message: 'Account deleted successfully',
    });
  } catch (error) {
    logger.error(error as Error, `Error deleting account for user ${req.user?.email}`);
    next(error);
  }
};
