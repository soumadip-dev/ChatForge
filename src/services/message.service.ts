import { createChat, getSingleChatById, updateChatMetadata } from '../repositories/chat.repository';

import { createMessage, getMessagesByChatId } from '../repositories/message.repository';

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

  // Existing chat
  if (chatId) {
    chat = await getSingleChatById(chatId, userId);

    if (!chat) {
      return null;
    }
  }

  // New chat
  else {
    const topic = content.slice(0, 40);

    chat = await createChat(userId, topic, model!);
  }

  const userMessage = await createMessage(userId, chat.id, 'user', content);

  // TODO: Replace with AI response generation.
  const dummyAiReply = 'Hello, I am an AI assistant. How can I help you today.';

  const assistantMessage = await createMessage(userId, chat.id, 'assistant', dummyAiReply);

  const newMessageCount = chat.message_count + 2;

  chat.message_count = newMessageCount;

  if (chat.topic === 'New Chat') {
    const newTopic = content.slice(0, 40);

    chat.topic = newTopic;

    await updateChatMetadata(chat.id, newMessageCount, newTopic);
  } else {
    await updateChatMetadata(chat.id, newMessageCount);
  }

  return {
    chat,
    userMessage,
    assistantMessage,
  };
}
