export interface Message {
  id: string;
  user_id: string;
  chat_id: string;
  role: 'user' | 'assistant';
  content: string;
  tokens: number;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  created_at: Date;
  updated_at: Date;
}

export interface SendMessageResponse {
  userMessage: Message;
  assistantMessage: Message;
}
