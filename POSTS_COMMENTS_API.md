# Post comments API

Backend contract for Zee Love feed / post detail comments (React Native / Expo).

| | |
|--|--|
| **Auth** | `Authorization: Bearer <access_token>` on all routes |
| **Base** | `/posts` |

Related: [FRONTEND_INTEGRATION.md](./FRONTEND_INTEGRATION.md) · [CHAT_API.md](./CHAT_API.md)

---

## Goals (v1)

- Paginated comment list (default **oldest first**)
- Add text comment (1–2000 chars)
- Soft-delete (comment author, post author, or admin)
- Accurate `_count.comments` on feed + post detail
- Notification `type: "comment"` to post author
- Optional one-level `parentId` reply

Realtime socket events are **phase 2** (not required).

---

## Endpoints

### List comments

```http
GET /posts/:postId/comments?page=1&limit=20&order=asc
```

| Param | Default | Notes |
|-------|---------|--------|
| `page` | `1` | |
| `limit` | `20` | Max `50` |
| `order` | `asc` | `asc` = oldest first, `desc` = newest first |

**Rules**

- Must be able to view the post (`public` or friends / owner)
- Soft-deleted comments are omitted
- Includes top-level and one-level replies (`parentId`)

**Response `200`**

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

---

### Create comment

```http
POST /posts/:postId/comments
Content-Type: application/json
```

**Body**

| Field | Required | Notes |
|-------|----------|--------|
| `content` | yes | Trimmed, 1–2000 chars |
| `parentId` | no | Reply to another comment (max depth 1) |

```json
{
  "content": "Great photo!",
  "parentId": null
}
```

**Response `201`**

```json
{
  "message": "Comment added",
  "data": {
    "id": "comment-uuid",
    "postId": "post-uuid",
    "content": "Great photo!",
    "userId": "user-uuid",
    "parentId": null,
    "created_at": "2026-03-20T10:05:00.000Z",
    "updated_at": "2026-03-20T10:05:00.000Z",
    "user": {
      "id": "user-uuid",
      "username": "jane",
      "first_name": "Jane",
      "last_name": "Doe",
      "profile_picture": { "url": "https://..." }
    }
  }
}
```

**Side effects**

- `_count.comments` increases (non-deleted only)
- If commenter ≠ post author → in-app + push notification:

```json
{
  "type": "comment",
  "title": "New comment",
  "body": "@jane commented on your post",
  "userId": "post-author-uuid",
  "metadata": {
    "postId": "post-uuid",
    "commentId": "comment-uuid",
    "actorUserId": "commenter-uuid"
  }
}
```

---

### Delete comment

```http
DELETE /posts/:postId/comments/:commentId
```

**Allowed:** comment author · post author · admin  

Soft-delete: sets `deleted_at`, clears `content`.

**Response `200`**

```json
{ "message": "Comment deleted" }
```

---

### Post counts on feed / detail

`GET /posts/` and `GET /posts/:id` include:

```json
"_count": {
  "likes": 10,
  "comments": 5,
  "files": 1
}
```

Only non-deleted comments are counted. Map to `Post.commentsCount` via `_count.comments`.

---

## Validation

| Case | Status |
|------|--------|
| Cannot view post (friends-only) | `403` |
| Empty / whitespace content | `400` |
| Content > 2000 chars | `400` |
| Missing post | `404` |
| Delete someone else’s comment (not post author/admin) | `403` |
| `parentId` on wrong post / missing | `400` |
| Reply depth > 1 | `400` |
| Unauthenticated | `401` |

---

## Suggested mobile usage

```ts
commentsApi.getComments(postId, { page, limit, order: 'asc' })
commentsApi.createComment(postId, { content, parentId? })
commentsApi.deleteComment(postId, commentId)
```

```ts
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

After create/delete: invalidate `['post', postId]` and feed queries.  
On notification `type === 'comment'`: navigate to post (optionally scroll to `metadata.commentId`).

---

## Acceptance

- [x] `GET /posts/:postId/comments` paginated + author profile  
- [x] `POST /posts/:postId/comments` returns full object (`201`)  
- [x] `DELETE /posts/:postId/comments/:commentId` soft-deletes  
- [x] `GET /posts/` and `GET /posts/:id` return `_count.comments`  
- [x] Visibility enforced  
- [x] Comment notification to post author  
- [x] Auth required  

---

## Test flow

1. A creates a public post  
2. B fetches post → `_count.comments: 0`  
3. B posts `"Love this!"` → `201`, count `1`  
4. A lists comments → sees B + avatar  
5. A gets `comment` notification  
6. B deletes comment → count `0`  
7. Feed refresh shows updated count  

---

## Backend source

- `src/modules/posts/posts.controller.ts`
- `src/modules/posts/posts.service.ts`
- `src/modules/posts/posts.dto.ts` (`createCommentDto`)
- Prisma `comment` model (`parentId`, `deleted_at`)
