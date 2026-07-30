# Posts module

| Doc | Topic |
|-----|--------|
| [POSTS_COMMENTS_API.md](../../POSTS_COMMENTS_API.md) | Comments |
| [VIDEO_API.md](../../VIDEO_API.md) | Video upload + TikTok-style feed |

### Quick reference

| Method | Path | Notes |
|--------|------|--------|
| `POST` | `/upload` | Images + videos (auth, max 80MB) |
| `POST` | `/posts` | Create (caption optional if `files` set) |
| `GET` | `/posts/videos` | Vertical video feed |
| `GET` | `/posts/:id/comments` | Paginated comments |
| `POST` | `/posts/:id/comments` | Create comment |
| `DELETE` | `/posts/:id/comments/:commentId` | Soft-delete |
| `GET` | `/posts/` · `/posts/:id` | Includes `_count.comments`, file `type` |
