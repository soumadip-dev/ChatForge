import type { NextFunction, Request, Response } from 'express';
import { loginUser, registerUser } from '../services/auth.services';
import { cookieOptions } from '../config/cookie.config';
import { logger } from '../lib/logger.lib';

//* Register a new user
export const register = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, age, email, password } = req.body;

    const { accessToken, newUser } = await registerUser({ name, age, email, password });

    res.cookie('accessToken', accessToken, cookieOptions);

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
    next(error);
  }
};

//* Login a user
export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;

    const { accessToken, user } = await loginUser({ email, password });

    res.cookie('accessToken', accessToken, cookieOptions);

    logger.info(user);

    res.status(200).json({
      succes: true,
      message: 'User logged in successfully',
      data: {
        name: user.name,
        age: user.age,
        email: user.email,
        usage: {
          tokenUsed: user.token_used,
          tokenLimit: user.token_limit,
          resetAt: user.reset_at,
          totalTokenUsed: user.total_token_used,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

//* Logout a user
export const logout = async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.clearCookie('accessToken', cookieOptions);
    res.status(200).json({
      succes: true,
      message: 'User logged out successfully',
    });
  } catch (error) {
    next(error);
  }
};

//* Fetch user profile
export const profile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.status(200).json({
      succes: true,
      message: 'User profile fetched successfully',
      data: {
        name: req.user.name,
        age: req.user.age,
        email: req.user.email,
        usage: {
          tokenUsed: req.user.token_used,
          tokenLimit: req.user.token_limit,
          resetAt: req.user.reset_at,
          totalTokenUsed: req.user.total_token_used,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};
