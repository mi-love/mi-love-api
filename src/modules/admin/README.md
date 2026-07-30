# Admin API documentation

Complete reference for the Zee Love admin dashboard / back-office.

**Base URL:** `https://zee-love-api.onrender.com` (or your env)  
**Auth:** `Authorization: Bearer <admin_jwt>` on all routes except login / create-user  
**Guards:** `JwtAuthGuard` + `AdminRoleGuard` (`is_admin` or non-empty `admin_role`)

---

## Table of contents

1. [Auth](#1-auth)
2. [Users](#2-users)
3. [Verifications (KYC)](#3-verifications-kyc)
4. [Audit logs](#4-audit-logs)
5. [Posts & comments (moderation)](#5-posts--comments-moderation)
6. [Gifts catalog](#6-gifts-catalog)
7. [Chats](#7-chats)
8. [Payments](#8-payments)
9. [Analytics](#9-analytics)
10. [Notifications](#10-notifications)
11. [Support tickets](#11-support-tickets)
12. [Pagination & errors](#12-pagination--errors)
13. [Known gaps / roadmap](#13-known-gaps--roadmap)

---

## 1. Auth

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/admin/auth/login` | No | Admin login → JWT |
| `POST` | `/admin/auth/create-user` | No* | Create admin user |
| `POST` | `/admin/auth/logout` | Yes | Logout / clear sessions |

\*Protect in production (currently open).

### Seeded admin (default)

| Field | Value |
|-------|--------|
| Email | `admin@milove.com` |
| Password | `adminMilove` |

Re-seed anytime:

```bash
yarn db:seed:admin
# or
node scripts/seed-admin.js
```

### Login

```http
POST /admin/auth/login
Content-Type: application/json

{ "email": "admin@milove.com", "password": "adminMilove" }
```

Use returned `access_token` as Bearer token for all admin routes.

Legacy aliases also exist: `/auth/admin/login`, `/auth/admin/create-user`.

---

## 2. Users

Base: `/admin/users`

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/` | List users (`status`, `search`, `page`, `limit`) |
| `GET` | `/dashboard-stats` | Totals: active / suspended / banned / verified / flagged / pending KYC |
| `GET` | `/:id` | User detail + activity |
| `PATCH` | `/:id/suspend` | Suspend (`reason`, optional `duration` days) |
| `PATCH` | `/:id/ban` | Ban |
| `PATCH` | `/:id/reactivate` | Reactivate |
| `PATCH` | `/:id/flag` | Flag for review (`reason?`) **new** |
| `PATCH` | `/:id/unflag` | Clear flag **new** |
| `DELETE` | `/:id` | Soft delete |
| `DELETE` | `/:id/permanent` | Hard delete |
| `GET` | `/:id/sessions` | Sessions |
| `GET` | `/:id/devices` | Devices |
| `GET` | `/:id/linked-accounts` | Linked accounts |
| `PATCH` | `/:id/email` | Reset email |
| `PATCH` | `/:id/name` | Reset name / username |
| `PATCH` | `/:id/password` | Reset password |
| `PATCH` | `/:id/profile-details` | bio / phone / country / city |
| `GET` | `/:id/security-profile` | Security profile |
| `POST` | `/:id/2fa/enable` | Enable 2FA |
| `POST` | `/:id/2fa/disable` | Disable 2FA |
| `GET` | `/:id/2fa/status` | 2FA status |
| `POST` | `/:id/send-reactivation-notification` | Send reactivation notice |

### List users

```http
GET /admin/users?page=1&limit=20&status=active&search=jane
```

`status`: `active` | `suspended` | `banned` | `deleted`

### Flag / unflag

```http
PATCH /admin/users/:id/flag
{ "reason": "Spam reports" }

PATCH /admin/users/:id/unflag
```

---

## 3. Verifications (KYC)

Base: `/admin/verifications`

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/` | List verifications |
| `PATCH` | `/:id/approve` | Approve + mark user verified |
| `PATCH` | `/:id/reject` | Reject |

---

## 4. Audit logs

Base: `/admin/audit-logs` **new**

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/` | List admin action logs |

### Query

| Param | Notes |
|-------|--------|
| `page`, `limit` | Pagination |
| `adminId` | Filter by admin |
| `resource` | e.g. `user`, `post`, `gift`, `comment` |
| `action` | e.g. `BAN_USER`, `DELETE_POST` |

```json
{
  "data": [
    {
      "id": "...",
      "adminId": "...",
      "action": "DELETE_POST",
      "resource": "post",
      "resource_id": "...",
      "metadata": { "reason": "..." },
      "created_at": "...",
      "admin": { "id": "...", "email": "...", "username": "..." }
    }
  ],
  "pagination": { "page": 1, "limit": 50, "total": 10, "totalPages": 1 }
}
```

---

## 5. Posts & comments (moderation)

**New** — for feed moderation after comments shipped.

### Posts — `/admin/posts`

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/` | List posts (`search`, `userId`, `visibility`, `page`, `limit`) |
| `GET` | `/:id` | Post detail + author + files + counts |
| `DELETE` | `/:id` | Hard-delete post (`reason?`) |

```http
GET /admin/posts?page=1&limit=20&search=spam&visibility=public
DELETE /admin/posts/:id
{ "reason": "Policy violation" }
```

Response list items include `_count.likes` and `_count.comments`.

### Comments — `/admin/comments`

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/` | List comments (`postId`, `userId`, `includeDeleted`, `page`, `limit`) |
| `DELETE` | `/:id` | Soft-delete comment (`reason?`) |

```http
GET /admin/comments?postId=xxx&page=1&limit=20
DELETE /admin/comments/:id
{ "reason": "Harassment" }
```

---

## 6. Gifts catalog

**New** — manage gift store used by `POST /wallet/gifts/send`.

Base: `/admin/gifts`

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/categories` | List categories + gift counts |
| `POST` | `/categories` | Create category |
| `PATCH` | `/categories/:id` | Update category |
| `DELETE` | `/categories/:id` | Delete (only if empty) |
| `GET` | `/` | List gifts (`categoryId`, `search`, `page`, `limit`) |
| `POST` | `/` | Create gift |
| `PATCH` | `/:id` | Update gift |
| `DELETE` | `/:id` | Delete gift |

### Create gift

```json
{
  "name": "Red Rose",
  "gift_category_id": "category-uuid",
  "points": 5,
  "description": "A classic rose",
  "imageId": "file-uuid"
}
```

`imageId` = uploaded file id (from upload API). `points` = coin cost.

---

## 7. Chats

Base: `/admin/chats`

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/` | List chats |
| `GET` | `/statistics` | Global chat/message stats |
| `GET` | `/:chatId/messages` | Messages in a chat |
| `DELETE` | `/messages/:messageId` | Soft or hard delete message |
| `POST` | `/messages/bulk-delete` | Soft-delete many |
| `PATCH` | `/:chatId/archive` | Disable messaging (`can_send_messages: false`) |
| `GET` | `/user/:userId/statistics` | Per-user message stats |

### Delete message body

```json
{ "isHardDelete": false, "reason": "Abuse" }
```

---

## 8. Payments

### Transactions — `/admin/transactions`

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/` | List transactions |
| `GET` | `/duplicates` | Duplicate detection |
| `GET` | `/:id` | Transaction detail |

### Subscriptions — `/admin/subscriptions`

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/` | List subscriptions |
| `GET` | `/:userId` | Subscriptions for one user |

### Refunds — `/admin/refunds`

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/` | List refunds |
| `POST` | `/:transactionId` | Create pending refund record |

> Provider-side refund (Paystack/Flutterwave) is **not** wired yet — DB status only.

### Wallets — `/admin/wallets`

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/:userId` | Wallet + recent transactions |

### Revenue — `/admin/revenue`

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/analytics` | Revenue by period (`daily` / `weekly` / `monthly`) |
| `GET` | `/summary` | Payment summary totals |

---

## 9. Analytics

Base: `/admin/analytics`

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/users` | User growth metrics |
| `GET` | `/users/retention` | Retention / churn |
| `GET` | `/engagement` | Messages / posts / likes / comments |
| `GET` | `/conversion` | Free → paid conversion |
| `GET` | `/panic` | Panic alert metrics |
| `GET` | `/geography` | Users by country |
| `GET` | `/summary` | Combined summary |

Common query params: date range / `groupBy` (see `analytics.dto.ts`).

---

## 10. Notifications

Base: `/admin/notifications`

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/send` | Send to user / segment / all |
| `POST` | `/send-bulk` | Bulk send (currently first user only — incomplete) |
| `GET` | `/templates` | List templates |
| `POST` | `/templates` | Create template |
| `PATCH` | `/templates/:id` | Update template |
| `DELETE` | `/templates/:id` | Delete template |
| `GET` | `/logs` | Delivery logs |
| `GET` | `/stats` | Stats summary |

---

## 11. Support tickets

Base: `/admin/support`

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/tickets` | List tickets |
| `GET` | `/tickets/:id` | Ticket + responses |
| `PATCH` | `/tickets/:id/status` | Update status |
| `PATCH` | `/tickets/:id/priority` | Update priority |
| `PATCH` | `/tickets/:id/assign` | Assign admin |
| `POST` | `/tickets/:id/reply` | Admin reply |
| `PATCH` | `/tickets/:id/close` | Close |
| `GET` | `/statistics` | Ticket stats |

> **Note:** `support_ticket` is not in Prisma schema yet — list/stats may return empty; other mutations can fail until the model is added.

---

## 12. Pagination & errors

Most list endpoints return:

```json
{
  "data": [ ... ],
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

| Status | Meaning |
|--------|---------|
| `400` | Validation / bad input |
| `401` | Missing/invalid JWT |
| `403` | Not admin |
| `404` | Resource not found |
| `409` | Conflict (e.g. duplicate category) |

---

## 13. Known gaps / roadmap

| Area | Status | Suggested next |
|------|--------|----------------|
| Posts / comments moderation | **Added** | Optional “hide” without hard delete |
| Gifts admin CRUD | **Added** | Bulk import from seed JSON |
| Flag / unflag users | **Added** | Report queue from users |
| Audit log API | **Added** | Export CSV |
| Transactions `/duplicates` | **Fixed** (route order) | — |
| Support tickets | API exists, **no DB model** | Add Prisma models + migrate |
| Refunds | Pending record only | Call Paystack/Flutterwave refund APIs |
| Bulk notifications | Incomplete | BullMQ job per user |
| Role scoping | Roles in schema, not on routes | Use `@AdminRole(['finance'])` etc. |
| Admin create-user | Unauthenticated | Lock behind `super_admin` |
| User reports | Missing | `POST` reports + admin queue |
| Emergencies / panic console | Analytics only | List + resolve panic actions |
| Subscription cancel/comp | Missing | Admin cancel / extend |

---

## Quick reference (all bases)

| Area | Base path |
|------|-----------|
| Auth | `/admin/auth` |
| Users | `/admin/users` |
| KYC | `/admin/verifications` |
| Audit | `/admin/audit-logs` |
| Posts | `/admin/posts` |
| Comments | `/admin/comments` |
| Gifts | `/admin/gifts` |
| Chats | `/admin/chats` |
| Transactions | `/admin/transactions` |
| Subscriptions | `/admin/subscriptions` |
| Refunds | `/admin/refunds` |
| Wallets | `/admin/wallets` |
| Revenue | `/admin/revenue` |
| Analytics | `/admin/analytics` |
| Notifications | `/admin/notifications` |
| Support | `/admin/support` |

---

## Frontend wiring tips

1. Store admin JWT separately from user JWT.
2. On `401`/`403`, redirect to admin login.
3. Prefer list + detail screens for **Users**, **Posts**, **Comments**, **Gifts**, **Transactions**.
4. Show `is_flagged` badge on user rows; wire Flag / Unflag actions.
5. After delete post/comment/gift, invalidate the list query.
6. Audit logs page: filter by `resource` + date for compliance.

---

## Related source

- Controllers: `src/modules/admin/controllers/`
- Services: `src/modules/admin/services/`
- DTOs: `src/modules/admin/dtos/`
- Auth: `src/modules/auth/auth.controller.ts` (`AdminAuthController`)
- Guards: `src/common/guards/jwt-auth.guard.ts`, `admin-role.guard.ts`
