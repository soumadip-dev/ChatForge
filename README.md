# ChatGPT Database Design (PostgreSQL Version)

# Overall Database Schema

```
                USERS
+--------------------------------+
| user_id (PK)                   |
| name                           |
| age                            |
| email (UNIQUE)                 |
| password                       |
| token_used                     |
| token_limit                    |
| reset_at                       |
| total_token_used               |
| created_at                     |
| updated_at                     |
+--------------------------------+
              |
              | 1
              |
              | N
              ▼
                CHATS
+--------------------------------+
| chat_id (PK)                   |
| user_id (FK → users.user_id)   |
| topic                          |
| model                          |
| summary                        |
| summary_updated_at             |
| summarized_till_message_number |
| last_message                   |
| message_count                  |
| prompt_tokens                  |
| completion_tokens              |
| total_tokens                   |
| created_at                     |
| updated_at                     |
+--------------------------------+
              |
              | 1
              |
              | N
              ▼
              MESSAGES
+--------------------------------+
| message_id (PK)                |
| user_id (FK → users.user_id)   |
| chat_id (FK → chats.chat_id)   |
| role                           |
| content                        |
| tokens                         |
| prompt_tokens                  |
| completion_tokens              |
| total_tokens                   |
| created_at                     |
| updated_at                     |
+--------------------------------+
```

---

# Relationship Explanation

## 1. One User → Many Chats

One user can create multiple chat sessions.

Example

```
Aman
 ├── Chat 1 (Recursion)
 ├── Chat 2 (Linked List)
 ├── Chat 3 (Operating System)
```

Therefore

```
users
---------
user_id (PK)

chats
---------
chat_id (PK)
user_id (FK)
```

Relationship

```
1 User
   |
   |------< Many Chats
```

---

## 2. One Chat → Many Messages

Every chat contains many messages.

Example

```
Chat
 ├── User : Explain recursion
 ├── AI   : Recursion means...
 ├── User : Give example
 ├── AI   : Sure...
```

Relationship

```
1 Chat
   |
   |------< Many Messages
```

---

## 3. User → Messages

Although messages already belong to a chat, storing `user_id` in the `messages` table makes it easy to fetch **all messages of a particular user** without joining through the `chats` table.

Example

```
SELECT *
FROM messages
WHERE user_id = 10;
```

---

# Why the Nested Objects Become Columns

MongoDB stores nested objects like this:

```js
usage: {
  (tokenUsed, tokenLimit, resetAt, totalTokenUsed);
}
```

PostgreSQL is relational, so these values become normal columns.

Instead of

```
usage.tokenUsed
```

we store

```
token_used
```

Instead of

```
usage.totalTokens
```

we store

```
total_tokens
```

This makes querying much easier.

---

# Table 1 : Users

Stores account information and token usage.

| Column           | Purpose          |
| ---------------- | ---------------- |
| user_id          | Primary key      |
| name             | User name        |
| age              | User age         |
| email            | Login email      |
| password         | Hashed password  |
| token_used       | Current usage    |
| token_limit      | Monthly limit    |
| reset_at         | Usage reset date |
| total_token_used | Lifetime usage   |
| created_at       | Account creation |
| updated_at       | Last update      |

---

## PostgreSQL SQL

```sql
CREATE TABLE users (
    user_id BIGSERIAL PRIMARY KEY,

    name VARCHAR(100) NOT NULL,

    age INTEGER
        CHECK (age >= 0),

    email VARCHAR(255) NOT NULL UNIQUE,

    password TEXT NOT NULL,

    token_used INTEGER NOT NULL DEFAULT 0,

    token_limit INTEGER NOT NULL DEFAULT 10000,

    reset_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    total_token_used INTEGER NOT NULL DEFAULT 0,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

---

# Table 2 : Chats

Stores conversation-level information.

| Column                         | Purpose                 |
| ------------------------------ | ----------------------- |
| chat_id                        | Primary key             |
| user_id                        | Owner of chat           |
| topic                          | Chat title              |
| model                          | AI model used           |
| summary                        | Conversation summary    |
| summary_updated_at             | Last summary update     |
| summarized_till_message_number | Last summarized message |
| last_message                   | Latest message          |
| message_count                  | Total messages          |
| prompt_tokens                  | Prompt token usage      |
| completion_tokens              | Response token usage    |
| total_tokens                   | Total token usage       |
| created_at                     | Created time            |
| updated_at                     | Updated time            |

---

## PostgreSQL SQL

```sql
CREATE TABLE chats (
    chat_id BIGSERIAL PRIMARY KEY,

    user_id BIGINT NOT NULL,

    topic VARCHAR(255) NOT NULL DEFAULT 'New Chat',

    model VARCHAR(100) NOT NULL,

    summary TEXT DEFAULT '',

    summary_updated_at TIMESTAMP,

    summarized_till_message_number INTEGER NOT NULL DEFAULT 0,

    last_message TEXT,

    message_count INTEGER NOT NULL DEFAULT 0,

    prompt_tokens INTEGER NOT NULL DEFAULT 0,

    completion_tokens INTEGER NOT NULL DEFAULT 0,

    total_tokens INTEGER NOT NULL DEFAULT 0,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_chat_user
        FOREIGN KEY (user_id)
        REFERENCES users(user_id)
        ON DELETE CASCADE
);
```

---

# Table 3 : Messages

Stores every message exchanged during a chat.

| Column            | Purpose                       |
| ----------------- | ----------------------------- |
| message_id        | Primary key                   |
| user_id           | Message owner                 |
| chat_id           | Chat                          |
| role              | user / assistant              |
| content           | Message text                  |
| tokens            | Total tokens for this message |
| prompt_tokens     | Prompt tokens                 |
| completion_tokens | Completion tokens             |
| total_tokens      | Total token usage             |
| created_at        | Creation time                 |
| updated_at        | Update time                   |

---

## PostgreSQL SQL

```sql
CREATE TABLE messages (
    message_id BIGSERIAL PRIMARY KEY,

    user_id BIGINT NOT NULL,

    chat_id BIGINT NOT NULL,

    role VARCHAR(20) NOT NULL
        CHECK (role IN ('user', 'assistant')),

    content TEXT NOT NULL,

    tokens INTEGER NOT NULL DEFAULT 0,

    prompt_tokens INTEGER NOT NULL DEFAULT 0,

    completion_tokens INTEGER NOT NULL DEFAULT 0,

    total_tokens INTEGER NOT NULL DEFAULT 0,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_message_user
        FOREIGN KEY (user_id)
        REFERENCES users(user_id)
        ON DELETE CASCADE,

    CONSTRAINT fk_message_chat
        FOREIGN KEY (chat_id)
        REFERENCES chats(chat_id)
        ON DELETE CASCADE
);
```

---

# Indexes

These correspond to the MongoDB indexes defined in the Mongoose schemas.

### Chats Index

Optimizes fetching a user's recent chats.

```sql
CREATE INDEX idx_chats_user_updated
ON chats(user_id, updated_at DESC);
```

---

### Messages Index (Chat History)

Optimizes loading messages for a chat in chronological order.

```sql
CREATE INDEX idx_messages_chat_created
ON messages(chat_id, created_at);
```

---

### Messages Index (User History)

Optimizes retrieving all messages sent or received by a user.

```sql
CREATE INDEX idx_messages_user_created
ON messages(user_id, created_at DESC);
```

---

# Final Entity Relationship Diagram (ERD)

```text
                 USERS
     +---------------------------+
     | PK user_id                |
     | name                      |
     | age                       |
     | email (UNIQUE)            |
     | password                  |
     | token_used                |
     | token_limit               |
     | reset_at                  |
     | total_token_used          |
     | created_at                |
     | updated_at                |
     +-------------+-------------+
                   |
                   | 1
                   |
                   | N
                   ▼
                 CHATS
     +---------------------------+
     | PK chat_id                |
     | FK user_id                |
     | topic                     |
     | model                     |
     | summary                   |
     | summary_updated_at        |
     | summarized_till_message   |
     | last_message              |
     | message_count             |
     | prompt_tokens             |
     | completion_tokens         |
     | total_tokens              |
     | created_at                |
     | updated_at                |
     +-------------+-------------+
                   |
                   | 1
                   |
                   | N
                   ▼
               MESSAGES
     +---------------------------+
     | PK message_id             |
     | FK user_id                |
     | FK chat_id                |
     | role                      |
     | content                   |
     | tokens                    |
     | prompt_tokens             |
     | completion_tokens         |
     | total_tokens              |
     | created_at                |
     | updated_at                |
     +---------------------------+
```

This relational design is the direct PostgreSQL equivalent of your MongoDB/Mongoose schema. It preserves the same entities, relationships, default values, and indexing strategy while following relational database best practices.
