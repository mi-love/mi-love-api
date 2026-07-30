# Chats module

Full contract: **[CHAT_API.md](../../CHAT_API.md)**

| Method | Path / event | Notes |
|--------|----------------|--------|
| `POST` | `/chats/groups` | Create group |
| `POST` | `/chats/:chatId/members` | Add members (owner/admin) |
| `GET` | `/chats/:chatId` | Chat detail |
| Socket | `join-chat` / `leave-chat` / `chat-message` | Group realtime |
