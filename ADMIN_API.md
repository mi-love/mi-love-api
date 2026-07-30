# Zee Love Admin API — Full Reference

Complete admin/back-office HTTP API documentation with auth, query params, request bodies, and response payloads.

| | |
|--|--|
| **Base URL** | `https://zee-love-api.onrender.com` (or your env) |
| **Content-Type** | `application/json` |
| **Auth header** | `Authorization: Bearer <access_token>` |
| **Guards** | Most routes: `JwtAuthGuard` + `AdminRoleGuard` |

---

## Table of contents

1. [Conventions](#1-conventions)
2. [Auth](#2-auth)
3. [Users](#3-users)
4. [Verifications (KYC)](#4-verifications-kyc)
5. [Audit logs](#5-audit-logs)
6. [Posts moderation](#6-posts-moderation)
7. [Comments moderation](#7-comments-moderation)
8. [Gifts catalog](#8-gifts-catalog)
9. [Chats](#9-chats)
10. [Transactions](#10-transactions)
11. [Subscriptions](#11-subscriptions)
12. [Refunds](#12-refunds)
13. [Wallets](#13-wallets)
14. [Revenue](#14-revenue)
15. [Analytics](#15-analytics)
16. [Notifications](#16-notifications)
17. [Support tickets](#17-support-tickets)
18. [Error format](#18-error-format)
19. [Quick index](#19-quick-index)

---

## 1. Conventions

### Auth

| Endpoint group | Auth |
|----------------|------|
| `POST /admin/auth/login` | None |
| `POST /admin/auth/create-user` | None (lock down in production) |
| `POST /admin/auth/logout` | JWT only |
| All other `/admin/*` | JWT **and** admin (`is_admin` or `admin_role`) |

### Shared pagination response

Most list endpoints return:

```json
{
  "data": [ /* items */ ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5,
    "hasNextPage": true,
    "hasPrevPage": false
  }
}
```

### Common query pagination

| Param | Type | Default | Max |
|-------|------|---------|-----|
| `page` | number | `1` | — |
| `limit` | number | `20` (or `50`) | `100` |

### Date params

ISO 8601 strings, e.g. `"2026-07-01T00:00:00.000Z"`.

---

## 2. Auth

### Seeded admin

| Field | Value |
|-------|--------|
| Email | `admin@milove.com` |
| Password | `adminMilove` |

```bash
yarn db:seed:admin
```

---

### `POST /admin/auth/login`

**Auth:** none

**Request body**

| Field | Type | Required |
|-------|------|----------|
| `email` | string | yes |
| `password` | string | yes |

```json
{
  "email": "admin@milove.com",
  "password": "adminMilove"
}
```

**Response `200`**

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Errors**

| Status | When |
|--------|------|
| `400` | Wrong password / OAuth-only account |
| `404` | Email not found |

---

### `POST /admin/auth/create-user`

**Auth:** none

**Request body**

| Field | Type | Required |
|-------|------|----------|
| `email` | string | yes |
| `password` | string | yes |
| `first_name` | string | yes |
| `last_name` | string | yes |
| `username` | string | yes |
| `country` | string | no |
| `phone_number` | string | no |

```json
{
  "email": "ops@milove.com",
  "password": "SecurePass123",
  "first_name": "Ops",
  "last_name": "Admin",
  "username": "ops_admin",
  "country": "NG"
}
```

**Response `200`**

```json
{
  "message": "Admin user created successfully",
  "user": {
    "id": "cuid...",
    "email": "ops@milove.com",
    "username": "ops_admin"
  },
  "access_token": "eyJ..."
}
```

---

### `POST /admin/auth/logout`

**Auth:** JWT

**Request body:** none

**Response `200`**

```json
{ "message": "Logged out successfully" }
```

---

## 3. Users

Base: `/admin/users` · **Auth:** JWT + admin

---

### `GET /admin/users`

**Query**

| Param | Type | Required | Notes |
|-------|------|----------|--------|
| `status` | `active` \| `suspended` \| `banned` \| `deleted` | no | |
| `search` | string | no | email, name, username |
| `page` | number | no | default `1` |
| `limit` | number | no | default `20`, max `100` |

**Response `200`**

```json
{
  "data": [
    {
      "id": "cuid...",
      "email": "user@example.com",
      "first_name": "Jane",
      "last_name": "Doe",
      "username": "jane",
      "account_status": "active",
      "is_verified": true,
      "is_flagged": false,
      "banned_at": null,
      "suspended_at": null,
      "created_at": "2026-01-01T00:00:00.000Z",
      "last_login_at": "2026-07-29T12:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "totalPages": 1,
    "hasNextPage": false,
    "hasPrevPage": false
  }
}
```

---

### `GET /admin/users/dashboard-stats`

**Response `200`**

```json
{
  "totalUsers": 1200,
  "activeUsers": 1100,
  "suspendedUsers": 20,
  "bannedUsers": 10,
  "verifiedUsers": 400,
  "flaggedUsers": 5,
  "pendingVerifications": 12,
  "newUsersThisMonth": 80,
  "newUsersThisWeek": 15
}
```

---

### `GET /admin/users/:id`

**Path:** `id` — user id

**Response `200`**

```json
{
  "id": "cuid...",
  "email": "user@example.com",
  "first_name": "Jane",
  "last_name": "Doe",
  "username": "jane",
  "bio": "...",
  "phone_number": "+234...",
  "country": "NG",
  "account_status": "active",
  "is_verified": true,
  "is_flagged": false,
  "banned_at": null,
  "suspended_at": null,
  "created_at": "2026-01-01T00:00:00.000Z",
  "profile": {
    "bio": "...",
    "photos": [],
    "preferences": {}
  },
  "activityMetrics": {
    "lastLogin": "2026-07-29T12:00:00.000Z",
    "matchesCount": 3,
    "chatsCount": 5,
    "postsCount": 2
  }
}
```

**Errors:** `404` user not found

---

### `PATCH /admin/users/:id/suspend`

**Body**

| Field | Type | Required |
|-------|------|----------|
| `reason` | string | yes |
| `duration` | number (days) | no |

```json
{ "reason": "Spam reports", "duration": 7 }
```

**Response `200`**

```json
{ "message": "User cuid... has been suspended" }
```

**Errors:** `404`, `409` already suspended

---

### `PATCH /admin/users/:id/ban`

**Body**

| Field | Type | Required |
|-------|------|----------|
| `reason` | string | yes |
| `ban_reason_details` | string | no |

```json
{ "reason": "Harassment", "ban_reason_details": "Repeated reports" }
```

**Response `200`**

```json
{ "message": "User cuid... has been banned" }
```

---

### `PATCH /admin/users/:id/reactivate`

**Body**

| Field | Type | Required |
|-------|------|----------|
| `reason` | string | no |

```json
{ "reason": "Appeal approved" }
```

**Response `200`**

```json
{ "message": "User cuid... has been reactivated" }
```

---

### `PATCH /admin/users/:id/flag`

**Body**

| Field | Type | Required |
|-------|------|----------|
| `reason` | string | no |

```json
{ "reason": "Under review" }
```

**Response `200`**

```json
{ "message": "User flagged" }
```

---

### `PATCH /admin/users/:id/unflag`

**Body:** none

**Response `200`**

```json
{ "message": "User unflagged" }
```

---

### `DELETE /admin/users/:id` (soft delete)

**Body**

| Field | Type | Required |
|-------|------|----------|
| `reason` | string | yes |
| `details` | string | no |

```json
{ "reason": "User requested deletion", "details": "GDPR" }
```

**Response `200`**

```json
{ "message": "User cuid... has been soft-deleted" }
```

---

### `DELETE /admin/users/:id/permanent`

**Body:** same as soft delete

**Response `200`**

```json
{ "message": "User cuid... has been permanently deleted" }
```

---

### `GET /admin/users/:id/sessions`

**Response `200`** — paginated sessions:

```json
{
  "data": [
    {
      "id": "...",
      "userId": "...",
      "token_hash": "...",
      "ip_address": "1.2.3.4",
      "user_agent": "Mozilla/...",
      "expires_at": "...",
      "revoked_at": null,
      "last_seen_at": "...",
      "created_at": "...",
      "updated_at": "..."
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 1, "totalPages": 1, "hasNextPage": false, "hasPrevPage": false }
}
```

---

### `GET /admin/users/:id/devices`

**Response `200`** — paginated devices:

```json
{
  "data": [
    {
      "id": "...",
      "userId": "...",
      "device_id": "uuid",
      "platform": "ios",
      "os_version": "17.0",
      "app_version": "1.2.0",
      "ip_address": "1.2.3.4",
      "last_seen_at": "...",
      "created_at": "...",
      "updated_at": "..."
    }
  ],
  "pagination": { "...": "..." }
}
```

---

### `GET /admin/users/:id/linked-accounts`

**Response `200`** — paginated `user_link` rows:

```json
{
  "data": [
    {
      "id": "...",
      "sourceUserId": "...",
      "targetUserId": "...",
      "reason": "same_device",
      "confidence_score": 0.9,
      "created_by": "...",
      "created_at": "...",
      "updated_at": "..."
    }
  ],
  "pagination": { "...": "..." }
}
```

---

### `PATCH /admin/users/:id/email`

**Body**

| Field | Type | Required |
|-------|------|----------|
| `newEmail` | email string | yes |
| `notes` | string | no |

```json
{ "newEmail": "new@example.com", "notes": "User typo" }
```

**Response `200`**

```json
{ "message": "Email updated for user ...", "newEmail": "new@example.com" }
```

---

### `PATCH /admin/users/:id/name`

**Body**

| Field | Type | Required |
|-------|------|----------|
| `firstName` | string | no |
| `lastName` | string | no |
| `username` | string | no |
| `notes` | string | no |

```json
{ "firstName": "Jane", "lastName": "Smith", "username": "janes" }
```

**Response `200`**

```json
{ "message": "Name/username updated for user ..." }
```

---

### `PATCH /admin/users/:id/password`

**Body**

| Field | Type | Required |
|-------|------|----------|
| `newPassword` | string | yes |
| `notes` | string | no |

```json
{ "newPassword": "TempPass123!", "notes": "Support reset" }
```

**Response `200`**

```json
{ "message": "Password reset for user .... All sessions invalidated." }
```

---

### `PATCH /admin/users/:id/profile-details`

**Body**

| Field | Type | Required |
|-------|------|----------|
| `bio` | string | no |
| `phoneNumber` | string | no |
| `country` | string | no |
| `city` | string | no |
| `notes` | string | no |

```json
{
  "bio": "Hello",
  "phoneNumber": "+234...",
  "country": "NG",
  "city": "Lagos"
}
```

**Response `200`**

```json
{ "message": "Profile details updated for user ..." }
```

---

### `GET /admin/users/:id/security-profile`

**Response `200`**

```json
{
  "id": "...",
  "email": "...",
  "firstName": "Jane",
  "lastName": "Doe",
  "username": "jane",
  "phoneNumber": null,
  "country": "NG",
  "city": null,
  "bio": null,
  "accountStatus": "active",
  "isVerified": true,
  "is2faEnabled": false,
  "twoFactorMethod": null,
  "lastLogin": "...",
  "createdAt": "...",
  "updatedAt": "...",
  "suspendedAt": null,
  "bannedAt": null
}
```

---

### `POST /admin/users/:id/2fa/enable`

**Body**

| Field | Type | Required |
|-------|------|----------|
| `method` | `2fa_email` \| `2fa_sms` \| `2fa_authenticator` | no |
| `notes` | string | no |

```json
{ "method": "2fa_email" }
```

**Response `200`**

```json
{ "message": "2FA enabled for user ... with method: 2fa_email" }
```

---

### `POST /admin/users/:id/2fa/disable`

**Body**

| Field | Type | Required |
|-------|------|----------|
| `reason` | string | yes |
| `notes` | string | no |

```json
{ "reason": "Lost device" }
```

**Response `200`**

```json
{ "message": "2FA disabled for user ..." }
```

---

### `GET /admin/users/:id/2fa/status`

**Response `200`**

```json
{
  "userId": "...",
  "is2faEnabled": false,
  "twoFactorMethod": null,
  "enabledAt": null,
  "lastUsedAt": null
}
```

---

### `POST /admin/users/:id/send-reactivation-notification`

**Body**

| Field | Type | Required |
|-------|------|----------|
| `message` | string | no |
| `channel` | `email` \| `sms` \| `both` | no |

```json
{ "message": "Welcome back!", "channel": "email" }
```

**Response `200`**

```json
{ "message": "Reactivation notification sent to user ..." }
```

---

## 4. Verifications (KYC)

Base: `/admin/verifications` · **Auth:** JWT + admin

---

### `GET /admin/verifications`

**Query**

| Param | Type | Required |
|-------|------|----------|
| `status` | `pending` \| `approved` \| `rejected` | no |
| `page` | number | no |
| `limit` | number | no |

**Response `200`**

```json
{
  "data": [
    {
      "id": "...",
      "userId": "...",
      "type": "nin",
      "status": "pending",
      "document_url": "https://...",
      "metadata": {},
      "reason": null,
      "reviewed_by": null,
      "reviewed_at": null,
      "created_at": "...",
      "updated_at": "...",
      "user": {
        "id": "...",
        "email": "...",
        "username": "jane"
      }
    }
  ],
  "pagination": { "...": "..." }
}
```

`type` examples: `bvn` | `nin` | `passport` | `drivers_license` | `national_id`

---

### `PATCH /admin/verifications/:id/approve`

**Body**

| Field | Type | Required |
|-------|------|----------|
| `notes` | string | no |

```json
{ "notes": "Docs look good" }
```

**Response `200`**

```json
{ "message": "Verification ... has been approved" }
```

**Errors:** `404`, `409` not pending

---

### `PATCH /admin/verifications/:id/reject`

**Body**

| Field | Type | Required |
|-------|------|----------|
| `reason` | string | yes |
| `details` | string | no |

```json
{ "reason": "Blurry document", "details": "Please re-upload" }
```

**Response `200`**

```json
{ "message": "Verification ... has been rejected" }
```

---

## 5. Audit logs

### `GET /admin/audit-logs`

**Auth:** JWT + admin

**Query**

| Param | Type | Required | Default |
|-------|------|----------|---------|
| `page` | number | no | `1` |
| `limit` | number | no | `50` (max 100) |
| `adminId` | string | no | |
| `resource` | string | no | e.g. `user`, `post`, `gift` |
| `action` | string | no | e.g. `BAN_USER`, `DELETE_POST` |

**Response `200`**

```json
{
  "data": [
    {
      "id": "...",
      "adminId": "...",
      "action": "DELETE_POST",
      "resource": "post",
      "resource_id": "...",
      "metadata": { "reason": "Spam" },
      "created_at": "...",
      "admin": {
        "id": "...",
        "email": "admin@milove.com",
        "username": "admin_milove",
        "first_name": "Admin",
        "last_name": "MiLove"
      }
    }
  ],
  "pagination": { "...": "..." }
}
```

---

## 6. Posts moderation

Base: `/admin/posts` · **Auth:** JWT + admin

---

### `GET /admin/posts`

**Query**

| Param | Type | Required |
|-------|------|----------|
| `page` | number | no |
| `limit` | number | no |
| `search` | string | no |
| `userId` | string | no |
| `visibility` | `public` \| `friends` | no |

**Response `200`**

```json
{
  "data": [
    {
      "id": "...",
      "content": "Hello world",
      "visibility": "public",
      "userId": "...",
      "created_at": "...",
      "updated_at": "...",
      "user": {
        "id": "...",
        "username": "jane",
        "first_name": "Jane",
        "last_name": "Doe",
        "email": "jane@example.com"
      },
      "files": [
        { "id": "...", "url": "https://...", "type": "image" }
      ],
      "_count": {
        "likes": 10,
        "comments": 3
      }
    }
  ],
  "pagination": { "...": "..." }
}
```

---

### `GET /admin/posts/:id`

**Response `200`**

```json
{
  "data": {
    "id": "...",
    "content": "...",
    "visibility": "public",
    "userId": "...",
    "created_at": "...",
    "updated_at": "...",
    "user": {
      "id": "...",
      "username": "jane",
      "first_name": "Jane",
      "last_name": "Doe",
      "email": "jane@example.com",
      "account_status": "active"
    },
    "files": [{ "id": "...", "url": "...", "type": "image", "provider": "cloudinary" }],
    "_count": { "likes": 10, "comments": 3 }
  }
}
```

**Errors:** `404` `{ "message": "Post not found" }`

---

### `DELETE /admin/posts/:id`

**Body**

| Field | Type | Required |
|-------|------|----------|
| `reason` | string | no |

```json
{ "reason": "Policy violation" }
```

**Response `200`**

```json
{ "message": "Post deleted" }
```

---

## 7. Comments moderation

Base: `/admin/comments` · **Auth:** JWT + admin

---

### `GET /admin/comments`

**Query**

| Param | Type | Required | Default |
|-------|------|----------|---------|
| `page` | number | no | `1` |
| `limit` | number | no | `20` |
| `postId` | string | no | |
| `userId` | string | no | |
| `includeDeleted` | boolean | no | `false` |

**Response `200`**

```json
{
  "data": [
    {
      "id": "...",
      "content": "Nice post!",
      "postId": "...",
      "userId": "...",
      "parentId": null,
      "deleted_at": null,
      "created_at": "...",
      "updated_at": "...",
      "user": {
        "id": "...",
        "username": "jane",
        "first_name": "Jane",
        "last_name": "Doe"
      },
      "post": {
        "id": "...",
        "content": "Original post...",
        "userId": "..."
      }
    }
  ],
  "pagination": { "...": "..." }
}
```

---

### `DELETE /admin/comments/:id`

Soft-delete (`deleted_at` set, content cleared).

**Body**

```json
{ "reason": "Harassment" }
```

**Response `200`**

```json
{ "message": "Comment deleted" }
```

---

## 8. Gifts catalog

Base: `/admin/gifts` · **Auth:** JWT + admin

---

### `GET /admin/gifts/categories`

**Response `200`**

```json
{
  "data": [
    {
      "id": "...",
      "name": "General Gifts",
      "description": null,
      "created_at": "...",
      "updated_at": "...",
      "_count": { "gift": 12 }
    }
  ]
}
```

---

### `POST /admin/gifts/categories`

**Body**

| Field | Type | Required |
|-------|------|----------|
| `name` | string | yes |
| `description` | string | no |

```json
{ "name": "Luxury", "description": "Premium gifts" }
```

**Response `200`**

```json
{
  "message": "Category created",
  "data": {
    "id": "...",
    "name": "Luxury",
    "description": "Premium gifts",
    "created_at": "...",
    "updated_at": "..."
  }
}
```

**Errors:** `409` name already exists

---

### `PATCH /admin/gifts/categories/:id`

**Body**

```json
{ "name": "Luxury Gifts", "description": "Updated" }
```

**Response `200`**

```json
{ "message": "Category updated", "data": { "...": "..." } }
```

---

### `DELETE /admin/gifts/categories/:id`

**Response `200`**

```json
{ "message": "Category deleted" }
```

**Errors:** `404`, `409` category still has gifts

---

### `GET /admin/gifts`

**Query**

| Param | Type | Required | Default |
|-------|------|----------|---------|
| `page` | number | no | `1` |
| `limit` | number | no | `50` |
| `categoryId` | string | no | |
| `search` | string | no | |

**Response `200`**

```json
{
  "data": [
    {
      "id": "...",
      "name": "Red Rose",
      "description": "...",
      "points": 5,
      "gift_category_id": "...",
      "imageId": "...",
      "created_at": "...",
      "updated_at": "...",
      "category": { "id": "...", "name": "General Gifts" },
      "image": { "id": "...", "url": "https://..." }
    }
  ],
  "pagination": { "...": "..." }
}
```

---

### `POST /admin/gifts`

**Body**

| Field | Type | Required |
|-------|------|----------|
| `name` | string | yes |
| `gift_category_id` | string | yes |
| `points` | number | yes |
| `description` | string | no |
| `imageId` | string | no | uploaded file id |

```json
{
  "name": "Red Rose",
  "gift_category_id": "category-cuid",
  "points": 5,
  "description": "A classic rose",
  "imageId": "file-cuid"
}
```

**Response `200`**

```json
{
  "message": "Gift created",
  "data": {
    "id": "...",
    "name": "Red Rose",
    "points": 5,
    "category": { "id": "...", "name": "General Gifts" },
    "image": { "id": "...", "url": "https://..." }
  }
}
```

---

### `PATCH /admin/gifts/:id`

**Body** — all optional: `name`, `gift_category_id`, `points`, `description`, `imageId`

**Response `200`**

```json
{ "message": "Gift updated", "data": { "...": "..." } }
```

---

### `DELETE /admin/gifts/:id`

**Response `200`**

```json
{ "message": "Gift deleted" }
```

---

## 9. Chats

Base: `/admin/chats` · **Auth:** JWT + admin

---

### `GET /admin/chats`

**Query**

| Param | Type | Required |
|-------|------|----------|
| `page` | number | no |
| `limit` | number | no |
| `userId` | string | no |
| `search` | string | no |
| `startDate` | ISO string | no |
| `endDate` | ISO string | no |

**Response `200`**

```json
{
  "data": [
    {
      "id": "...",
      "participants": [
        {
          "id": "...",
          "email": "...",
          "username": "jane",
          "avatar": "https://..."
        }
      ],
      "messageCount": 42,
      "createdAt": "...",
      "updatedAt": "...",
      "lastMessageAt": "...",
      "isActive": true
    }
  ],
  "pagination": { "...": "..." }
}
```

---

### `GET /admin/chats/statistics`

**Response `200`**

```json
{
  "totalChats": 500,
  "activeChats": 480,
  "archivedChats": 20,
  "totalMessages": 12000,
  "messagesPerDay": 400,
  "topChatParticipants": [
    {
      "userId": "...",
      "username": "jane",
      "messageCount": 300
    }
  ]
}
```

---

### `GET /admin/chats/:chatId/messages`

**Query:** `page`, `limit` (default 50), `search`, `startDate`, `endDate`

**Response `200`**

```json
{
  "data": [
    {
      "id": "...",
      "chatId": "...",
      "senderId": "...",
      "senderName": "jane",
      "content": "Hello",
      "type": "text",
      "fileUrl": null,
      "read": false,
      "readAt": null,
      "createdAt": "...",
      "updatedAt": "..."
    }
  ],
  "pagination": { "...": "..." }
}
```

---

### `DELETE /admin/chats/messages/:messageId`

**Body**

| Field | Type | Required |
|-------|------|----------|
| `reason` | string | no |
| `isHardDelete` | boolean | no |

```json
{ "reason": "Abuse", "isHardDelete": false }
```

**Response `200`**

```json
{ "message": "Message ... has been deleted" }
```

---

### `POST /admin/chats/messages/bulk-delete`

**Body**

| Field | Type | Required |
|-------|------|----------|
| `messageIds` | string[] | yes |
| `reason` | string | no |

```json
{
  "messageIds": ["msg1", "msg2"],
  "reason": "Spam"
}
```

**Response `200`**

```json
{
  "message": "2 messages deleted",
  "deletedCount": 2
}
```

---

### `PATCH /admin/chats/:chatId/archive`

Disables messaging (`can_send_messages: false`).

**Body**

```json
{ "reason": "Harassment report" }
```

**Response `200`**

```json
{ "message": "Chat ... has been archived" }
```

---

### `GET /admin/chats/user/:userId/statistics`

**Response `200`**

```json
{
  "totalMessages": 120,
  "chatsParticipated": 8,
  "lastMessageAt": "2026-07-29T12:00:00.000Z"
}
```

---

## 10. Transactions

Base: `/admin/transactions` · **Auth:** JWT + admin

---

### `GET /admin/transactions`

**Query**

| Param | Type | Required |
|-------|------|----------|
| `status` | `success` \| `failed` \| `pending` | no |
| `startDate` | ISO string | no |
| `endDate` | ISO string | no |
| `page` | number | no |
| `limit` | number | no |

**Response `200`**

```json
{
  "data": [
    {
      "id": "paystack-...",
      "amount": 250,
      "fee": 0,
      "type": "credit",
      "description": "Purchase of coins (Paystack)",
      "status": "success",
      "currency": "USD",
      "payment_link": "https://...",
      "provider_ref": null,
      "userId": "...",
      "created_at": "...",
      "updated_at": "...",
      "user": {
        "id": "...",
        "email": "...",
        "username": "jane"
      }
    }
  ],
  "pagination": { "...": "..." }
}
```

---

### `GET /admin/transactions/duplicates`

**Response `200`**

```json
[
  {
    "userId": "...",
    "amount": 250,
    "count": 2,
    "duplicateType": "identical",
    "similarityScore": 1.0
  }
]
```

---

### `GET /admin/transactions/:id`

**Response `200`**

```json
{
  "id": "...",
  "amount": 250,
  "status": "success",
  "currency": "USD",
  "userId": "...",
  "created_at": "...",
  "user": {
    "id": "...",
    "email": "...",
    "username": "jane",
    "first_name": "Jane",
    "last_name": "Doe"
  },
  "refunds": []
}
```

**Errors:** `404`

---

## 11. Subscriptions

Base: `/admin/subscriptions` · **Auth:** JWT + admin

---

### `GET /admin/subscriptions`

**Query**

| Param | Type | Required |
|-------|------|----------|
| `status` | `pending` \| `active` \| `expired` \| `canceled` | no |
| `page` | number | no |
| `limit` | number | no |

**Response `200`**

```json
{
  "data": [
    {
      "id": "...",
      "userId": "...",
      "plan_name": "premium",
      "amount": "9.99",
      "status": "active",
      "start_at": "...",
      "end_at": "...",
      "auto_renew": true,
      "provider_ref": null,
      "created_at": "...",
      "updated_at": "...",
      "user": {
        "id": "...",
        "email": "...",
        "username": "jane"
      }
    }
  ],
  "pagination": { "...": "..." }
}
```

---

### `GET /admin/subscriptions/:userId`

**Response `200`** — array of subscription rows for that user.

```json
[
  {
    "id": "...",
    "userId": "...",
    "plan_name": "premium",
    "amount": "9.99",
    "status": "active",
    "start_at": "...",
    "end_at": "...",
    "auto_renew": true,
    "provider_ref": null,
    "created_at": "...",
    "updated_at": "..."
  }
]
```

---

## 12. Refunds

Base: `/admin/refunds` · **Auth:** JWT + admin

> Creates a **pending DB record only** — does not call Paystack/Flutterwave yet.

---

### `GET /admin/refunds`

**Query**

| Param | Type | Required |
|-------|------|----------|
| `status` | `pending` \| `processing` \| `completed` \| `failed` \| `rejected` | no |
| `page` | number | no |
| `limit` | number | no |

**Response `200`** — paginated refunds with nested `transaction.user` and `requester`.

---

### `POST /admin/refunds/:transactionId`

**Body**

| Field | Type | Required |
|-------|------|----------|
| `reason` | string | recommended |

```json
{ "reason": "Duplicate charge" }
```

**Response `200`**

```json
{
  "message": "Refund created successfully",
  "refundId": "..."
}
```

**Errors:** `404` transaction, `400` not successful / pending refund exists

---

## 13. Wallets

### `GET /admin/wallets/:userId`

**Auth:** JWT + admin

**Response `200`**

```json
{
  "id": "wallet-cuid",
  "balance": 150.5,
  "currency": "USD",
  "created_at": "...",
  "updated_at": "...",
  "recentTransactions": [
    {
      "id": "...",
      "amount": 25,
      "status": "success",
      "type": "credit",
      "created_at": "..."
    }
  ]
}
```

**Errors:** `404` user / no wallet

---

## 14. Revenue

Base: `/admin/revenue` · **Auth:** JWT + admin

---

### `GET /admin/revenue/analytics`

**Query**

| Param | Type | Required | Default |
|-------|------|----------|---------|
| `type` | `daily` \| `weekly` \| `monthly` | no | `daily` |
| `startDate` | ISO string | no | |
| `endDate` | ISO string | no | |

**Response `200`**

```json
[
  {
    "period": "2026-07-29",
    "totalRevenue": 1250,
    "totalTransactions": 40,
    "successfulTransactions": 40,
    "failedTransactions": 0,
    "averageTransactionValue": 31.25,
    "subscriptionRevenue": 0,
    "refundedAmount": 0,
    "netRevenue": 1250
  }
]
```

---

### `GET /admin/revenue/summary`

**Response `200`**

```json
{
  "totalTransactions": 500,
  "totalRevenue": 12500,
  "successfulTransactions": 480,
  "failedTransactions": 15,
  "pendingTransactions": 5,
  "activeSubscriptions": 20,
  "pendingRefunds": 2,
  "totalRefunded": 50,
  "averageTransactionValue": 26.04
}
```

---

## 15. Analytics

Base: `/admin/analytics` · **Auth:** JWT + admin

Shared date query on several routes: `startDate?`, `endDate?`, `groupBy?` = `daily` | `weekly` | `monthly`.

---

### `GET /admin/analytics/users`

**Response `200`**

```json
[
  {
    "period": "2026-07-29",
    "newUsers": 12,
    "activeUsers": 200,
    "inactiveUsers": 50,
    "deletedUsers": 1,
    "bannedUsers": 0,
    "suspendedUsers": 2
  }
]
```

---

### `GET /admin/analytics/users/retention`

**Response `200`**

```json
{
  "period": "30d",
  "totalUsers": 1200,
  "retentionRate": 0.65,
  "churnRate": 0.35,
  "returningUsers": 780
}
```

---

### `GET /admin/analytics/engagement`

**Response `200`**

```json
[
  {
    "period": "2026-07-29",
    "matchesCount": 0,
    "messagesSent": 400,
    "messagesReceived": 0,
    "postsCreated": 25,
    "postsLiked": 80,
    "commentsCreated": 40,
    "averageEngagementPerUser": 0,
    "totalEngagementScore": 545
  }
]
```

---

### `GET /admin/analytics/conversion`

**Response `200`**

```json
{
  "period": "...",
  "freeToPaidRate": 0.05,
  "freeUsers": 1000,
  "paidUsers": 50,
  "totalConversions": 50,
  "conversionValue": 499.5,
  "subscriptionConversionRate": 0.05
}
```

---

### `GET /admin/analytics/panic`

**Query:** `startDate?`, `endDate?`, `status?` (`resolved` \| `unresolved` \| `all`)

**Response `200`**

```json
{
  "period": "...",
  "totalAlerts": 10,
  "resolvedAlerts": 8,
  "unResolvedAlerts": 2,
  "avgResolutionTime": 45,
  "alertsByHour": [{ "hour": 14, "count": 3 }],
  "topLocations": [{ "location": "Lagos", "count": 4 }],
  "responseRate": 0.8
}
```

---

### `GET /admin/analytics/geography`

**Query:** `groupBy?` (`country` \| `city`), `limit?` (default 20)

**Response `200`**

```json
[
  {
    "country": "NG",
    "city": null,
    "userCount": 800,
    "activeUserCount": 600,
    "engagementScore": 0,
    "averageSessionDuration": 0,
    "conversionRate": 0.04
  }
]
```

---

### `GET /admin/analytics/summary`

**Response `200`**

```json
{
  "users": {
    "total": 1200,
    "active": 900,
    "new": 80,
    "retention": 0.65
  },
  "engagement": {
    "totalMessages": 12000,
    "totalMatches": 0,
    "totalPosts": 500,
    "averageSessionTime": 42
  },
  "revenue": {
    "totalRevenue": 0,
    "subscriptionRevenue": 0,
    "averageTransactionValue": 0,
    "conversionRate": 0.05
  },
  "panicAlerts": {
    "total": 10,
    "resolved": 8,
    "avgResolutionTime": 45
  },
  "geography": {
    "topCountries": [{ "country": "NG", "userCount": 800 }],
    "userDistribution": [{ "country": "NG", "percentage": 66.7 }]
  }
}
```

---

## 16. Notifications

Base: `/admin/notifications` · **Auth:** JWT + admin

---

### `POST /admin/notifications/send`

**Body**

| Field | Type | Required |
|-------|------|----------|
| `target` | `all` \| `segment` \| `user` | yes |
| `channel` | `in_app` \| `email` \| `sms` | yes |
| `templateId` | string | yes |
| `userId` | string | if `target=user` |
| `segment` | string | if `target=segment` |
| `variables` | object | no |
| `title` | string | no (override) |
| `body` | string | no (override) |

```json
{
  "target": "user",
  "userId": "user-cuid",
  "channel": "in_app",
  "templateId": "template-cuid",
  "variables": { "name": "Jane" },
  "title": "Hello",
  "body": "Welcome back {{name}}"
}
```

**Response `200` (single)**

```json
{
  "id": "...",
  "templateId": "...",
  "userId": "...",
  "channel": "in_app",
  "target": "user",
  "status": "pending",
  "message": "...",
  "created_at": "..."
}
```

**Response `200` (bulk/all)**

```json
{
  "id": "queued",
  "channel": "in_app",
  "target": "all",
  "status": "pending",
  "message": "Bulk notification queued for 100 recipients",
  "created_at": "..."
}
```

---

### `POST /admin/notifications/send-bulk`

**Body**

| Field | Type | Required |
|-------|------|----------|
| `target` | `all` \| `segment` \| `user` | yes |
| `channel` | `in_app` \| `email` \| `sms` | yes |
| `templateId` | string | yes |
| `userIds` | string[] | no |
| `segment` | string | no |
| `variables` | object | no |
| `title` | string | no |
| `body` | string | no |
| `batchSize` | number 1–1000 | no |

> Current implementation only uses `userIds[0]` — not full multi-user send yet.

---

### `GET /admin/notifications/templates`

**Response `200`** — paginated templates:

```json
{
  "data": [
    {
      "id": "...",
      "name": "welcome",
      "channel": "in_app",
      "title": "Welcome",
      "body": "Hello {{name}}",
      "variables": { "name": "User display name" },
      "is_active": true,
      "created_at": "...",
      "updated_at": "..."
    }
  ],
  "pagination": { "...": "..." }
}
```

---

### `POST /admin/notifications/templates`

**Body**

| Field | Type | Required |
|-------|------|----------|
| `name` | string | yes |
| `channel` | `in_app` \| `email` \| `sms` | yes |
| `title` | string | yes |
| `body` | string | yes |
| `variables` | object | no |

```json
{
  "name": "promo_july",
  "channel": "email",
  "title": "July promo",
  "body": "Hi {{name}}, enjoy 20% off coins",
  "variables": { "name": "First name" }
}
```

**Response `200`** — created template object.

---

### `PATCH /admin/notifications/templates/:id`

**Body** (all optional): `name`, `title`, `body`, `variables`, `isActive`

**Response `200`** — updated template.

---

### `DELETE /admin/notifications/templates/:id`

**Response `200`**

```json
{ "message": "Template ... deleted successfully" }
```

---

### `GET /admin/notifications/logs`

**Query:** `channel?`, `status?` (`success` \| `failed` \| `pending`), `templateId?`, `userId?`, `page?`, `limit?`, `startDate?`, `endDate?`

**Response `200`** — paginated logs with optional `template` and `user`.

---

### `GET /admin/notifications/stats`

**Response `200`**

```json
{
  "totalNotificationsSent": 1000,
  "totalNotificationsSuccessful": 950,
  "totalNotificationsFailed": 50,
  "successRate": 0.95,
  "topTemplates": [
    { "templateName": "welcome", "count": 200, "successRate": 0.98 }
  ],
  "topChannels": [
    { "channel": "in_app", "count": 800, "successRate": 0 }
  ]
}
```

---

## 17. Support tickets

Base: `/admin/support` · **Auth:** JWT + admin

> **Note:** Prisma `support_ticket` model may be missing — list/stats can return empty; mutations may fail until schema is added.

---

### `GET /admin/support/tickets`

**Query**

| Param | Type | Required |
|-------|------|----------|
| `status` | `open` \| `in_progress` \| `resolved` \| `closed` \| `reopened` | no |
| `priority` | `low` \| `medium` \| `high` \| `critical` | no |
| `category` | `technical` \| `billing` \| `complaint` \| `feature_request` \| `other` | no |
| `search` | string | no |
| `page` | number | no |
| `limit` | number | no |
| `startDate` | ISO string | no |
| `endDate` | ISO string | no |

**Response `200`** — paginated tickets with `user`, `assigned_admin`, latest responses.

---

### `GET /admin/support/tickets/:id`

**Response `200`** — full ticket + all responses.

```json
{
  "id": "...",
  "userId": "...",
  "subject": "Payment issue",
  "description": "...",
  "category": "billing",
  "status": "open",
  "priority": "high",
  "attachments": [],
  "assignedToAdminId": null,
  "createdAt": "...",
  "updatedAt": "...",
  "responses": [
    {
      "id": "...",
      "ticketId": "...",
      "responderId": "...",
      "isFromAdmin": true,
      "message": "Looking into this",
      "attachments": [],
      "createdAt": "..."
    }
  ]
}
```

---

### `PATCH /admin/support/tickets/:id/status`

**Body**

```json
{ "status": "in_progress", "notes": "Assigned to finance" }
```

**Response `200`**

```json
{ "message": "Ticket ... status updated to in_progress" }
```

---

### `PATCH /admin/support/tickets/:id/priority`

**Body**

```json
{ "priority": "critical", "reason": "VIP user" }
```

---

### `PATCH /admin/support/tickets/:id/assign`

**Body**

```json
{ "adminId": "admin-cuid", "notes": "Please handle" }
```

---

### `POST /admin/support/tickets/:id/reply`

**Body**

| Field | Type | Required |
|-------|------|----------|
| `message` | string | yes |
| `attachments` | string[] | no |

```json
{
  "message": "We've refunded your coins.",
  "attachments": []
}
```

**Response `200`**

```json
{
  "message": "Reply added to ticket ...",
  "responseId": "..."
}
```

---

### `PATCH /admin/support/tickets/:id/close`

**Body**

```json
{ "resolution": "Resolved via refund", "satisfactionRating": 5 }
```

---

### `GET /admin/support/statistics`

**Response `200`**

```json
{
  "totalTickets": 40,
  "openTickets": 10,
  "inProgressTickets": 5,
  "resolvedTickets": 20,
  "closedTickets": 5,
  "averageResolutionTime": 36,
  "satisfactionScore": 4.2,
  "ticketsByCategory": {},
  "ticketsByPriority": {}
}
```

---

## 18. Error format

Typical Nest error body:

```json
{
  "statusCode": 400,
  "timestamp": "2026-07-30T02:00:37.099Z",
  "path": "/admin/auth/login",
  "message": "No account found with this credentials",
  "error": "Bad Request"
}
```

| Status | Meaning |
|--------|---------|
| `400` | Validation / bad credentials / business rule |
| `401` | Missing or invalid JWT |
| `403` | Authenticated but not admin |
| `404` | Resource not found |
| `409` | Conflict (already suspended, duplicate name, etc.) |
| `500` | Unexpected server / Prisma error |

---

## 19. Quick index

| Area | Base path | Auth |
|------|-----------|------|
| Login / create admin | `/admin/auth` | login/create: none |
| Users | `/admin/users` | yes |
| KYC | `/admin/verifications` | yes |
| Audit | `/admin/audit-logs` | yes |
| Posts | `/admin/posts` | yes |
| Comments | `/admin/comments` | yes |
| Gifts | `/admin/gifts` | yes |
| Chats | `/admin/chats` | yes |
| Transactions | `/admin/transactions` | yes |
| Subscriptions | `/admin/subscriptions` | yes |
| Refunds | `/admin/refunds` | yes |
| Wallets | `/admin/wallets` | yes |
| Revenue | `/admin/revenue` | yes |
| Analytics | `/admin/analytics` | yes |
| Notifications | `/admin/notifications` | yes |
| Support | `/admin/support` | yes |

### Example admin session

```http
POST /admin/auth/login
Content-Type: application/json

{ "email": "admin@milove.com", "password": "adminMilove" }
```

Then:

```http
GET /admin/users/dashboard-stats
Authorization: Bearer <access_token>
```

---

## Related files

- Controllers: `src/modules/admin/controllers/`
- Services: `src/modules/admin/services/`
- DTOs: `src/modules/admin/dtos/`
- Shorter overview: `src/modules/admin/README.md`
- Auth: `src/modules/auth/auth.controller.ts` (`AdminAuthController`)
- Seed: `scripts/seed-admin.js` → `yarn db:seed:admin`
