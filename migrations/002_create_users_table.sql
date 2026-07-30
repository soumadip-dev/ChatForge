CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    name VARCHAR(255) NOT NULL,

    age INTEGER CHECK (age >= 0),

    email VARCHAR(255) NOT NULL UNIQUE,

    password TEXT NOT NULL,

    token_used INTEGER NOT NULL DEFAULT 0,

    token_limit INTEGER NOT NULL DEFAULT 10000,

    reset_at TIMESTAMP NOT NULL DEFAULT NOW(),

    total_token_used INTEGER NOT NULL DEFAULT 0,

    created_at TIMESTAMP NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);