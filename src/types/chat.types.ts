// Represents a chat record in the database
export type Chat = {
  id: string;
  user_id: string;
  topic: string;
  model: string;
  summary: string;
  summary_updated_at: Date | null;
  summarized_till_message_number: number;
  message_count: number;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  created_at: Date;
  updated_at: Date;
};

// Used for recent chat list
export type ChatListItem = Pick<Chat, 'id' | 'topic' | 'updated_at'>;

// Payload required to create a chat
export type CreateChatInput = Pick<Chat, 'user_id' | 'model'>;
