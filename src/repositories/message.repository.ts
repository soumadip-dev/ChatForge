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
