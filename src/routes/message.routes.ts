import { Router } from 'express';

import { authenticate } from '../middlewares/auth.middleware';
import { getMessage, sendMessage } from '../controllers/message.controller';

export const messageRouter = Router();

messageRouter.get('/:id', authenticate, getMessage);
messageRouter.post('/:id', authenticate, sendMessage);
