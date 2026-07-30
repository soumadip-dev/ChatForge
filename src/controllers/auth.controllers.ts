import type { NextFunction, Request, Response } from 'express';
import { registerUser } from '../services/auth.services';
import { cookieOptions } from '../config/cookie.config';

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
