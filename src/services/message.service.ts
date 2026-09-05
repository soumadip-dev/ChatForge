import {
  createChat,
  updateChatMetadata,
  updateChatTokens,
  getSingleChatById,
} from '../repositories/chat.repository';

import {
  createMessage,
  getMessagesByChatId,
  getMessagesForAI,
} from '../repositories/message.repository';

import { findUserById, incrementUserTokenUsage } from '../repositories/user.repository';

import {
  resetUsageIfNeeded,
  hasTokenLimitReached,
  buildMessagesForAI,
  updateSummaryIfNeeded,
} from '../lib/gemini.lib';

import { generateAIResponse } from './ai.service';

import { logger } from '../lib/logger.lib';
import { AppError } from '../errors/AppError';

interface SendMessageInput {
  userId: string;
  chatId?: string;
  model?: string;
  content: string;
}

export async function getMessagesService(userId: string, chatId: string) {
  const chat = await getSingleChatById(chatId, userId);

  if (!chat) {
    return null;
  }

  return getMessagesByChatId(chatId);
}

export async function sendMessageService({ userId, chatId, model, content }: SendMessageInput) {
  let chat;

  // Find the existing chat using the chat ID and user ID.
  if (chatId) {
    chat = await getSingleChatById(chatId, userId);

    if (!chat) {
      return null;
    }
  }

  // Create a new chat when no chat ID is provided.
  else {
    const topic = content.slice(0, 40);

    chat = await createChat(userId, topic, model!);
  }

  // Get the user from the database.
  const user = await findUserById(userId);

  if (!user) {
    throw new Error('User not found');
  }

  // Reset the user's token usage if the current 5-hour usage period has expired.
  await resetUsageIfNeeded(user);

  // Check whether the user has reached their token usage limit.
  if (hasTokenLimitReached(user)) {
    throw new AppError(400, 'Token limit reached. Please try after some time.');
  }

  // Get previous messages that have not been included in the chat summary yet.
  const oldMessages = await getMessagesForAI(chat.id, chat.summarized_till_message_number);

  // Build the AI context using the system prompt, previous summary,
  // previous messages, and the current user message.
  const messagesForAI = buildMessagesForAI({
    chat,
    oldMessages,
    currentMessage: content,
  });

  // Generate the AI response using the selected chat model and conversation context.
  const { aiResponse, usage } = await generateAIResponse({
    model: chat.model,
    messages: messagesForAI,
  });

  // Save the user's message to the database.
  const userMessage = await createMessage(userId, chat.id, 'user', content);

  // Save the assistant's response and its token usage to the database.
  const assistantMessage = await createMessage(userId, chat.id, 'assistant', aiResponse, usage);

  // Two messages were created: one user message and one assistant message.
  const newMessageCount = chat.message_count + 2;

  // Keep the local chat object synchronized with the new message count.
  chat.message_count = newMessageCount;

  // Update the default chat topic using the first user message else update only the message count.
  if (chat.topic === 'New Chat') {
    const newTopic = content.slice(0, 40);

    chat.topic = newTopic;

    await updateChatMetadata(chat.id, newMessageCount, newTopic);
  } else {
    await updateChatMetadata(chat.id, newMessageCount);
  }

  // Add the AI prompt, completion, and total token usage to the chat.
  await updateChatTokens(chat.id, usage);

  // Add the AI's total token usage to the user's current and lifetime usage.
  await incrementUserTokenUsage(userId, usage.totalTokens);

  // Update the chat summary in the background when at least 10 messages are unsummarized.
  updateSummaryIfNeeded(chat.id, userId).catch(error => {
    logger.error(error, `Failed to update summary for chat ${chat.id}`);
  });

  return {
    chat,
    userMessage,
    assistantMessage,
  };
}
