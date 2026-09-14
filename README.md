<h1 align="center">ChatForge 🤖</h1>

<p align="center">
  An AI-powered conversational platform built with TypeScript and Express, featuring Google Gemini, LangChain, PostgreSQL, Redis, authentication, chat history, rate limiting, and automatic conversation summarization.
</p>

<div align="center">
  <img src="./public/banner.png" alt="ChatForge Banner" width="900">
</div>

---

## 🔋 Features

- **🔐 Authentication & Authorization** — JWT authentication with bcrypt password hashing, HTTP-only cookies, and Redis-based JWT blocklisting.
- **🤖 AI Integration** — Google Gemini API through LangChain.
- **💬 Chat System** — Create chats, send messages, and retrieve chat history.
- **🗄️ PostgreSQL** — Stores users, chats, messages, summaries, and lifetime token usage.
- **⚡ Redis** — Token-window usage tracking, rate limiting, and JWT blocklisting.
- **📊 Token Tracking** — Tracks token usage for users and individual chats.
- **⏱️ Token Limits** — Configurable token limits with automatic time-based reset using Redis.
- **📝 Chat Summarization** — Automatically summarizes conversations to maintain useful context.
- **🚦 Rate Limiting** — Separate rate limiting for authenticated and unauthenticated requests.
- **✅ Validation & Security** — Zod validation, Helmet, CORS, and structured logging.

---

# ⚙️ Tech Stack

### Backend

- Bun
- Express.js
- TypeScript
- LangChain

### AI

- Google Gemini

### Database & Infrastructure

- PostgreSQL
- Redis
- Docker & Docker Compose

### Authentication & Security

- JWT
- bcrypt
- Zod
- Helmet
- CORS

### Other

- Pino
- dotenv

---

# 📊 Token Usage

ChatForge uses Redis for temporary token-window usage and PostgreSQL for lifetime usage.

```text
Redis
└── Current token window
    └── TOKEN_LIMIT
        └── TOKEN_WINDOW_SECONDS

PostgreSQL
└── total_token_used
    └── Lifetime usage
```

Example configuration:

```env
TOKEN_LIMIT=10000
TOKEN_WINDOW_SECONDS=18000
```

This allows **10,000 tokens per 5-hour window**.

---

# 🗄️ Database Schema

```text
                     USERS
     +-------------------------------+
     | id                            |
     | name                          |
     | age                           |
     | email                         |
     | password                      |
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
     | id                            |
     | user_id                       |
     | topic                         |
     | model                         |
     | summary                       |
     | summarized_till_message_number|
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
     | id                            |
     | user_id                       |
     | chat_id                       |
     | role                          |
     | content                       |
     | tokens                        |
     | prompt_tokens                 |
     | completion_tokens              |
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
User
├── Chat 1 (Recursion)
├── Chat 2 (Linked List)
└── Chat 3 (Operating System)
```

Relationship:

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

Relationship:

```text
Chat (1)
    │
    └──────────< Messages (N)
```

---

## 3. One User → Many Messages

Although every message belongs to a chat, storing the `user_id` in the `messages` table allows efficient retrieval of messages belonging to a specific user without requiring an additional join with the `chats` table.

Relationship:

```text
User (1)
    │
    └──────────< Messages (N)
```

---

# ⚡ Database Indexes

### Chats

Optimizes retrieval of a user's most recently updated chats.

```sql
CREATE INDEX idx_chats_user_updated
ON chats(user_id, updated_at DESC);
```

### Messages — Chat History

Optimizes loading messages from a specific chat in chronological order.

```sql
CREATE INDEX idx_messages_chat_created
ON messages(chat_id, created_at);
```

### Messages — User History

Optimizes retrieval of messages belonging to a specific user.

```sql
CREATE INDEX idx_messages_user_created
ON messages(user_id, created_at DESC);
```

---

# 🐳 Installation

## 1. Clone the Repository

```bash
git clone https://github.com/soumadip-dev/ChatForge.git

cd ChatForge
```

## 2. Install Dependencies

```bash
bun install
```

## 3. Start PostgreSQL & Redis

```bash
docker compose up -d --build
```

## 4. Configure Environment Variables

Create a `.env` file:

```env
PORT=8080
NODE_ENV=development

DATABASE_URL=<your-postgresql-url>

LOG_LEVEL=info
CORS_ORIGINS=<your-frontend-url>

JWT_SECRET=<your-jwt-secret>
JWT_ACCESS_EXPIRES_IN=1h

GEMINI_API_KEY=<your-gemini-api-key>
REDIS_URL=<your-redis-url>

TOKEN_LIMIT=10000
TOKEN_WINDOW_SECONDS=18000
```

## 5. Run Migrations

```bash
bun run migrate
```

## 6. Start Development Server

```bash
bun run dev
```

---

# 📜 Available Scripts

```bash
bun run dev       # Start development server
bun run migrate   # Run database migrations
bun run build     # Build production bundle
bun run start     # Start production server
```

---

# 👨‍💻 Author

**Soumadip Majila**
