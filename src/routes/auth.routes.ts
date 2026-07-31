import { Router } from 'express';

import { login, logout, register } from '../controllers/auth.controllers';
import { validate } from '../middlewares/validate.middleware';
import { loginSchema, registerSchema } from '../validators/auth.validator';

export const authRouter = Router();

authRouter.post('/register', validate(registerSchema), register);
authRouter.post('/login', validate(loginSchema), login);
authRouter.post('/logout', logout);

// authRouter.get('/profile', authUserMiddleware, profile);
