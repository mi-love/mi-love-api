# Zee Love API — Frontend integration guide

Docs for the React Native / Expo app against the current backend.

Auth on all endpoints below (unless noted): `Authorization: Bearer <access_token>`

Socket namespace: `/chat`  
Socket auth: `Authorization: Bearer <token>` on handshake

---

## Table of contents

1. [Wallet — buy coins & payment callback](#1-wallet--buy-coins--payment-callback)
2. [Chat — replies](#2-chat--replies)
3. [Chat — emoji reactions](#3-chat--emoji-reactions)
4. [Posts — comments](#4-posts--comments)
5. [Posts — videos / TikTok feed](#5-posts--videos--tiktok-feed)
6. [Quick reference](#6-quick-reference)

---

## 1. Wallet — buy coins & payment callback

### App scheme

| Item | Value |
|------|--------|
| Scheme | `zeelove` |
| Path | `payment/callback` |
| Full URL | `zeelove://payment/callback` |

### Buy coins

```http
POST /wallet/buy-coins
```

```json
{
  "amount": 250,
  "callbackUrl": "zeelove://payment/callback",
  "provider": "paystack"
}
```

| Field | Required | Notes |
|-------|----------|--------|
| `amount` | Yes | USD, max `1000` |
| `callbackUrl` | No | Defaults to `zeelove://payment/callback` |
| `provider` | No | `paystack` \| `flutterwave`. Omit → hosted checkout HTML link |

**Response (with provider):**

```json
{
  "message": "Payment link created successfully",
  "link": "https://checkout.paystack.com/...",
  "provider": "paystack",
  "transactionId": "paystack-xxxx",
  "reference": "paystack-xxxx",
  "amount": 250,
  "callbackUrl": "zeelove://payment/callback"
}
```

**App flow:**

1. Call `POST /wallet/buy-coins` with `callbackUrl`
2. Open `link` with `WebBrowser.openAuthSessionAsync`
3. After payment, OS opens deep link:

```
zeelove://payment/callback?status=success&transactionId=TXN_ID&amount=250&reference=PAY-REF
```

4. Callback screen parses query params
5. If `transactionId` present → `GET /wallet/transactions/:id`
6. On success → refresh wallet + transactions

### Deep-link query params

| Param | Required | Values / notes |
|-------|----------|----------------|
| `status` | Yes | `success` \| `failed` \| `cancelled` \| `pending` |
| `transactionId` | No | Use for `GET /wallet/transactions/:id` |
| `reference` | No | Same as id for Paystack/Flutterwave refs |
| `amount` | No | USD charged |
| `message` | No | Failure reason |

Aliases the app parser may accept: `payment_status`/`state`, `transaction_id`/`id`/`txn_id`, `ref`/`trx_ref`, `coins`/`quantity`, `error`/`reason`/`description`.

### Get transaction

```http
GET /wallet/transactions/:id
GET /wallet/transactions/reference/:reference
```

```json
{
  "message": "Transaction retrieved successfully",
  "data": {
    "id": "paystack-abc",
    "transactionId": "paystack-abc",
    "reference": "paystack-abc",
    "amount": 250,
    "status": "success",
    "currency": "USD",
    "created_at": "2026-07-10T01:00:00.000Z"
  }
}
```

`status`: `success` \| `failed` \| `pending`

### Test deep links

```bash
# Android
adb shell am start -a android.intent.action.VIEW -d "zeelove://payment/callback?status=success&transactionId=test-123&amount=250&reference=REF-001"

# iOS Simulator
xcrun simctl openurl booted "zeelove://payment/callback?status=success&transactionId=test-123&amount=250&reference=REF-001"
```

### Mobile files (already present)

- `src/utils/paymentDeepLink.ts`
- `src/screens/wallet/TransactionCallbackScreen.tsx`
- `src/navigation/linking.ts`
- `BuyCoinsScreen.tsx` — send `callbackUrl`
- `app.json` — Android intent filter (needs native rebuild)

---

## 2. Chat — replies

### Send message (REST)

```http
POST /chats/send-message
```

```json
{
  "toUserId": "recipient-uuid",
  "message": "Hi back",
  "fileId": null,
  "replyToMessageId": "parent-msg-uuid"
}
```

| Field | Required | Notes |
|-------|----------|--------|
| `message` or `fileId` | One required | Keep image + caption as **two separate** requests |
| `toUserId` or `chatId` | One required | |
| `replyToMessageId` | No | Parent must be same chat, not deleted, not announcement |

**Response (201):**

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
      "userId": "other-uuid",
      "created_at": "...",
      "user": {
        "id": "...",
        "username": "jane",
        "first_name": "Jane",
        "last_name": "Doe",
        "profile_picture": { "url": "..." }
      },
      "file": { "url": "..." }
    },
    "reactions": [],
    "created_at": "...",
    "updated_at": "...",
    "user": { "...": "sender" }
  }
}
```

### Message history

```http
GET /chats/:chatId/messages?page=1&limit=20
```

Each message includes:

- `replyToMessageId` — string \| null  
- `replyTo` — nested preview or deleted stub  
- `reactions` — grouped array (see below)

**Deleted parent:**

```json
"replyTo": {
  "id": "deleted-parent-id",
  "type": "text",
  "content": "",
  "deleted": true
}
```

→ UI: show “Message deleted”.

### Socket — send

Event: `private-message`

```json
{
  "toUserId": "recipient-uuid",
  "message": "Hi back",
  "fileId": "optional",
  "replyToMessageId": "optional-parent-uuid"
}
```

### Socket — receive (sender **and** recipient)

Event: `private-message`

```json
{
  "messageId": "msg-uuid",
  "fromUserId": "sender-uuid",
  "fromUsername": "john",
  "message": "Hi back",
  "content": "Hi back",
  "type": "text",
  "file": null,
  "created_at": "...",
  "replyToMessageId": "parent-msg-uuid",
  "replyTo": {
    "id": "parent-msg-uuid",
    "type": "file",
    "content": "",
    "fromUserId": "jane-uuid",
    "fromUsername": "jane",
    "file": { "url": "..." },
    "created_at": "..."
  }
}
```

Notes for mappers (`mapSocketMessage.ts` / `mapApi.ts`):

- Prefer real server `messageId` from echo (don’t invent local ids for replies)
- Accept `message` **or** `content` for text
- Accept camelCase or snake_case (`replyToMessageId` / `reply_to_message_id`)

### Frontend checklist — replies

- [ ] Pass `replyToMessageId` from swipe-to-reply composer
- [ ] Map `replyTo` into bubble quote UI
- [ ] Handle `replyTo.deleted === true`
- [ ] Socket echo updates sender’s optimistic message with server id + `replyTo`
- [ ] History reload shows persisted quotes

---

## 3. Chat — emoji reactions

Allowed emojis: `👍` `❤️` `😂` `😮` `😢` `🙏`  
One reaction per user per message (changing emoji replaces).

### REST — add / change

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

### Response (both)

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

Same `reactions` array is embedded on each message from `GET /chats/:chatId/messages`.

### Socket

**Send** event: `message-reaction`

```json
{ "messageId": "msg-uuid", "emoji": "❤️" }
```

Remove:

```json
{ "messageId": "msg-uuid", "emoji": null }
```

**Receive** event: `message-reaction-updated`

```json
{
  "chatId": "chat-uuid",
  "messageId": "msg-uuid",
  "reactions": [
    {
      "emoji": "❤️",
      "count": 2,
      "users": [{ "id": "user-a", "username": "john" }],
      "reactedByMe": false
    }
  ],
  "actorUserId": "user-a"
}
```

Use REST when socket is offline; use socket for live sync.

### Frontend checklist — reactions

- [ ] Wire long-press / emoji picker to POST or socket
- [ ] Update bubble from `message-reaction-updated`
- [ ] Highlight `reactedByMe`
- [ ] Persist via history `reactions` on reload

---

## 4. Posts — comments

Full contract: **[POSTS_COMMENTS_API.md](./POSTS_COMMENTS_API.md)**

### Types (suggested)

```typescript
interface Comment {
  id: string;
  postId: string;
  content: string;
  userId: string;
  parentId?: string | null;
  created_at: string;
  updated_at: string;
  user: {
    id: string;
    username: string;
    first_name: string;
    last_name: string;
    profile_picture: { url: string } | null;
  };
}
```

### List comments

```http
GET /posts/:postId/comments?page=1&limit=20&order=asc
```

- Default `order=asc` (oldest first — better for threads)
- Max `limit` 50
- Soft-deleted comments are omitted

### Create comment

```http
POST /posts/:postId/comments
```

```json
{
  "content": "Love this!",
  "parentId": null
}
```

| Field | Required | Notes |
|-------|----------|--------|
| `content` | Yes | Trimmed, 1–2000 chars |
| `parentId` | No | One-level reply only |

**Response (201):** `{ message, data: Comment }`

Side effects:

- Post `_count.comments` increments
- Post author gets notification `type: "comment"` (not for self-comments)

### Delete comment

```http
DELETE /posts/:postId/comments/:commentId
```

Allowed: comment author, post author, or admin.

```json
{ "message": "Comment deleted" }
```

### Post count on feed / detail

`GET /posts/` and `GET /posts/:id` now include:

```json
"_count": {
  "likes": 10,
  "comments": 5,
  "files": 1
}
```

Update `mapApiPostToPost` to use `_count.comments` instead of hardcoded `0`.

### Notification payload

```json
{
  "type": "comment",
  "title": "New comment",
  "body": "@jane commented on your post",
  "metadata": {
    "postId": "...",
    "commentId": "...",
    "actorUserId": "..."
  }
}
```

Tap → navigate to post detail (optionally scroll to comment).

### Suggested mobile API

```typescript
commentsApi.getComments(postId, { page, limit, order: 'asc' })
commentsApi.createComment(postId, { content, parentId? })
commentsApi.deleteComment(postId, commentId)
```

### Frontend checklist — comments

- [ ] Stop hardcoding `commentsCount: 0` — map `_count.comments`
- [ ] Comment list + composer on `PostDetailScreen`
- [ ] Show count on `PostCard` → open detail
- [ ] Invalidate `['post', postId]` + feed after create/delete
- [ ] Handle `comment` notification deep link

---

## 5. Posts — videos / TikTok feed

Full contract: **[VIDEO_API.md](./VIDEO_API.md)**

```http
POST /upload          # images sync; videos → background jobs
GET  /upload/jobs/:id # poll until file.id ready
POST /posts           # { files: [id], content?, visibility? }
GET  /posts/videos    # vertical feed (?page=&limit=&cursor=)
```

Files on feed/detail now include `type: "image" | "video"` and `thumbnailUrl` for videos.

### Frontend checklist — videos

- [ ] Upload video via authenticated `POST /upload`
- [ ] Poll `GET /upload/jobs/:jobId` until `completed`
- [ ] Create post with returned **`file.id`** (not job id)
- [ ] Vertical video screen on `GET /posts/videos`
- [ ] Play `video.url`; poster from `thumbnailUrl`
- [ ] Infinite scroll with `meta.nextCursor`

---

## 6. Quick reference

| Feature | Method | Path / event |
|---------|--------|----------------|
| Buy coins | REST | `POST /wallet/buy-coins` |
| Tx by id | REST | `GET /wallet/transactions/:id` |
| Tx by ref | REST | `GET /wallet/transactions/reference/:ref` |
| Payment return | Deep link | `zeelove://payment/callback?...` |
| Send + reply | REST | `POST /chats/send-message` |
| History + reply/reactions | REST | `GET /chats/:chatId/messages` |
| Send + reply | Socket | `private-message` → `private-message` |
| Add reaction | REST | `POST /chats/messages/:id/reactions` |
| Remove reaction | REST | `DELETE /chats/messages/:id/reactions` |
| React realtime | Socket | `message-reaction` → `message-reaction-updated` |
| List comments | REST | `GET /posts/:id/comments` |
| Add comment | REST | `POST /posts/:id/comments` |
| Delete comment | REST | `DELETE /posts/:id/comments/:commentId` |
| Upload media | REST | `POST /upload` |
| Video feed | REST | `GET /posts/videos` |
| Create post | REST | `POST /posts` |

### Error expectations

| Situation | Status |
|-----------|--------|
| Reply to other chat / deleted / invalid emoji | `400` |
| Reply/react to announcement; not in chat; friends-only post | `403` |
| Missing message / post / comment | `404` |

### Priority for mobile

1. **P0** — Chat replies (UI already live)
2. **P0** — Post comments + `_count.comments`
3. **P1** — Reactions REST + socket
4. **P1** — Comment notifications navigation

### Related mobile files

**Wallet:** `paymentDeepLink.ts`, `TransactionCallbackScreen.tsx`, `BuyCoinsScreen.tsx`, `linking.ts`  
**Chat:** `chatApi.ts`, `chatSocket.ts`, `mapApi.ts`, `mapSocketMessage.ts`, `ChatBubble.tsx`, `ChatRoomScreen.tsx`  
**Posts:** `postsApi.ts`, `mapApi.ts`, `PostDetailScreen.tsx`, `PostCard.tsx`
