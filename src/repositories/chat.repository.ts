import { pool } from '../lib/db.lib';
import type { Chat, ChatListItem } from '../types/chat.types';

//* Fetch the most recent 20 chats for a user
export async function getRecentTwentyChats(userId: string): Promise<ChatListItem[]> {
  const query = `
    SELECT
      id,
      topic,
      updated_at
    FROM chats
    WHERE user_id = $1
    ORDER BY updated_at DESC
    LIMIT 20;
  `;

  const result = await pool.query<ChatListItem>(query, [userId]);

  return result.rows;
}

//* Fetch a single chat by chat id and user id
export async function getSingleChatById(chatId: string, userId: string): Promise<Chat | null> {
  const query = `
    SELECT *
    FROM chats
    WHERE id = $1
      AND user_id = $2
    LIMIT 1;
  `;

  const result = await pool.query<Chat>(query, [chatId, userId]);

  return result.rows[0] ?? null;
}
