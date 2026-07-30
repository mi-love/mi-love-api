# Post comments

API for post comments on the Zee Love feed / post detail screens.

---

## Endpoints

### List comments

```http
GET /posts/:postId/comments?page=1&limit=20&order=asc
Authorization: Bearer <token>
```

| Param | Default | Notes |
|-------|---------|--------|
| `page` | 1 | |
| `limit` | 20 | Max 50 |
| `order` | `asc` | Oldest first (recommended for threads) |

**Response:**

```json
{
  "data": [
    {
      "id": "comment-uuid",
      "postId": "post-uuid",
      "content": "Nice post!",
      "userId": "user-uuid",
      "parentId": null,
      "created_at": "2026-03-20T10:00:00.000Z",
      "updated_at": "2026-03-20T10:00:00.000Z",
      "user": {
        "id": "user-uuid",
        "username": "jane",
        "first_name": "Jane",
        "last_name": "Doe",
        "profile_picture": { "url": "https://..." }
      }
    }
  ],
  "meta": {
    "totalPages": 1,
    "currentPage": 1,
    "itemsPerPage": 20,
    "totalItems": 5
  }
}
```

### Create comment

```http
POST /posts/:postId/comments
```

```json
{
  "content": "Great photo!",
  "parentId": null
}
```

- `content`: required, trimmed, 1–2000 chars
- `parentId`: optional (one-level reply only)

**Response (201):**

```json
{
  "message": "Comment added",
  "data": { "...": "full comment object with user" }
}
```

Side effects:

- Increments `_count.comments` on the post
- Notifies post author (`type: "comment"`) unless self-comment

### Delete comment

```http
DELETE /posts/:postId/comments/:commentId
```

Allowed: comment author **or** post author. Soft-deletes (`deleted_at`).

```json
{ "message": "Comment deleted" }
```

---

## Post `_count.comments`

`GET /posts/` and `GET /posts/:id` include:

```json
"_count": {
  "likes": 12,
  "comments": 5,
  "files": 1
}
```

Only non-deleted comments are counted. Friends-only visibility is enforced on list/detail/comment endpoints.

---

## Notification

When user B comments on user A's post:

```json
{
  "type": "comment",
  "title": "New comment",
  "body": "@jane commented on your post",
  "metadata": {
    "postId": "post-uuid",
    "commentId": "comment-uuid",
    "actorUserId": "commenter-uuid"
  }
}
```

---

## Validation

| Case | Expected |
|------|----------|
| Comment on post user cannot see | 403 |
| Empty / whitespace content | 400 |
| Content > 2000 chars | 400 |
| Comment on missing post | 404 |
| Delete someone else's comment | 403 (unless post author) |
| Reply depth > 1 | 400 |

---

## Migration

```bash
npx prisma migrate deploy
```
