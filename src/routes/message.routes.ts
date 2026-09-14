import { Router } from 'express';

import { getMessages, sendMessage } from '../controllers/message.controller';
import { tokenLimitMiddleware } from '../middlewares/token-limit.middleware';

export const messageRouter = Router();

messageRouter.get('/:id', getMessages);
messageRouter.post('/', tokenLimitMiddleware, sendMessage);
messageRouter.post('/:id', tokenLimitMiddleware, sendMessage);
