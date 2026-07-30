import { Router } from 'express';

import { register } from '../controllers/auth.controllers';
import { validate } from '../middlewares/validate.middleware';
import { registerSchema } from '../validators/auth.validator';

export const authRouter = Router();

authRouter.post('/register', validate(registerSchema), register);

// authRouter.post('/login', login);
// authRouter.post('/logout', logout);
// authRouter.post('/signup', signup);
// authRouter.get('/profile', authUserMiddleware, profile);
