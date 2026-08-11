import { pool } from '../lib/db.lib';
import type { Message } from '../types/message.types';

export async function getMessagesByChatId(chatId: string): Promise<Message[]> {
  const query = `
    SELECT *
    FROM messages
    WHERE chat_id = $1
    ORDER BY created_at ASC;
  `;

  const result = await pool.query<Message>(query, [chatId]);

  return result.rows;
}

// Get messages that have not been included in the summary yet
export async function getMessagesForAI(
  chatId: string,
  summarizedTillMessageNumber: number
): Promise<Message[]> {
  const query = `
    SELECT *
    FROM messages
    WHERE chat_id = $1
    ORDER BY created_at ASC, id ASC
    OFFSET $2;
  `;

  const result = await pool.query<Message>(query, [chatId, summarizedTillMessageNumber]);

  return result.rows;
}

export async function createMessage(
  userId: string,
  chatId: string,
  role: Message['role'],
  content: string
): Promise<Message> {
  const query = `
    INSERT INTO messages (
      user_id,
      chat_id,
      role,
      content
    )
    VALUES ($1, $2, $3, $4)
    RETURNING *;
  `;

  const result = await pool.query<Message>(query, [userId, chatId, role, content]);

  return result.rows[0]!;
}

export async function getMessagesForSummary(
  chatId: string,
  summarizedTillMessageNumber: number,
  summaryChunkSize: number
): Promise<Message[]> {
  const query = `
  SELECT *
  FROM messages
  WHERE chat_id = $1
  ORDER BY created_at ASC, id ASC
  OFFSET $2
  LIMIT $3;
  `;
  const result = await pool.query<Message>(query, [
    chatId,
    summarizedTillMessageNumber,
    summaryChunkSize,
  ]);

  return result.rows;
}
