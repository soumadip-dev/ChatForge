import { pool } from '../lib/db.lib';
import type { Chat, ChatListItem, ChatTokenUsage } from '../types/chat.types';

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

  return result.rows[0] ?? null;
}

// Create a new chat
export async function createChat(userId: string, topic: string, model: string): Promise<Chat> {
  const query = `
    INSERT INTO chats (
      user_id,
      model,
      topic
    )
    VALUES (
      $1,
      $2,
      $3
    )
    RETURNING *;
  `;

  const result = await pool.query<Chat>(query, [userId, model, topic]);

  return result.rows[0]!;
}

// Update chat topic and message count
export async function updateChatMetadata(
  chatId: string,
  messageCount: number,
  topic?: string
): Promise<void> {
  if (topic !== undefined) {
    const query = `
      UPDATE chats
      SET
        message_count = $1,
        topic = $2,
        updated_at = NOW()
      WHERE id = $3;
    `;

    await pool.query(query, [messageCount, topic, chatId]);

    return;
  }

  const query = `
    UPDATE chats
    SET
      message_count = $1,
      updated_at = NOW()
    WHERE id = $2;
  `;

  await pool.query(query, [messageCount, chatId]);
}

// Update chat token usage
export async function updateChatTokens(chatId: string, usage: ChatTokenUsage): Promise<void> {
  const query = `
    UPDATE chats
    SET
      prompt_tokens = prompt_tokens + $1,
      completion_tokens = completion_tokens + $2,
      total_tokens = total_tokens + $3,
      updated_at = NOW()
    WHERE id = $4;
  `;

  await pool.query(query, [usage.promptTokens, usage.completionTokens, usage.totalTokens, chatId]);
}

// Update chat summary
export async function updateChatSummary(
  chatId: string,
  summary: string,
  summarizedTillMessageNumber: number
): Promise<void> {
  const query = `
    UPDATE chats
    SET
      summary = $2,
      summary_updated_at = NOW(),
      summarized_till_message_number = $3,
      updated_at = NOW()
    WHERE id = $1;
  `;

  await pool.query(query, [chatId, summary, summarizedTillMessageNumber]);
}

// Delete chat
export async function deleteChatById(chatId: string, userId: string): Promise<boolean> {
  const query = `
    DELETE FROM chats
    WHERE id = $1
      AND user_id = $2
    RETURNING id;
  `;

  const result = await pool.query<{ id: string }>(query, [chatId, userId]);

  return result.rowCount === 1;
}
