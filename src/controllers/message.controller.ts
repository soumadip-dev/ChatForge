import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';

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

//* Send a message
export const sendMessage = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = req.params.id;
    const chatId = typeof id === 'string' ? id : undefined;

    const { content, model } = req.body;
    const userId = req.user!.id;

    if (!content || content.trim() === '') {
      res.status(400).json({
        success: false,
        message: 'Message content is required',
      });
      return;
    }

    // Only required when creating a new chat
    if (!chatId && !model) {
      res.status(400).json({
        success: false,
        message: 'Model is required for new chat',
      });
      return;
    }

    if (chatId) {
      const result = z.uuid().safeParse(chatId);

      if (!result.success) {
        res.status(400).json({
          success: false,
          message: 'Invalid chat ID',
        });
        return;
      }
    }

    logger.info(`Processing message request for chat ${chatId ?? '(new)'} (user: ${userId})`);

    const result = await sendMessageService({
      userId,
      chatId,
      model,
      content: content.trim(),
    });

    if (!result) {
      logger.warn(`Chat ${chatId} not found for user ${userId}`);

      res.status(404).json({
        success: false,
        message: 'Chat not found',
      });
      return;
    }

    logger.info(`Message processed successfully for chat ${result.chat.id}`);

    res.status(201).json({
      success: true,
      message: 'Message sent successfully',
      data: {
        chatId: result.chat.id,
        userMessage: result.userMessage,
        assistantMessage: result.assistantMessage,
      },
    });
  } catch (error) {
    logger.error(error as Error, `Error sending message to chat ${req.params.id ?? '(new)'}`);
    next(error);
  }
};
