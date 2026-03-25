# Mi-Love API — Socket.IO (real-time chat)

**Related docs:** [API_DOCUMENTATION.md](API_DOCUMENTATION.md) (REST) · [SOCKET_AND_PUSH_API.md](SOCKET_AND_PUSH_API.md) (push notifications & HTTP route index)

**Base URL:** same host and port as the REST API (e.g. `http://localhost:9999`). Socket.IO uses the **same origin**; only the path differs (namespace below).

---

## Table of contents

1. [Overview](#1-overview)
2. [Connection & authentication](#2-connection--authentication)
3. [Connection lifecycle](#3-connection-lifecycle)
4. [Server logging (inbound events)](#4-server-logging-inbound-events)
5. [Client → server events](#5-client--server-events)
6. [Server → client events](#6-server--client-events)
7. [Business rules (summary)](#7-business-rules-summary)
8. [Offline recipients & push](#8-offline-recipients--push)
9. [REST alternative](#9-rest-alternative)

---

## 1. Overview

The NestJS **`ChatGateway`** exposes a **Socket.IO** server on namespace **`/chat`**. It handles:

- **`private-message`** — text or file messages between friends (persisted, wallet fee per message).
- **`call`** — incoming call signaling to a friend (also writes an announcement row in the shared chat).

Implementation: `src/modules/chats/chat.gateway.ts`.

---

## 2. Connection & authentication

| Item | Value |
| ---- | ----- |
| Library | Socket.IO (client connects to the Nest WebSocket adapter) |
| Namespace | `/chat` |
| Typical client URL | `http(s)://<host>:<port>/chat` (Socket.IO client connects to this namespace) |
| Transport | WebSocket (Socket.IO) |

**Auth:** send the same JWT you use for REST on the **HTTP handshake**, not only in a socket auth packet:

```http
Authorization: Bearer <access_token>
```

The server reads `Authorization` from `client.handshake.headers` (see `extractTokenFromHeader` in the gateway). `Bearer` prefix is required.

**JWT verification** uses `JWT_SECRET` (with the same fallback as the rest of the app in development). Message handlers additionally use **`WsAuthGuard`**, which re-validates the token and loads the user onto the socket.

---

## 3. Connection lifecycle

| Outcome | Behavior |
| ------- | -------- |
| **No `Authorization` header** | Connection is rejected; server logs a warning (`no Bearer token`) and disconnects. |
| **Invalid / expired JWT** | Connection fails; server logs authentication failure and disconnects. |
| **Valid JWT but user not in DB** | Treated as failure; disconnect. |
| **Success** | User is stored on `client.data.user`, a `userId → socketId` map is updated (**last connection wins** per user), and **inbound event logging** is attached (see below). |

**Disconnect:** the user is removed from the routing map; a log line records the disconnect.

---

## 4. Server logging (inbound events)

After a successful connection, the server registers **`socket.onAny(...)`** so **every inbound event** from that client is logged (Nest `Logger`, `ChatGateway` context).

Log format (conceptually):

```text
[socket in] id=<socketId> userId=<userId> event=<eventName> payload=<JSON>
```

- **Payload** is the **array of arguments** Socket.IO passes for the event, stringified.
- Long payloads are **truncated to 800 characters** to avoid huge log lines (e.g. long chat text).

This covers **`private-message`**, **`call`**, and any other client-emitted event names. **Outbound** emits (server → client) are **not** logged by this hook.

---

## 5. Client → server events

Emit on the `/chat` namespace with a JSON body object where noted.

### `private-message`

| Field | Type | Required | Description |
| ----- | ---- | -------- | ----------- |
| `toUserId` | string | Yes | Recipient user id |
| `message` | string | No* | Text (for text messages) |
| `fileId` | string | No* | Uploaded file id (for file messages) |

\* At least one of a meaningful `message` or `fileId` is expected by the app flow; validation errors are emitted on `error`.

### `call`

| Field | Type | Required | Description |
| ----- | ---- | -------- | ----------- |
| `toUserId` | string | Yes | Recipient user id |
| `callId` | string | Yes | Client-generated id for this call session |

---

## 6. Server → client events

The server may emit the following **to** clients (event names are exact).

| Event | Payload | When |
| ----- | ------- | ---- |
| `private-message` | `{ fromUserId, fromUsername, message, file, messageId }` | Recipient is **online**; message was saved. `file` may be `{ url, created_at }` or `null`. |
| `incoming-call` | `{ fromUserId, fromUsername, callId, profilePicture }` | Recipient is online; `call` was processed for signaling. |
| `error` | `{ message: string }` | Validation failure, block, not friends, wallet insufficient, messaging disabled, etc. |

---

## 7. Business rules (summary)

These are enforced in the gateway (and related DB logic):

- **Friends only** — messaging and calls require a friendship relation (either side of the `friends` / `my_friends` relation, as implemented in code).
- **Blocks** — if either user blocked the other, messaging/calls are rejected (`error`).
- **Chat** — a 1:1 chat is found or created; for messages, **`can_send_messages`** must be true on that chat.
- **Wallet** — sending a **private message** debits a **per-message fee** from the sender’s wallet; insufficient balance yields `error`.
- **Routing** — only **one socket id per user** is kept; if the recipient is offline, they will not receive the real-time `private-message` event until they connect (see below).

---

## 8. Offline recipients & push

If the recipient has **no active socket**, the message may still be **persisted** and a **push notification** may be sent via Expo (see [SOCKET_AND_PUSH_API.md](SOCKET_AND_PUSH_API.md)). There is no `private-message` socket delivery until they reconnect.

---

## 9. REST alternative

You can send chat messages over HTTP without Socket.IO:

- **`POST /chats/send-message`** — see [Chats](API_DOCUMENTATION.md#5-chats) in the main API doc.

---

*Implementation reference: `src/modules/chats/chat.gateway.ts`, `src/common/guards/jwt-auth-ws.guard.ts`.*
