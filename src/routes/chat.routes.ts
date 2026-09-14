// getrecentchats: top 20
// getsinglechat
//createchat
//deletechat

import { Router } from 'express';

import {
  createChat,
  deleteChat,
  getChatById,
  getRecentChats,
} from '../controllers/chat.controller';

export const chatRouter = Router();

chatRouter.get('/recentchats', getRecentChats);
chatRouter.post('/createchat', createChat);
chatRouter.get('/:id', getChatById);
chatRouter.delete('/:id', deleteChat);
