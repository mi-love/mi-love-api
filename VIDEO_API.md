# Video API & TikTok-style feed

Frontend / mobile contract for Zee Love video posts: background upload, create, and vertical “For You” feed.

| | |
|--|--|
| **Auth** | `Authorization: Bearer <access_token>` on all routes |
| **Upload** | `POST /upload` (multipart) — videos run in a **background queue** |
| **Job status** | `GET /upload/jobs/:jobId` |
| **Create** | `POST /posts` |
| **Video feed** | `GET /posts/videos` |

Related: [POSTS_COMMENTS_API.md](./POSTS_COMMENTS_API.md) · [FRONTEND_INTEGRATION.md](./FRONTEND_INTEGRATION.md)

---

## Table of contents

1. [End-to-end flow](#1-end-to-end-flow)
2. [Upload media](#2-upload-media)
3. [Background video jobs](#3-background-video-jobs)
4. [Create a video post](#4-create-a-video-post)
5. [TikTok-style video feed](#5-tiktok-style-video-feed)
6. [Feed & post detail media fields](#6-feed--post-detail-media-fields)
7. [Likes & comments](#7-likes--comments)
8. [Validation & errors](#8-validation--errors)
9. [Mobile integration](#9-mobile-integration)
10. [Acceptance checklist](#10-acceptance-checklist)

---

## 1. End-to-end flow

Videos are **not** uploaded to Cloudinary on the HTTP request thread. They are staged to disk and processed by a Bull worker (`video-uploads` queue).

```
1. POST /upload                 → video staged → { mode: "async", jobs: [{ id }] }
2. GET  /upload/jobs/:jobId     → poll until status === "completed" → file.id
3. POST /posts                  → { files: [file.id], content?, visibility? }
4. GET  /posts/videos           → vertical For You feed
```

Images still upload **synchronously** in the same `POST /upload` call (`data[]`).

**Infra:** Redis (`REDIS_HOST` / `REDIS_PORT` / `REDIS_PASSWORD`). If Redis is unavailable, the API falls back to in-process background processing.

---

## 2. Upload media

```http
POST /upload
Content-Type: multipart/form-data
Authorization: Bearer <access_token>
```

| Form field | Notes |
|------------|--------|
| `file` | Single file |
| `files` | Up to **5** files |

### Allowed types

| Kind | MIME / formats | Processing |
|------|----------------|------------|
| Images | jpeg, png, gif, webp, heic | Sync → `data[]` |
| Videos | **mp4**, mov (`video/quicktime`), webm | Async queue → `jobs[]` |

**Max size:** 80 MB per file (disk-staged)

### Response — video only (`mode: "async"`)

```json
{
  "message": "Video upload queued",
  "mode": "async",
  "data": [],
  "jobs": [
    {
      "id": "job-uuid",
      "status": "queued",
      "originalName": "clip.mp4",
      "mimeType": "video/mp4",
      "sizeBytes": 12400512,
      "progress": 0
    }
  ]
}
```

### Response — images only (`mode: "sync"`)

```json
{
  "message": "Upload successful",
  "mode": "sync",
  "data": [
    {
      "id": "file-uuid",
      "provider": "cloudinary",
      "url": "https://res.cloudinary.com/.../image/upload/.../photo.jpg",
      "type": "image",
      "thumbnailUrl": null
    }
  ],
  "jobs": []
}
```

### Response — mixed (`mode: "mixed"`)

Images land in `data[]`; videos land in `jobs[]`. Poll jobs for video `file.id` before creating the post.

---

## 3. Background video jobs

### Poll one job

```http
GET /upload/jobs/:jobId
```

```json
{
  "id": "job-uuid",
  "status": "completed",
  "progress": 100,
  "originalName": "clip.mp4",
  "mimeType": "video/mp4",
  "sizeBytes": 12400512,
  "error": null,
  "created_at": "2026-07-30T18:00:00.000Z",
  "updated_at": "2026-07-30T18:00:12.000Z",
  "completed_at": "2026-07-30T18:00:12.000Z",
  "file": {
    "id": "file-uuid",
    "provider": "cloudinary",
    "url": "https://res.cloudinary.com/.../video/upload/.../clip.mp4",
    "type": "video",
    "thumbnailUrl": "https://res.cloudinary.com/.../video/upload/so_0/.../clip.jpg"
  }
}
```

| `status` | Meaning |
|----------|---------|
| `queued` | Waiting for worker |
| `processing` | Uploading to Cloudinary |
| `completed` | Ready — use `file.id` in `POST /posts` |
| `failed` | See `error`; optionally retry |

Suggested poll interval: **1–2s** until `completed` or `failed`.

### List jobs

```http
GET /upload/jobs
GET /upload/jobs?status=processing
```

### Retry failed job

```http
POST /upload/jobs/:jobId/retry
```

Only works if the staged temp file is still on the server.

---

## 4. Create a video post

```http
POST /posts
Content-Type: application/json
Authorization: Bearer <access_token>
```

```json
{
  "content": "Sunset vibes",
  "visibility": "public",
  "files": ["file-uuid"]
}
```

| Field | Required | Notes |
|-------|----------|--------|
| `files` | for video posts | **Completed** job `file.id` (not the job id) |
| `content` | if no files | Caption; **optional** when media is attached |
| `visibility` | no | Default `public` (`friends` also allowed) |

### Response (includes media)

```json
{
  "message": "Post created successfully",
  "data": {
    "id": "post-uuid",
    "content": "Sunset vibes",
    "visibility": "public",
    "files": [
      {
        "id": "file-uuid",
        "url": "https://...mp4",
        "type": "video",
        "provider": "cloudinary",
        "thumbnailUrl": "https://...jpg"
      }
    ],
    "likedByMe": false,
    "_count": {
      "likes": 0,
      "comments": 0,
      "files": 1
    },
    "user": { "...": "author" }
  }
}
```

Rules:

- Must have **content** or **at least one file**
- Unknown file IDs → `400`
- Do **not** pass `job.id` into `files` — wait for `file.id`

---

## 5. TikTok-style video feed

Vertical “For You” list: only posts that include **at least one video**. Newest first. Respects visibility (`public` + friends).

```http
GET /posts/videos?page=1&limit=10
GET /posts/videos?cursor=<lastPostId>&limit=10
```

| Param | Default | Notes |
|-------|---------|--------|
| `page` | `1` | Ignored when `cursor` is set |
| `limit` | `10` | Max `20` |
| `cursor` | — | Last item `id` from previous page (infinite scroll) |

### Response `200`

```json
{
  "data": [
    {
      "id": "post-uuid",
      "content": "Sunset vibes",
      "visibility": "public",
      "created_at": "2026-07-30T12:00:00.000Z",
      "user": {
        "id": "user-uuid",
        "username": "jane",
        "first_name": "Jane",
        "last_name": "Doe",
        "profile_picture": { "url": "https://..." }
      },
      "files": [
        {
          "id": "file-uuid",
          "url": "https://...mp4",
          "type": "video",
          "provider": "cloudinary",
          "thumbnailUrl": "https://...jpg"
        }
      ],
      "video": {
        "id": "file-uuid",
        "url": "https://...mp4",
        "type": "video",
        "thumbnailUrl": "https://...jpg"
      },
      "likedByMe": false,
      "_count": {
        "likes": 12,
        "comments": 3,
        "files": 1
      }
    }
  ],
  "meta": {
    "totalPages": 5,
    "currentPage": 1,
    "itemsPerPage": 10,
    "totalItems": 48,
    "nextCursor": "last-post-id-or-null"
  }
}
```

### Infinite scroll

1. First load: `GET /posts/videos?limit=10`
2. Next page: `GET /posts/videos?cursor=<meta.nextCursor>&limit=10`
3. Stop when `meta.nextCursor` is `null`

Prefer **`video.url`** for the player and **`video.thumbnailUrl`** as the poster.

---

## 6. Feed & post detail media fields

`GET /posts/` and `GET /posts/:id` also return typed media (`type`, `thumbnailUrl`) plus `likedByMe` and `_count`.

---

## 7. Likes & comments

| Action | Method | Path |
|--------|--------|------|
| Like | `POST` | `/posts/:id/like` |
| Unlike | `POST` | `/posts/:id/unlike` |
| List comments | `GET` | `/posts/:id/comments` |
| Add comment | `POST` | `/posts/:id/comments` |
| Delete comment | `DELETE` | `/posts/:id/comments/:commentId` |

See [POSTS_COMMENTS_API.md](./POSTS_COMMENTS_API.md).

---

## 8. Validation & errors

| Case | Status |
|------|--------|
| Missing / invalid auth | `401` |
| Non-image / non-video MIME | `400` Invalid file type |
| File larger than 80 MB | `400` (multer limit) |
| Unknown file id on create | `400` |
| Empty post (no content, no files) | `400` |
| Upload job not found / not yours | `404` / `403` |
| Retry non-failed job | `400` |
| Cannot view friends-only post | `403` |

---

## 9. Mobile integration

### Suggested API surface

```ts
// 1) upload — videos return jobs
const res = await uploadApi.uploadMedia(formData)
// res.mode: 'sync' | 'async' | 'mixed'

// 2) poll until completed
const job = await uploadApi.getJob(jobId)
// job.status === 'completed' → job.file.id

// 3) create post
await postsApi.createPost({ files: [job.file.id], content })

// 4) feed
await postsApi.getVideoFeed({ cursor })
```

### Polling helper (example)

```ts
async function waitForVideoFile(jobId: string, signal?: AbortSignal) {
  for (;;) {
    if (signal?.aborted) throw new Error('aborted');
    const job = await uploadApi.getJob(jobId);
    if (job.status === 'completed' && job.file) return job.file;
    if (job.status === 'failed') throw new Error(job.error || 'Upload failed');
    await new Promise((r) => setTimeout(r, 1500));
  }
}
```

### Suggested types

```ts
type UploadJobStatus = 'queued' | 'processing' | 'completed' | 'failed';

interface UploadJob {
  id: string;
  status: UploadJobStatus;
  progress: number;
  originalName: string | null;
  error: string | null;
  file: MediaFile | null;
}

interface MediaFile {
  id: string;
  url: string;
  type: 'image' | 'video' | 'document';
  provider: string;
  thumbnailUrl: string | null;
}
```

### UI tips

- Show upload progress from `job.progress` (0–100)
- Only enable “Post” after `status === 'completed'`
- Vertical pager on `GET /posts/videos`; autoplay visible item
- Use `thumbnailUrl` as poster until the player is ready

---

## 10. Acceptance checklist

- [x] Videos staged to disk and processed by Bull `video-uploads` worker
- [x] `POST /upload` returns `jobs[]` for videos (`mode: async|mixed`)
- [x] `GET /upload/jobs/:jobId` returns status + `file` when done
- [x] Images still sync via `data[]`
- [x] Fallback in-process processing if Redis/Bull fails
- [x] `POST /posts` + `GET /posts/videos` unchanged once `file.id` exists

### Example test flow

1. `POST /upload` with mp4 → `jobs[0].id`
2. Poll `GET /upload/jobs/:id` until `completed`
3. `POST /posts` with `files: [file.id]`
4. `GET /posts/videos` → post appears with `video.url`

---

## Backend source

| Path | Role |
|------|------|
| `src/modules/upload/upload.service.ts` | Stage + enqueue |
| `src/modules/upload/video-upload.processor.ts` | Cloudinary upload worker logic |
| `src/queue/consumers/video-upload.consumer.ts` | Bull consumer |
| `src/modules/upload/upload.controller.ts` | REST endpoints |
| `prisma` `upload_job` model | Job persistence |
