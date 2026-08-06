import { getSingleChatById } from '../repositories/chat.repository';
import { createMessage, getMessagesByChatId } from '../repositories/message.repository';

export async function getMessagesService(userId: string, chatId: string) {
  const chat = await getSingleChatById(chatId, userId);

  if (!chat) {
    return null;
  }

  return getMessagesByChatId(chatId);
}

export async function sendMessageService(userId: string, chatId: string, content: string) {
  const chat = await getSingleChatById(chatId, userId);

  if (!chat) {
    return null;
  }

  const userMessage = await createMessage(userId, chatId, 'user', content);

  // TODO: Replace with actual AI response.
  const dummyReply = 'Hello, I am an AI assistant. How can I help you today?';

  const assistantMessage = await createMessage(userId, chatId, 'assistant', dummyReply);

  return {
    userMessage,
    assistantMessage,
  };
}
