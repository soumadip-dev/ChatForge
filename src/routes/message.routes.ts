import { Router } from 'express';

import { getMessages, sendMessage } from '../controllers/message.controller';

export const messageRouter = Router();

messageRouter.get('/:id', getMessages);
messageRouter.post('/', sendMessage);
messageRouter.post('/:id', sendMessage);
