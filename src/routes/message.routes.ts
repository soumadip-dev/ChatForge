import { Router } from 'express';

import { authenticate } from '../middlewares/auth.middleware';
import { getMessages, sendMessage } from '../controllers/message.controller';

export const messageRouter = Router();

messageRouter.get('/:id', getMessages);
messageRouter.post('/:id', sendMessage);
