# Chat API & realtime docs

Frontend / mobile contract for Zee Love chat: REST, Socket.IO `/chat`, replies, and emoji reactions.

| | |
|--|--|
| **Base URL** | Same as REST (`EXPO_PUBLIC_API_URL` / `API_BASE_URL`) |
| **Socket namespace** | `/chat` |
| **REST auth** | `Authorization: Bearer <access_token>` |
| **Socket auth** | Header **or** `handshake.auth` (required on iOS/Android) |

Related: [FRONTEND_INTEGRATION.md](./FRONTEND_INTEGRATION.md) · [ADMIN_API.md](./ADMIN_API.md)

---

## Table of contents

1. [Socket auth (React Native)](#1-socket-auth-react-native)
2. [Socket events](#2-socket-events)
3. [Reply to messages](#3-reply-to-messages)
4. [Emoji reactions](#4-emoji-reactions)
5. [Other REST endpoints](#5-other-rest-endpoints)
6. [Validation & errors](#6-validation--errors)
7. [Acceptance checklist](#7-acceptance-checklist)
8. [Mobile file map](#8-mobile-file-map)

---

## 1. Socket auth (React Native)

### Why this matters

- **Web:** `Authorization: Bearer <token>` via `extraHeaders` on the handshake usually works.
- **iOS / Android:** `extraHeaders` is **not** applied to the WebSocket transport. The client must send JWT in **`handshake.auth`**.

### What the server accepts

| Source | Value |
|--------|--------|
| `handshake.headers.authorization` | `Bearer <access_token>` |
| `handshake.auth.token` | raw access token |
| `handshake.auth.authorization` | `Bearer <access_token>` |

Missing/invalid token → server disconnects the socket.

### Example connect (Expo / React Native)

```ts
import { io } from 'socket.io-client';

const socket = io(`${API_BASE_URL}/chat`, {
  transports: ['websocket'],
  auth: {
    token: accessToken,
    authorization: `Bearer ${accessToken}`,
  },
  // Web-only helper; ignored on native WebSocket transport:
  extraHeaders: {
    Authorization: `Bearer ${accessToken}`,
  },
});
```

### Suggested mobile layout

| File | Role |
|------|------|
| `src/services/chatSocket.ts` | connect / disconnect singleton |
| `src/components/ChatSocketBridge.tsx` | keep socket up while logged in; merge into React Query |
| `src/screens/chat/ChatRoomScreen.tsx` | send via socket when connected; fall back to REST |

---

## 2. Socket events

| Direction | Event | Payload |
|-----------|--------|---------|
| C → S | `private-message` | `{ toUserId, message?, fileId?, replyToMessageId? }` |
| S → C | `private-message` | Echo to **sender and recipient** (see below) |
| C → S | `message-reaction` | `{ messageId, emoji }` or `{ messageId, emoji: null }` |
| S → C | `message-reaction-updated` | `{ chatId, messageId, reactions, actorUserId }` |
| S → C | `error` | `{ message: string }` |
| C → S | `call` | `{ toUserId, callId }` |
| S → C | `incoming-call` | `{ fromUserId, fromUsername, callId, profilePicture? }` |

Naming: mobile accepts camelCase or snake_case (`messageId` / `id`, `replyToMessageId` / `reply_to_message_id`, `created_at` / `createdAt`). Prefer the shapes below.

---

## 3. Reply to messages

### Goals

1. Persist `replyToMessageId` on the new message  
2. Return nested `replyTo` in REST history  
3. Broadcast the same reply metadata over socket  
4. Support text and image (file) messages  
5. Disallow replies to announcement/system messages  

Image + caption stay **two separate messages** if the client sends two requests.

---

### `POST /chats/send-message`

**Auth:** Bearer JWT  
**Status:** `201`

**Request**

| Field | Type | Required | Notes |
|-------|------|----------|--------|
| `message` | string | one of message/fileId | text body |
| `fileId` | string | one of message/fileId | image/file |
| `toUserId` | string | one of toUserId/chatId | recipient |
| `chatId` | string | one of toUserId/chatId | existing chat |
| `replyToMessageId` | string | no | parent message id |

```json
{
  "toUserId": "recipient-uuid",
  "message": "Hi back",
  "fileId": null,
  "replyToMessageId": "parent-msg-uuid"
}
```

**Rules for `replyToMessageId`**

- Parent must exist  
- Parent must be in the **same chat**  
- Parent must not be deleted  
- Parent must not be `announcement`  

**Response**

```json
{
  "data": {
    "id": "msg-uuid",
    "chatId": "chat-uuid",
    "type": "text",
    "content": "Hi back",
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
    "user": {
      "id": "sender-uuid",
      "username": "john",
      "first_name": "John",
      "last_name": "Doe",
      "profile_picture": { "url": "https://..." }
    }
  }
}
```

Also emits socket `private-message` to both users when online.

---

### `GET /chats/:chatId/messages`

**Query:** `page` (default 1), `limit` (default 20)

Each item in `data[]` includes:

| Field | Type | Notes |
|-------|------|--------|
| `replyToMessageId` | string \| null | Parent id |
| `replyTo` | object \| null | Nested preview |
| `reactions` | array | Grouped reactions (see §4) |

**Deleted parent preview**

```json
"replyTo": {
  "id": "deleted-parent-id",
  "type": "text",
  "content": "",
  "deleted": true
}
```

UI: show “Message deleted”.

---

### Socket — `private-message`

**Client → server**

```json
{
  "toUserId": "recipient-uuid",
  "message": "optional text",
  "fileId": "optional",
  "replyToMessageId": "optional-parent-uuid"
}
```

**Server → clients** (sender **and** recipient)

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

Notes:

- Sender echo includes the real server `messageId`  
- Text may appear as `message` and/or `content`  
- On failure: `error` event `{ "message": "..." }`  
- If socket is down, use `POST /chats/send-message`  

---

## 4. Emoji reactions

Allowed set: `👍` `❤️` `😂` `😮` `😢` `🙏`  

- One reaction per user per message (change = upsert)  
- Not allowed on announcement/system or deleted messages  

---

### `POST /chats/messages/:messageId/reactions`

```json
{ "emoji": "❤️" }
```

**Response**

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

Also broadcasts `message-reaction-updated` to chat participants.

---

### `DELETE /chats/messages/:messageId/reactions`

Removes the current user’s reaction.

**Response:** same shape as POST (`data.messageId` + `data.reactions`).

---

### History

`GET /chats/:chatId/messages` embeds the same `reactions[]` on each message.

---

### Socket — reactions

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
  "reactions": [
    {
      "emoji": "❤️",
      "count": 2,
      "users": [
        { "id": "user-a", "username": "john" },
        { "id": "user-b", "username": "jane" }
      ],
      "reactedByMe": false
    }
  ],
  "actorUserId": "user-a"
}
```

Broadcast includes the actor (for sync). Prefer REST when offline.

---

## 5. Other REST endpoints

| Method | Path | Notes |
|--------|------|--------|
| `GET` | `/chats` | List chats (paginated) |
| `GET` | `/chats/:chatId/messages` | History + replyTo + reactions |
| `POST` | `/chats/send-message` | Send (REST fallback) |
| `POST` | `/chats/messages/:messageId/reactions` | Add/change reaction |
| `DELETE` | `/chats/messages/:messageId/reactions` | Remove reaction |

---

## 6. Validation & errors

| Case | Behavior |
|------|----------|
| Reply to message in another chat | `400` |
| Reply to deleted message | `400` |
| Reply to announcement | `403` |
| React to deleted message | `404` |
| React to announcement | `403` |
| User not in chat | `403` |
| Invalid emoji | `400` |
| Duplicate reaction from same user | Upsert (replace) |
| Socket disconnected | REST still works |

Typical error body:

```json
{
  "statusCode": 400,
  "message": "Cannot reply to a deleted message",
  "error": "Bad Request"
}
```

Socket errors: `error` event with `{ "message": "..." }`.

---

## 7. Acceptance checklist

### Replies

- [x] `POST /chats/send-message` accepts `replyToMessageId`
- [x] `GET /chats/:chatId/messages` returns `replyToMessageId` + `replyTo`
- [x] Socket send accepts `replyToMessageId`
- [x] Socket receive includes `replyToMessageId` + `replyTo`
- [x] Sender receives echo with real `messageId`
- [x] Image and text replies work
- [x] Deleted parent shown as `replyTo.deleted: true` in history

### Reactions

- [x] POST/DELETE reaction endpoints
- [x] Reactions on message list
- [x] One reaction per user (replace on change)
- [x] Socket `message-reaction-updated` to both users
- [x] REST works offline

### Socket auth

- [x] Accept `handshake.headers.authorization`
- [x] Accept `handshake.auth.token` / `handshake.auth.authorization` (React Native)

---

## 8. Mobile file map

Wire against:

- `src/api/chatApi.ts`
- `src/types/chatSocket.ts`
- `src/utils/mapApi.ts`
- `src/utils/mapSocketMessage.ts`
- `src/components/ChatBubble.tsx`
- `src/screens/chat/ChatRoomScreen.tsx`
- `src/services/chatSocket.ts`
- `src/components/ChatSocketBridge.tsx`

### Quick test flow

1. User A sends `"Hello"`  
2. User B replies with `replyToMessageId = A’s id`  
3. Both see quoted preview  
4. A reacts ❤️ → both see update  
5. B changes to 👍 → counts update  
6. Reload history → replies + reactions persist  

---

## Backend source

- Gateway: `src/modules/chats/chat.gateway.ts`
- Service: `src/modules/chats/chat.service.ts`
- Token helper: `src/common/utils/socket-auth.ts`
- WS guard: `src/common/guards/jwt-auth-ws.guard.ts`
