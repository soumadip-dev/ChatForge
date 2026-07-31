import type { NextFunction, Request, Response } from 'express';
import { loginUser, registerUser } from '../services/auth.services';
import { cookieOptions } from '../config/cookie.config';

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

    res.status(200).json({
      succes: true,
      message: 'User logged in successfully',
      data: {
        name: user.name,
        age: user.age,
        email: user.email,
        usage: {
          tokenUsed: user.tokenUsed,
          tokenLimit: user.tokenLimit,
          resetAt: user.resetAt,
          totalTokenUsed: user.totalTokenUsed,
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
