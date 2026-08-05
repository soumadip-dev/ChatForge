import { pool } from '../lib/db.lib';
import type { Chat, ChatListItem } from '../types/chat.types';

// Fetch the most recent 20 chats for a user
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

// Fetch a single chat by chat id and user id
export async function getSingleChatById(chatId: string, userId: string): Promise<Chat | null> {
  const query = `
    SELECT *
    FROM chats
    WHERE id = $1
      AND user_id = $2;
  `;

  const result = await pool.query<Chat>(query, [chatId, userId]);

  return result.rows[0]!;
}

// Create a new chat
export async function createNewChat(userId: string, model: string): Promise<Chat> {
  const query = `
    INSERT INTO chats (
      user_id,
      model
    )
    VALUES (
      $1,
      $2
    )
    RETURNING *;
  `;

  const result = await pool.query<Chat>(query, [userId, model]);

  return result.rows[0]!;
}

// Delete a chat by id
export async function deleteChatById(chatId: string, userId: string): Promise<boolean> {
  const query = `
  DELETE FROM chats
  WHERE id = $1
    AND user_id = $2;
  RETURNING id;
  `;
  const result = await pool.query<{ id: string }>(query, [chatId, userId]);

  return result.rowCount === 1;
}
