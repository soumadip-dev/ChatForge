<h1 align="center">ChatForge 🤖</h1>

<p align="center">
  An AI-powered conversational platform built with the MERN stack, featuring real-time streaming responses, chat history, authentication.
</p>

<div align="center">
  <img src="./public/banner.png" alt="ChatForge Banner" width="900">
</div>

---

## 🔋 Features

> 🚧 Features will be documented once the project reaches a stable milestone.

---

# ⚙️ Tech Stack

## 🛠 Backend

- Bun
- Express.js
- TypeScript

## 🗄 Database

- PostgreSQL
- pg (node-postgres)

## 📦 Other Tools

- dotenv
- CORS
- Logging middleware (pino)

---

# 🤸 Installation

## 1. Clone the Repository

```bash
git clone https://github.com/soumadip-dev/ChatForge.git

cd ChatForge
```

---

## 2. Install Dependencies

```bash
bun install
```

---

## 3. Configure Environment Variables

Create a `.env` file in the project root.

```env
PORT=8080
NODE_ENV=development

DATABASE_URL=<your-postgresql-url>

LOG_LEVEL=info

CORS_ORIGINS=<your-frontend-url>
```

---

## 4. Run the Development Server

```bash
bun run dev
```

---

# 🗄️ Database Schema

## Entity Relationship Diagram (ERD)

```text
                     USERS
     +-------------------------------+
     | PK user_id                    |
     | name                          |
     | age                           |
     | email (UNIQUE)                |
     | password                      |
     | token_used                    |
     | token_limit                   |
     | reset_at                      |
     | total_token_used              |
     | created_at                    |
     | updated_at                    |
     +---------------+---------------+
                     |
                     | 1
                     |
                     | N
                     ▼
                     CHATS
     +-------------------------------+
     | PK chat_id                    |
     | FK user_id                    |
     | topic                         |
     | model                         |
     | summary                       |
     | summary_updated_at            |
     | summarized_till_message       |
     | message_count                 |
     | prompt_tokens                 |
     | completion_tokens             |
     | total_tokens                  |
     | created_at                    |
     | updated_at                    |
     +---------------+---------------+
                     |
                     | 1
                     |
                     | N
                     ▼
                  MESSAGES
     +-------------------------------+
     | PK message_id                 |
     | FK user_id                    |
     | FK chat_id                    |
     | role                          |
     | content                       |
     | tokens                        |
     | prompt_tokens                 |
     | completion_tokens             |
     | total_tokens                  |
     | created_at                    |
     | updated_at                    |
     +-------------------------------+
```

---

# 🔗 Database Relationships

## 1. One User → Many Chats

Each user can create multiple chat sessions.

### Example

```text
Aman
├── Chat 1 (Recursion)
├── Chat 2 (Linked List)
└── Chat 3 (Operating System)
```

Relationship

```text
User (1)
    │
    └──────────< Chats (N)
```

---

## 2. One Chat → Many Messages

Every chat contains multiple messages exchanged between the user and the AI.

### Example

```text
Chat

├── User : Explain recursion
├── AI   : Recursion is...
├── User : Give me an example
└── AI   : Sure...
```

Relationship

```text
Chat (1)
    │
    └──────────< Messages (N)
```

---

## 3. One User → Many Messages

Although every message belongs to a chat, storing the `user_id` in the `messages` table allows efficient retrieval of all messages created by a specific user without requiring an additional join with the `chats` table.

Relationship

```text
User (1)
    │
    └──────────< Messages (N)
```

---

# ⚡ Database Indexes

## Chats Index

Optimizes retrieval of a user's most recently active chats.

```sql
CREATE INDEX idx_chats_user_updated
ON chats(user_id, updated_at DESC);
```

---

## Messages Index (Chat History)

Optimizes loading all messages in a chat in chronological order.

```sql
CREATE INDEX idx_messages_chat_created
ON messages(chat_id, created_at);
```

---

## Messages Index (User History)

Optimizes retrieval of all messages belonging to a specific user.

```sql
CREATE INDEX idx_messages_user_created
ON messages(user_id, created_at DESC);
```

---

# 📜 Available Scripts

```bash
# Start development server
bun run dev

# Run database migrations
bun run migrate
```

---

# 👨‍💻 Author

**Soumadip Majila**
