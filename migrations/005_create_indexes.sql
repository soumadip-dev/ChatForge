-- Chats
CREATE INDEX idx_chats_user_updated
ON chats(user_id, updated_at DESC);

-- Messages
CREATE INDEX idx_messages_chat_created
ON messages(chat_id, created_at);


CREATE INDEX idx_messages_user_created
ON messages(user_id, created_at DESC);