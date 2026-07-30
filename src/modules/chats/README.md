# Chat replies & emoji reactions

API contract for the Zee Love mobile app (React Native / Expo).

- **REST** for send + history
- **Socket.IO** namespace `/chat` for realtime
- **JWT** on handshake (`Authorization: Bearer <token>`)

---

## 1. Reply to messages

### REST — send message

```http
POST /chats/send-message
Authorization: Bearer <token>
```

```json
{
  "chatId": "optional",
  "toUserId": "optional-if-chatId-provided",
  "message": "Hello",
  "fileId": "optional-for-images",
  "replyToMessageId": "optional-parent-message-uuid"
}
```

Rules:

- At least one of `message` or `fileId` is required
- Provide `chatId` **or** `toUserId`
- If `replyToMessageId` is set: parent must exist, same chat, not deleted, not announcement
- Image + caption stay separate messages if the client sends two requests

**Response (201):**

```json
{
  "data": {
    "id": "msg-uuid",
    "chatId": "chat-uuid",
    "type": "text",
    "content": "My reply",
    "userId": "sender-uuid",
    "fileId": null,
    "file": null,
    "replyToMessageId": "parent-msg-uuid",
    "replyTo": {
      "id": "parent-msg-uuid",
      "type": "file",
      "content": "",
      "userId": "other-user-uuid",
      "created_at": "2026-03-20T10:00:00.000Z",
      "user": {
        "id": "other-user-uuid",
        "username": "jane",
        "first_name": "Jane",
        "last_name": "Doe",
        "profile_picture": { "url": "https://..." }
      },
      "file": { "url": "https://..." }
    },
    "reactions": [],
    "created_at": "2026-03-20T10:01:00.000Z",
    "updated_at": "2026-03-20T10:01:00.000Z",
    "user": { "...": "sender profile" }
  }
}
```

### REST — get messages

```http
GET /chats/:chatId/messages?page=1&limit=20
```

Each item includes `replyToMessageId`, nested `replyTo`, and `reactions`.

If parent was deleted:

```json
"replyTo": {
  "id": "deleted-parent-id",
  "type": "text",
  "content": "",
  "deleted": true
}
```

### Socket — send / receive

**Client → server** event: `private-message`

```json
{
  "toUserId": "recipient-uuid",
  "message": "optional text",
  "fileId": "optional",
  "replyToMessageId": "optional parent message uuid"
}
```

**Server → clients** event: `private-message` (echo to sender **and** recipient)

```json
{
  "messageId": "msg-uuid",
  "fromUserId": "sender-uuid",
  "fromUsername": "john",
  "message": "Reply text",
  "content": "Reply text",
  "type": "text",
  "file": null,
  "created_at": "2026-03-20T10:01:00.000Z",
  "replyToMessageId": "parent-msg-uuid",
  "replyTo": {
    "id": "parent-msg-uuid",
    "type": "file",
    "content": "",
    "fromUserId": "other-user-uuid",
    "fromUsername": "jane",
    "file": { "url": "https://..." },
    "created_at": "2026-03-20T10:00:00.000Z"
  }
}
```

---

## 2. Emoji reactions

Allowed set: `👍 ❤️ 😂 😮 😢 🙏`  
One reaction per user per message (upsert replaces).

### REST — add/update

```http
POST /chats/messages/:messageId/reactions
```

```json
{ "emoji": "❤️" }
```

### REST — remove

```http
DELETE /chats/messages/:messageId/reactions
```

### Response shape

```json
{
  "data": {
    "messageId": "msg-uuid",
    "reactions": [
      {
        "emoji": "❤️",
        "count": 2,
        "users": [
          { "id": "user-a", "username": "john" },
          { "id": "user-b", "username": "jane" }
        ],
        "reactedByMe": true
      }
    ]
  }
}
```

### Socket

**Client → server** `message-reaction`

```json
{ "messageId": "msg-uuid", "emoji": "❤️" }
```

Remove:

```json
{ "messageId": "msg-uuid", "emoji": null }
```

**Server → clients** `message-reaction-updated`

```json
{
  "chatId": "chat-uuid",
  "messageId": "msg-uuid",
  "reactions": [ { "emoji": "❤️", "count": 2, "users": [], "reactedByMe": false } ],
  "actorUserId": "user-a"
}
```

Broadcast to both participants (including actor).

---

## Validation

| Case | Behavior |
|------|----------|
| Reply to message in another chat | 400 |
| Reply to deleted message | 400 |
| Reply to announcement | 403 |
| React to deleted message | 404 |
| React to announcement | 403 |
| User not in chat | 403 |
| Invalid emoji | 400 |
| Duplicate reaction | Upsert (replace) |

---

## Migration

```bash
npx prisma migrate deploy
```
