import type { NextFunction, Request, Response } from 'express';
import { logger } from '../lib/logger.lib';
import { getMessagesService, sendMessageService } from '../services/message.service';

//* Get all messages for a chat
export const getMessages = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id: chatId } = req.params;
    const userId = req.user!.id;

    if (!chatId || Array.isArray(chatId)) {
      res.status(400).json({
        success: false,
        message: 'Invalid chat ID',
      });
      return;
    }

    logger.info(`Fetching messages for chat ${chatId} (user: ${userId})`);

    const messages = await getMessagesService(userId, chatId);

    if (!messages) {
      logger.warn(`Chat ${chatId} not found for user ${userId}`);

      res.status(404).json({
        success: false,
        message: 'Chat not found',
      });
      return;
    }

    logger.info(`Fetched ${messages.length} messages for chat ${chatId}`);

    res.status(200).json({
      success: true,
      message: messages.length > 0 ? 'Messages fetched successfully' : 'No messages found',
      data: messages,
    });
  } catch (error) {
    logger.error(error as Error, `Error fetching messages for chat ${req.params.id}`);

    next(error);
  }
};

//* Send a message in a chat
export const sendMessage = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id: chatId } = req.params;
    const { content } = req.body;
    const userId = req.user!.id;

    if (!chatId || Array.isArray(chatId)) {
      res.status(400).json({
        success: false,
        message: 'Invalid chat ID',
      });
      return;
    }

    if (!content || content.trim() === '') {
      res.status(400).json({
        success: false,
        message: 'Message content is required',
      });
      return;
    }

    logger.info(`Sending message to chat ${chatId} (user: ${userId})`);

    const result = await sendMessageService(userId, chatId, content.trim());

    if (!result) {
      logger.warn(`Chat ${chatId} not found for user ${userId}`);

      res.status(404).json({
        success: false,
        message: 'Chat not found',
      });
      return;
    }

    logger.info(`Created user message ${result.userMessage.id} for chat ${chatId}`);

    logger.info(`Created assistant message ${result.assistantMessage.id} for chat ${chatId}`);

    res.status(201).json({
      success: true,
      message: 'Message sent successfully',
      data: result.assistantMessage,
    });
  } catch (error) {
    logger.error(error as Error, `Error sending message to chat ${req.params.id}`);

    next(error);
  }
};
