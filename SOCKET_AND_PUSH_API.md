# Mi-Love API — WebSockets, push notifications & HTTP index

**Companion to the main REST reference:** [API_DOCUMENTATION.md](API_DOCUMENTATION.md)

**Base URL:** same as the REST API (e.g. `http://localhost:9999`)

---

## Table of contents

1. [Backend updates (realtime & notifications)](#1-backend-updates-realtime--notifications)
2. [WebSockets (Socket.IO)](#2-websockets-socketio)
3. [Push notifications (Expo)](#3-push-notifications-expo)
4. [HTTP endpoints index](#4-http-endpoints-index)

---

## 1. Backend updates (realtime & notifications)

These behaviors are implemented in the NestJS backend:

| Area | Behavior |
| ---- | -------- |
| **In-app notifications** | When the server notifies a user (e.g. after a new chat message via WebSocket), a row is **created** in the `notifications` table so **`GET /notifications`** returns data. List is ordered **newest first** (`created_at` descending). |
| **Expo push** | After saving the notification row, an **Expo push** is sent if the user has a valid **Expo push token** stored in `fcm_token` (see `POST /profile/save-fcm` in [Profile](API_DOCUMENTATION.md#2-profile)). |
| **Invalid device** | If Expo returns a push ticket error **`DeviceNotRegistered`**, the stored **`fcm_token` is cleared** for that user. |
| **WebSocket JWT** | Connection and message handlers use the same JWT secret fallback as the rest of the app (`JWT_SECRET` or default in dev). Handshake: `Authorization: Bearer <token>`. |

There is **no public HTTP endpoint** to “send a push” manually; pushes are triggered from internal services (e.g. chat gateway).

---

## 2. WebSockets (Socket.IO)

Real-time chat and call signaling use **Socket.IO** on the **`/chat` namespace** (same host/port as the REST API).

### Connection

| Item | Value |
| ---- | ----- |
| Transport | WebSocket (Socket.IO) |
| Namespace | `/chat` |
| Client URL (typical) | `http(s)://<host>:<port>/chat` with a Socket.IO client |
| Auth | HTTP header on the handshake: `Authorization: Bearer <access_token>` |

The server validates the JWT on connect and disconnects the socket if the token is missing, invalid, or the user does not exist. Only **one active socket per user id** is tracked for routing (last connection wins).

### Client → server events

| Event | Body | Description |
| ----- | ---- | ----------- |
| `private-message` | `{ "toUserId": string, "message"?: string, "fileId"?: string }` | Send a chat message or file message. Requires friendship, no block, chat `can_send_messages`, and sufficient wallet balance (fee per message). |
| `call` | `{ "toUserId": string, "callId": string }` | Signal an incoming call to a friend; also writes an announcement message to the shared chat. |

Both events use the same JWT rules as HTTP (via `WsAuthGuard` on the handler).

### Server → client events

| Event | Payload | When |
| ----- | ------- | ---- |
| `private-message` | `{ fromUserId, fromUsername, message, file, messageId }` | Recipient is online and a message was saved. `file` may be `{ url, created_at }` or null. |
| `incoming-call` | `{ fromUserId, fromUsername, callId, profilePicture }` | Recipient is online and a `call` was accepted for signaling. |
| `error` | `{ message: string }` | Validation, block, not friends, wallet, or business rule failure. |

If the recipient is **offline**, the message is still persisted and a **push notification** may be sent (see [Push notifications](#3-push-notifications-expo)); there is no `private-message` socket event until they connect again.

### REST alternative

HTTP **`POST /chats/send-message`** can send messages without WebSockets — see [Chats](API_DOCUMENTATION.md#5-chats).

---

## 3. Push notifications (Expo)

The backend uses **Expo Push** (`expo-server-sdk`), not Firebase Admin directly. The user field `fcm_token` stores an **Expo push token** (e.g. `ExponentPushToken[...]`).

### Environment

| Variable | Purpose |
| -------- | ------- |
| `EXPO_ACCESS_TOKEN` | Optional. Expo access token for higher rate limits / Expo dashboard features. |

### Register device token

**`POST /profile/save-fcm`** (JWT required) — full request/response in [Profile](API_DOCUMENTATION.md#2-profile).

| Field | Type | Description |
| ----- | ---- | ----------- |
| `fcmToken` | string | Expo push token from the mobile app |

### List notifications (in-app inbox)

**`GET /notifications?page=&limit=`** — see [Notifications](API_DOCUMENTATION.md#9-notifications).

### When pushes are sent

Internal `sendNotification` (not exposed as HTTP) runs after events such as a **new private message** in the chat gateway:

1. Create a **notification** row for the recipient (in-app list).
2. If a valid Expo token is stored, send a push via Expo; on **`DeviceNotRegistered`**, clear **`fcm_token`**.

---

## 4. HTTP endpoints index

Quick reference for all REST routes (method + path). Swagger at **`/docs`** may list additional schema detail.

| Method | Path |
| ------ | ---- |
| POST | `/auth/login` |
| POST | `/auth/signup` |
| POST | `/auth/send-otp` |
| POST | `/auth/forgot-password` |
| POST | `/auth/verify-otp` |
| POST | `/auth/reset-password` |
| GET | `/auth/google` |
| GET | `/auth/google/callback` |
| GET | `/auth/apple` |
| GET | `/auth/apple/callback` |
| GET | `/profile/me` |
| POST | `/profile/save-fcm` |
| GET | `/profile/:id` |
| PUT | `/profile/me` |
| POST | `/profile/delete` |
| GET | `/posts/` |
| PUT | `/posts/:id` |
| GET | `/posts/:id` |
| DELETE | `/posts/:id` |
| POST | `/posts/` |
| POST | `/posts/:id/like` |
| POST | `/posts/:id/unlike` |
| GET | `/posts/:id/likes` |
| GET | `/friends` |
| POST | `/friends` |
| POST | `/friends/unfriend` |
| POST | `/friends/block` |
| POST | `/friends/unblock` |
| POST | `/chats/send-message` |
| GET | `/chats` |
| GET | `/chats/:chatId/messages` |
| GET | `/status` |
| GET | `/status/me` |
| POST | `/status/` |
| DELETE | `/status/:id` |
| GET | `/wallet` |
| POST | `/wallet/buy-coins` |
| GET | `/wallet/checkout` |
| GET | `/wallet/redirect` |
| GET | `/wallet/callback` |
| GET | `/wallet/gifts` |
| POST | `/wallet/gifts/send` |
| GET | `/wallet/transactions` |
| GET | `/wallet/transactions/:id` |
| POST | `/wallet/deduct` |
| POST | `/upload` |
| GET | `/notifications` |
| POST | `/emergencies/panic` |
| ALL | `/emergencies/webhook` |
| GET | `/streams/token` |

---

*For module-by-module REST documentation, use [API_DOCUMENTATION.md](API_DOCUMENTATION.md).*
