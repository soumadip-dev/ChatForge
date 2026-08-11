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
} from '../lib/openrouter.lib';

import { generateAIResponse } from './ai.service';

import { logger } from '../lib/logger.lib';

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

  // --------------------------------------------------
  // 1. Find existing chat
  // --------------------------------------------------

  if (chatId) {
    chat = await getSingleChatById(chatId, userId);

    if (!chat) {
      return null;
    }
  }

  // --------------------------------------------------
  // 2. Create new chat
  // --------------------------------------------------
  else {
    const topic = content.slice(0, 40);

    chat = await createChat(userId, topic, model!);
  }

  // --------------------------------------------------
  // 3. Get user
  // --------------------------------------------------

  const user = await findUserById(userId);

  if (!user) {
    throw new Error('User not found');
  }

  // --------------------------------------------------
  // 4. Reset token usage if required
  // --------------------------------------------------

  await resetUsageIfNeeded(user);

  // --------------------------------------------------
  // 5. Check token limit
  // --------------------------------------------------

  if (hasTokenLimitReached(user)) {
    throw new Error('Token limit reached. Please try after some time.');
  }

  // --------------------------------------------------
  // 6. Get previous messages for AI context
  // --------------------------------------------------

  const oldMessages = await getMessagesForAI(chat.id, chat.summarized_till_message_number);

  // --------------------------------------------------
  // 7. Build AI messages
  // --------------------------------------------------

  const messagesForAI = buildMessagesForAI({
    chat,
    oldMessages,
    currentMessage: content,
  });

  // --------------------------------------------------
  // 8. Generate AI response
  // --------------------------------------------------

  const { aiResponse, usage } = await generateAIResponse({
    model: chat.model,
    messages: messagesForAI,
  });

  // --------------------------------------------------
  // 9. Save user message
  // --------------------------------------------------

  const userMessage = await createMessage(userId, chat.id, 'user', content);

  // --------------------------------------------------
  // 10. Save assistant message
  // --------------------------------------------------

  const assistantMessage = await createMessage(userId, chat.id, 'assistant', aiResponse, usage);

  // --------------------------------------------------
  // 11. Two messages were created
  //     user + assistant
  // --------------------------------------------------

  const newMessageCount = chat.message_count + 2;

  // Keep local chat object in sync
  chat.message_count = newMessageCount;

  // --------------------------------------------------
  // 12. Update topic if it is still "New Chat"
  // --------------------------------------------------

  if (chat.topic === 'New Chat') {
    const newTopic = content.slice(0, 40);

    chat.topic = newTopic;

    await updateChatMetadata(chat.id, newMessageCount, newTopic);
  } else {
    await updateChatMetadata(chat.id, newMessageCount);
  }

  // --------------------------------------------------
  // 13. Add token usage to chat
  // --------------------------------------------------

  await updateChatTokens(chat.id, usage);

  // --------------------------------------------------
  // 14. Add token usage to user
  // --------------------------------------------------

  await incrementUserTokenUsage(userId, usage.totalTokens);

  // --------------------------------------------------
  // 15. Update summary in background
  // --------------------------------------------------

  updateSummaryIfNeeded(chat.id, userId).catch(error => {
    logger.error(error, `Failed to update summary for chat ${chat.id}`);
  });

  // --------------------------------------------------
  // 16. Return result to controller
  // --------------------------------------------------

  return {
    chat,
    userMessage,
    assistantMessage,
  };
}
