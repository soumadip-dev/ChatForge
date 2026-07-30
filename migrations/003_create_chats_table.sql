CREATE TABLE chats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    topic VARCHAR(255) NOT NULL DEFAULT 'New Chat',

    model VARCHAR(100) NOT NULL,

    summary TEXT DEFAULT '',

    summary_updated_at TIMESTAMP,

    summarized_till_message_number INTEGER NOT NULL DEFAULT 0,

    message_count INTEGER NOT NULL DEFAULT 0,

    prompt_tokens INTEGER NOT NULL DEFAULT 0,

    completion_tokens INTEGER NOT NULL DEFAULT 0,

    total_tokens INTEGER NOT NULL DEFAULT 0,

    created_at TIMESTAMP NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);