CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    chat_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,

    role VARCHAR(20) NOT NULL
        CHECK (role IN ('user', 'assistant')),

    content TEXT NOT NULL,

    tokens INTEGER NOT NULL DEFAULT 0,

    prompt_tokens INTEGER NOT NULL DEFAULT 0,

    completion_tokens INTEGER NOT NULL DEFAULT 0,

    total_tokens INTEGER NOT NULL DEFAULT 0,

    created_at TIMESTAMP NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);