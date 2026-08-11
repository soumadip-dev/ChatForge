import {
  createChat,
  deleteChatById,
  getRecentTwentyChats,
  getSingleChatById,
} from '../repositories/chat.repository';

export async function getRecentChatsService(userId: string) {
  return getRecentTwentyChats(userId);
}

export async function createChatService(userId: string, model: string) {
  const topic = 'New Chat';

  return createChat(userId, topic, model);
}

export async function getChatByIdService(chatId: string, userId: string) {
  return getSingleChatById(chatId, userId);
}

export async function deleteChatService(chatId: string, userId: string) {
  return deleteChatById(chatId, userId);
}
