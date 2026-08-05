// Data returned directly from the database for public/API usage
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

// Database row representation (handling optional defaults for inserts/selects)
export type DBChatRow = {
  id: string;
  user_id: string;
  topic?: string;
  model: string;
  summary?: string;
  summary_updated_at?: Date | null;
  summarized_till_message_number?: number;
  message_count?: number;
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  created_at: Date;
  updated_at: Date;
};

// Simplified type for chat list preview queries (e.g., getRecentChats)
export type ChatListItem = Pick<Chat, 'id' | 'topic' | 'updated_at'>;

// Type used when creating a new chat session
export type CreateChatInput = {
  user_id: string;
  model: string;
  topic?: string;
};
