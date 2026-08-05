import type { NextFunction, Request, Response } from 'express';
import { logger } from '../lib/logger.lib';
import {
  createNewChat,
  deleteChatById,
  getRecentTwentyChats,
  getSingleChatById,
} from '../repositories/chat.repository';

//* Get the most recent 20 chats for a user
export const getRecentChats = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;

    logger.info(`Fetching recent chats for user: ${userId}`);

    const recentChats = await getRecentTwentyChats(userId);

    logger.info(`Fetched ${recentChats.length} recent chats for user: ${userId}`);

    res.status(200).json({
      success: true,
      message: recentChats.length > 0 ? 'Recent chats fetched successfully' : 'No chats found',
      data: recentChats,
    });
  } catch (error) {
    logger.error(error as Error, `Error fetching recent chats for user ${req.user?.email}`);
    next(error);
  }
};

//* Create a new chat
export const createChat = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { model } = req.body;
    const userId = req.user!.id;

    if (!model) {
      next(new Error('Model is required'));
      return;
    }

    logger.info(`Creating chat for user: ${userId}`);

    const chat = await createNewChat(userId, model);

    logger.info(`Created chat ${chat.id} for user: ${userId}`);

    res.status(201).json({
      success: true,
      message: 'Chat created successfully',
      data: {
        chatId: chat.id,
        userId: chat.user_id,
        model: chat.model,
        topic: chat.topic,
        createdAt: chat.created_at,
      },
    });
  } catch (error) {
    logger.error(error as Error, `Error creating chat for user ${req.user?.email}`);
    next(error);
  }
};

//* Get a chat by id
export const getChatById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    if (!id || Array.isArray(id)) {
      res.status(400).json({
        success: false,
        message: 'Invalid chat id',
      });
      return;
    }
    const userId = req.user.id;

    logger.info(`Fetching chat ${id} for user ${userId}`);

    const chat = await getSingleChatById(id, userId);

    if (!chat) {
      res.status(404).json({
        success: false,
        message: 'Chat not found',
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Chat fetched successfully',
      data: chat,
    });
  } catch (error) {
    logger.error(
      error as Error,
      `Error fetching chat ${req.params.id} for user ${req.user?.email}`
    );

    next(error);
  }
};

//* Delete a chat by id
export const deleteChat = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    if (!id || Array.isArray(id)) {
      res.status(400).json({
        success: false,
        message: 'Invalid chat id',
      });
      return;
    }

    logger.info(`Deleting chat ${id} for user ${userId}`);

    const deleted = await deleteChatById(id, userId);

    if (!deleted) {
      res.status(404).json({
        success: false,
        message: 'Chat not found',
      });
      return;
    }

    logger.info(`Deleted chat ${id} for user ${userId}`);

    res.status(200).json({
      success: true,
      message: 'Chat deleted successfully',
    });
  } catch (error) {
    logger.error(error as Error, `Error deleting chat ${req.params.id}`);
    next(error);
  }
};
