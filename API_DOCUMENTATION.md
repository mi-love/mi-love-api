# Mi-Love API — Full API Documentation

**Base URL:** `http://localhost:9999` (or your deployed URL)  
**API docs (Swagger):** `http://localhost:9999/docs`  
**Socket.IO:** [SOCKET_API.md](SOCKET_API.md) · **Push & route index:** [SOCKET_AND_PUSH_API.md](SOCKET_AND_PUSH_API.md)

Authentication for protected routes: send a valid JWT in the `Authorization` header:

```http
Authorization: Bearer <access_token>
```

---

## Table of Contents

1. [Auth](#1-auth)
2. [Profile](#2-profile)
3. [Posts](#3-posts)
4. [Friends](#4-friends)
5. [Chats](#5-chats)
6. [Status](#6-status)
7. [Wallet](#7-wallet)
8. [Upload](#8-upload)
9. [Notifications](#9-notifications)
10. [Emergencies](#10-emergencies)
11. [Streams](#11-streams)

**Socket.IO:** [SOCKET_API.md](SOCKET_API.md) · **Expo push & full route index:** [SOCKET_AND_PUSH_API.md](SOCKET_AND_PUSH_API.md)

---

## 1. Auth

**Prefix:** `/auth`  
**Auth required:** No (except OAuth callbacks are used by the provider)

### POST `/auth/login`

Email/password login.

**Request body:**

| Field    | Type   | Required | Description |
| -------- | ------ | -------- | ----------- |
| email    | string | Yes      | User email  |
| password | string | Yes      | User password |

**Request payload (example):**

```json
{
  "email": "user@example.com",
  "password": "your_password"
}
```

**Response (200):**

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

---

### POST `/auth/signup`

Register a new user. Requires a valid one-time JWT from OTP verification.

**Request body (SignupDto):**

| Field             | Type     | Required | Description                    |
| ----------------- | -------- | -------- | ------------------------------ |
| email             | string   | Yes      | Valid email                    |
| password          | string   | Yes      | Password                       |
| first_name        | string   | Yes      | First name                     |
| last_name         | string   | Yes      | Last name                      |
| username          | string   | Yes      | Unique username                |
| token             | string   | Yes      | JWT from verify-otp            |
| emergency_contact | string   | Yes      | Emergency contact              |
| bio               | string   | Yes      | User bio                       |
| profile_picture   | string   | Yes      | Profile picture (e.g. file ID) |
| home_address      | string   | Yes      | Home address                   |
| interests         | string[] | Yes      | Array of interest names/IDs    |
| phone_number      | string   | Yes      | Phone number                   |
| country           | string   | Yes      | Country                        |
| gender            | string   | Yes      | `"male"` \| `"female"` \| `"other"` |
| date_of_birth     | string   | Yes      | ISO 8601 date (e.g. YYYY-MM-DD) |

**Request payload (example):**

```json
{
  "email": "user@example.com",
  "password": "securePassword123",
  "first_name": "Jane",
  "last_name": "Doe",
  "username": "janedoe",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "emergency_contact": "+1234567890",
  "bio": "Hello world",
  "profile_picture": "clxx123fileid",
  "home_address": "123 Main St",
  "interests": ["music", "travel"],
  "phone_number": "+1234567890",
  "country": "Nigeria",
  "gender": "female",
  "date_of_birth": "1995-05-15"
}
```

**Response (200):**

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

---

### POST `/auth/send-otp`

Send OTP to email (e.g. for signup or password reset).

**Request body (SendOtpDto):**

| Field        | Type    | Required | Description                                      |
| ------------ | ------- | -------- | ------------------------------------------------ |
| email        | string  | Yes      | Valid email                                      |
| check_exists | boolean | Yes      | If `true`, returns error when user already exists |

**Request payload (example):**

```json
{
  "email": "user@example.com",
  "check_exists": true
}
```

**Response (200):**

```json
{
  "message": "OTP sent to your email"
}
```

---

### POST `/auth/forgot-password`

Request password reset (sends OTP to email).

**Request body (ForgotPasswordDto):**

| Field | Type   | Required | Description |
| ----- | ------ | -------- | ----------- |
| email | string | Yes      | User email  |

**Request payload (example):**

```json
{
  "email": "user@example.com"
}
```

**Response (200):**

```json
{
  "message": "OTP sent to your email"
}
```

---

### POST `/auth/verify-otp`

Verify OTP for email.

**Request body (VerifyOtpDto):**

| Field | Type   | Required | Description                          |
| ----- | ------ | -------- | ------------------------------------ |
| email | string | Yes      | Email that received the OTP          |
| otp   | string | Yes      | OTP code                             |
| type  | string | Yes      | `"reset"` \| `"verify"` (reset or verify) |

**Request payload (example):**

```json
{
  "email": "user@example.com",
  "otp": "123456",
  "type": "verify"
}
```

**Response (200):**

```json
{
  "message": "OTP verified successfully",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

---

### POST `/auth/reset-password`

Reset password using token and OTP.

**Request body (ResetPasswordDto):**

| Field    | Type   | Required | Description        |
| -------- | ------ | -------- | ------------------ |
| token    | string | Yes      | JWT from verify-otp |
| otp      | string | Yes      | OTP code           |
| password | string | Yes      | New password       |

**Request payload (example):**

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "otp": "123456",
  "password": "newSecurePassword123"
}
```

**Response (200):**

```json
{
  "message": "Password reset successfully"
}
```

---

### GET `/auth/google`

Initiates Google OAuth. Redirects user to Google consent screen.

**Response:** Redirect to Google.

---

### GET `/auth/google/callback`

Google OAuth callback. Exchanges code for token and redirects to app with token in URL.

**Response:** Redirect to `{EXPO_SCHEME}/auth/login?token={access_token}`

---

### GET `/auth/apple`

Initiates Apple OAuth.

**Response:** Redirect to Apple.

---

### GET `/auth/apple/callback`

Apple OAuth callback.

**Response:** Redirect to `{EXPO_SCHEME}/auth/login?token={access_token}`

---

## 2. Profile

**Prefix:** `/profile`  
**Auth required:** Yes (JWT)

### GET `/profile/me`

Get current user's profile.

**Headers:** `Authorization: Bearer <token>`

**Request payload:** None (GET, no body).

**Response (200):**

```json
{
  "data": {
    "id": "clxx...",
    "email": "user@example.com",
    "first_name": "Jane",
    "last_name": "Doe",
    "username": "janedoe",
    "emergency_contact": "+1234567890",
    "bio": "Hello world",
    "home_address": "123 Main St",
    "phone_number": "+1234567890",
    "country": "Nigeria",
    "gender": "female",
    "date_of_birth": "1995-05-15T00:00:00.000Z",
    "fcm_token": null,
    "fileId": "clxx...",
    "walletId": "clxx...",
    "auth_provider": "local",
    "created_at": "2024-01-01T00:00:00.000Z",
    "updated_at": "2024-01-01T00:00:00.000Z"
  }
}
```

---

### GET `/profile/:id`

Get another user's profile by ID.

**Headers:** `Authorization: Bearer <token>`  
**Params:** `id` — user ID (cuid)

**Request payload:** None (GET, no body).

**Response (200):**

```json
{
  "message": "Profile fetched successfully",
  "data": {
    "id": "clxx...",
    "email": "user@example.com",
    "first_name": "Jane",
    "last_name": "Doe",
    "username": "janedoe",
    "emergency_contact": "+1234567890",
    "bio": "Hello world",
    "home_address": "123 Main St",
    "phone_number": "+1234567890",
    "country": "Nigeria",
    "gender": "female",
    "date_of_birth": "1995-05-15T00:00:00.000Z",
    "fileId": "clxx...",
    "walletId": "clxx...",
    "created_at": "2024-01-01T00:00:00.000Z",
    "updated_at": "2024-01-01T00:00:00.000Z",
    "profile_picture": { "id": "clxx...", "url": "https://...", "provider": "cloudinary" },
    "interests": [{ "id": "clxx...", "name": "music" }],
    "posts": [],
    "friends": [],
    "my_friends": []
  }
}
```

---

### PUT `/profile/me`

Update current user's profile.

**Headers:** `Authorization: Bearer <token>`

**Request body (EditProfileDto)** — all fields optional:

| Field              | Type     | Description              |
| ------------------ | -------- | ------------------------ |
| first_name         | string   | First name               |
| last_name          | string   | Last name                |
| username           | string   | Username                 |
| country            | string   | Country                  |
| phone_number       | string   | Phone number             |
| profile_picture_id | string   | File ID for profile pic  |
| emergency_contact  | string   | Emergency contact         |
| date_of_birth      | string   | ISO 8601 date             |
| home_address       | string   | Home address             |
| bio                | string   | Bio                      |
| added_interests    | string[] | Interest IDs/names to add |
| removed_interests  | string[] | Interest IDs/names to remove |

**Request payload (example):**

```json
{
  "first_name": "Jane",
  "last_name": "Doe",
  "username": "janedoe",
  "country": "Nigeria",
  "phone_number": "+1234567890",
  "profile_picture_id": "clxxfileid",
  "emergency_contact": "+1234567890",
  "date_of_birth": "1995-05-15",
  "home_address": "123 Main St",
  "bio": "Updated bio",
  "added_interests": ["reading"],
  "removed_interests": ["gaming"]
}
```

**Response (200):**

```json
{
  "message": "Profile updated successfully"
}
```

---

### POST `/profile/save-fcm`

Save FCM token for push notifications.

**Headers:** `Authorization: Bearer <token>`

**Request body (fcmDto):**

| Field    | Type   | Required | Description   |
| -------- | ------ | -------- | ------------- |
| fcmToken | string | No       | FCM device token |

**Request payload (example):**

```json
{
  "fcmToken": "ExponentPushToken[xxxxxx]"
}
```

**Response (200):**

```json
{
  "message": "FCM token saved successfully"
}
```

---

### POST `/profile/delete`

Delete current user account.

**Headers:** `Authorization: Bearer <token>`

**Request body (DeleteProfileDto):**

| Field    | Type   | Required | Description        |
| -------- | ------ | -------- | ------------------ |
| password | string | Yes      | Current password   |
| token    | string | Yes      | Valid JWT (confirmation) |

**Request payload (example):**

```json
{
  "password": "currentPassword",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response (200):**

```json
{
  "message": "Profile deleted successfully"
}
```

---

## 3. Posts

**Prefix:** `/posts`  
**Auth required:** Yes (JWT)

### GET `/posts/`

List posts with filters and pagination.

**Headers:** `Authorization: Bearer <token>`

**Query (getPostsDto):**

| Field       | Type   | Description                          |
| ----------- | ------ | ------------------------------------ |
| filterValue | string | Search/filter value                   |
| filterBy    | string | `"all"` \| `"my"` \| `"liked"`       |
| limit       | number | Page size                            |
| page        | number | Page number                          |
| order       | string | `"desc"` \| `"asc"`                  |

**Request payload:** Query params only, e.g. `?filterBy=all&filterValue=&limit=10&page=1&order=desc`. No body.

**Response (200):**

```json
{
  "posts": [
    {
      "id": "clxx...",
      "content": "Post content",
      "visibility": "public",
      "userId": "clxx...",
      "created_at": "2024-01-01T00:00:00.000Z",
      "updated_at": "2024-01-01T00:00:00.000Z",
      "user": {
        "id": "clxx...",
        "email": "user@example.com",
        "first_name": "Jane",
        "last_name": "Doe",
        "username": "janedoe",
        "profile_picture": { "url": "https://...", "provider": "cloudinary" }
      },
      "files": [{ "url": "https://...", "provider": "cloudinary" }],
      "_count": { "files": 1, "likes": 5 }
    }
  ],
  "meta": {
    "totalPages": 5,
    "currentPage": 1,
    "itemsPerPage": 10,
    "totalItems": 42
  }
}
```

---

### GET `/posts/:id`

Get a single post by ID.

**Headers:** `Authorization: Bearer <token>`  
**Params:** `id` — post ID

**Request payload:** None (GET, no body).

**Response (200):**

```json
{
  "data": {
    "id": "clxx...",
    "content": "Post content",
    "visibility": "public",
    "userId": "clxx...",
    "created_at": "2024-01-01T00:00:00.000Z",
    "updated_at": "2024-01-01T00:00:00.000Z",
    "user": {
      "id": "clxx...",
      "first_name": "Jane",
      "last_name": "Doe",
      "username": "janedoe",
      "profile_picture": { "id": "clxx...", "url": "https://...", "provider": "cloudinary" }
    },
    "files": [{ "url": "https://...", "provider": "cloudinary" }],
    "_count": { "files": 1, "likes": 5 }
  }
}
```

---

### POST `/posts/`

Create a post.

**Headers:** `Authorization: Bearer <token>`

**Request body (createPostDto):**

| Field      | Type   | Required | Description                    |
| ---------- | ------ | -------- | ------------------------------ |
| content    | string | Yes      | Post text content              |
| visibility | string | Yes      | `"public"` \| `"friends"`      |
| files      | string[] | No     | Array of file IDs              |

**Request payload (example):**

```json
{
  "content": "Hello, this is my post!",
  "visibility": "public",
  "files": ["clxxfileid1", "clxxfileid2"]
}
```

**Response (200):**

```json
{
  "message": "Post created successfully",
  "data": { "id": "clxx..." }
}
```

---

### PUT `/posts/:id`

Update a post (owner only).

**Headers:** `Authorization: Bearer <token>`  
**Params:** `id` — post ID

**Request body (updatePostDto):**

| Field      | Type   | Required | Description               |
| ---------- | ------ | -------- | ------------------------- |
| content    | string | No       | New content                |
| visibility | string | No       | `"public"` \| `"friends"`  |

**Request payload (example):**

```json
{
  "content": "Updated post content",
  "visibility": "friends"
}
```

**Response (200):**

```json
{
  "message": "Post updated successfully"
}
```

---

### DELETE `/posts/:id`

Delete a post (owner only).

**Headers:** `Authorization: Bearer <token>`  
**Params:** `id` — post ID

**Request payload:** None (DELETE, no body).

**Response (200):**

```json
{
  "message": "Post deleted"
}
```

---

### POST `/posts/:id/like`

Like a post.

**Headers:** `Authorization: Bearer <token>`  
**Params:** `id` — post ID

**Request payload:** None (POST, no body).

**Response (200):**

```json
{
  "message": "Post liked successfully"
}
```

---

### POST `/posts/:id/unlike`

Remove like from a post.

**Headers:** `Authorization: Bearer <token>`  
**Params:** `id` — post ID

**Request payload:** None (POST, no body).

**Response (200):**

```json
{
  "message": "Post unliked successfully"
}
```

---

### GET `/posts/:id/likes`

Get paginated list of users who liked the post.

**Headers:** `Authorization: Bearer <token>`  
**Params:** `id` — post ID

**Query (PaginationParams):**

| Field | Type   | Description   |
| ----- | ------ | ------------- |
| page  | number | Page number   |
| limit | number | Items per page |

**Request payload:** Query params only, e.g. `?page=1&limit=20`. No body.

**Response (200):**

```json
{
  "data": [
    {
      "id": "clxx...",
      "email": "user@example.com",
      "first_name": "Jane",
      "last_name": "Doe",
      "username": "janedoe",
      "profile_picture": { "url": "https://...", "provider": "cloudinary" }
    }
  ],
  "meta": {
    "totalPages": 2,
    "currentPage": 1,
    "itemsPerPage": 20,
    "totalItems": 25
  }
}
```

---

## 4. Friends

**Prefix:** `/friends`  
**Auth required:** Yes (JWT)

### GET `/friends`

List friends with filters and pagination.

**Headers:** `Authorization: Bearer <token>`

**Query (listFriendsDto):**

| Field       | Type   | Description                        |
| ----------- | ------ | ---------------------------------- |
| filterValue | string | Search value                        |
| filterBy    | string | `"blocked"` \| `"friends"` \| `"explore"` — explore lists **all** other users (not only non-friends); each user includes `isFriend`, and the response includes `hasFriends` |
| limit       | number | Page size                           |
| page        | number | Page number                         |
| order       | string | `"desc"` \| `"asc"`                 |

**Request payload:** Query params only, e.g. `?filterBy=friends&filterValue=&limit=10&page=1&order=desc`. No body.

**Response (200) — when filterBy=friends:**

```json
{
  "message": "Friends List",
  "data": [
    {
      "id": "clxx...",
      "email": "friend@example.com",
      "first_name": "John",
      "last_name": "Doe",
      "username": "johndoe",
      "created_at": "2024-01-01T00:00:00.000Z",
      "profile_picture": { "url": "https://...", "provider": "cloudinary" }
    }
  ],
  "meta": {
    "totalPages": 1,
    "currentPage": 1,
    "itemsPerPage": 10,
    "totalItems": 3
  }
}
```

**Response (200) — when filterBy=blocked:** `{ "message": "Blocked Users", "data": [...], "meta": {...} }`  
**Response (200) — when filterBy=explore:** All users except the authenticated user. Each item includes `isFriend` (whether they are in your friends list). `hasFriends` is `true` if you have at least one friend.

```json
{
  "message": "Explore Users",
  "data": [
    {
      "id": "clxx...",
      "email": "user@example.com",
      "first_name": "Jane",
      "last_name": "Doe",
      "username": "janedoe",
      "isFriend": false,
      "profile_picture": { "url": "https://...", "provider": "cloudinary" }
    }
  ],
  "hasFriends": true,
  "meta": {
    "totalPages": 5,
    "currentPage": 1,
    "itemsPerPage": 20,
    "totalItems": 100
  }
}
```

---

### POST `/friends`

Send or accept friend request.

**Headers:** `Authorization: Bearer <token>`

**Request body (addFriendDto):**

| Field    | Type   | Required | Description   |
| -------- | ------ | -------- | ------------- |
| friendId | string | Yes      | Target user ID |

**Request payload (example):**

```json
{
  "friendId": "clxxuserid"
}
```

**Response (200):** Success message from service (e.g. friend added).

---

### POST `/friends/unfriend`

Remove friend.

**Headers:** `Authorization: Bearer <token>`

**Request body (unblockFriendDto):**

| Field    | Type   | Required | Description   |
| -------- | ------ | -------- | ------------- |
| friendId | string | Yes      | User ID to unfriend |

**Request payload (example):**

```json
{
  "friendId": "clxxuserid"
}
```

**Response (200):** Success message.

---

### POST `/friends/block`

Block a user.

**Headers:** `Authorization: Bearer <token>`

**Request body (blockFriendDto):**

| Field    | Type   | Required | Description   |
| -------- | ------ | -------- | ------------- |
| friendId | string | Yes      | User ID to block |
| reason   | string | Yes      | Block reason  |

**Request payload (example):**

```json
{
  "friendId": "clxxuserid",
  "reason": "Spam"
}
```

**Response (200):** Success message.

---

### POST `/friends/unblock`

Unblock a user.

**Headers:** `Authorization: Bearer <token>`

**Request body (unblockFriendDto):**

| Field    | Type   | Required | Description    |
| -------- | ------ | -------- | -------------- |
| friendId | string | Yes      | User ID to unblock |

**Request payload (example):**

```json
{
  "friendId": "clxxuserid"
}
```

**Response (200):** Success message.

---

## 5. Chats

**Prefix:** `/chats`  
**Auth required:** Yes (JWT)

### GET `/chats`

Get current user's chat list (paginated).

**Headers:** `Authorization: Bearer <token>`

**Query:**

| Field | Type   | Default | Description   |
| ----- | ------ | ------- | ------------- |
| page  | string | "1"     | Page number   |
| limit | string | "10"    | Items per page |

**Request payload:** Query params only, e.g. `?page=1&limit=10`. No body.

**Response (200):**

```json
{
  "data": [
    {
      "id": "clxx...",
      "can_send_messages": true,
      "created_at": "2024-01-01T00:00:00.000Z",
      "updated_at": "2024-01-01T00:00:00.000Z",
      "participants": [
        {
          "user": {
            "id": "clxx...",
            "username": "johndoe",
            "first_name": "John",
            "last_name": "Doe",
            "profile_picture": { "url": "https://...", "provider": "cloudinary" }
          }
        }
      ],
      "messages": [
        {
          "id": "clxx...",
          "content": "Last message text",
          "user": { "id": "clxx...", "username": "johndoe" },
          "file": null
        }
      ]
    }
  ],
  "meta": {
    "totalPages": 1,
    "currentPage": 1,
    "itemsPerPage": 10,
    "totalItems": 5
  }
}
```

---

### GET `/chats/:chatId/messages`

Get messages for a chat (paginated).

**Headers:** `Authorization: Bearer <token>`  
**Params:** `chatId` — chat ID

**Query:**

| Field | Type   | Default | Description   |
| ----- | ------ | ------- | ------------- |
| page  | string | "1"     | Page number   |
| limit | string | "20"    | Messages per page |

**Request payload:** Query params only, e.g. `?page=1&limit=20`. No body.

**Response (200):**

```json
{
  "data": [
    {
      "id": "clxx...",
      "type": "text",
      "content": "Hello!",
      "edited": false,
      "deleted": false,
      "fileId": null,
      "userId": "clxx...",
      "chatId": "clxx...",
      "created_at": "2024-01-01T00:00:00.000Z",
      "updated_at": "2024-01-01T00:00:00.000Z",
      "user": {
        "id": "clxx...",
        "username": "janedoe",
        "first_name": "Jane",
        "last_name": "Doe",
        "profile_picture": { "id": "clxx...", "url": "https://...", "provider": "cloudinary" }
      },
      "file": null
    }
  ],
  "meta": {
    "totalPages": 1,
    "currentPage": 1,
    "itemsPerPage": 20,
    "totalItems": 15
  }
}
```

---

### POST `/chats/send-message`

Send a message (text or file).

**Headers:** `Authorization: Bearer <token>`

**Request body (SendMessageDto):**

| Field   | Type   | Required | Description                    |
| ------- | ------ | -------- | ------------------------------ |
| message | string | No*      | Text content                   |
| fileId  | string | No*      | File ID for attachment        |

*At least one of `message` or `fileId` is required.

**Request payload (example):**

```json
{
  "message": "Hello there!",
  "fileId": "clxxfileid"
}
```

Or text only: `{ "message": "Hello!" }`. Or file only: `{ "fileId": "clxxfileid" }`.

**Response (200):** Service may return success or message object (implementation may vary).

---

## 6. Status

**Prefix:** `/status`  
**Auth required:** Yes (JWT)

### GET `/status`

Get statuses (e.g. friends’ statuses) with pagination.

**Headers:** `Authorization: Bearer <token>`

**Query (PaginationParams):**

| Field | Type   | Default | Description   |
| ----- | ------ | ------- | ------------- |
| page  | number | 1       | Page number   |
| limit | number | 3       | Items per page |

**Request payload:** Query params only, e.g. `?page=1&limit=3`. No body.

**Response (200):**

```json
{
  "data": {
    "clxxuserid1": [
      {
        "id": "clxx...",
        "content": "Status text",
        "userId": "clxx...",
        "created_at": "2024-01-01T00:00:00.000Z",
        "updated_at": "2024-01-01T00:00:00.000Z",
        "file": [{ "url": "https://..." }]
      }
    ]
  },
  "meta": {
    "totalPages": 1,
    "currentPage": 1,
    "itemsPerPage": 3,
    "totalItems": 3
  }
}
```

---

### GET `/status/me`

Get current user's statuses.

**Headers:** `Authorization: Bearer <token>`

**Query:** Same as above (`page`, `limit`).

**Request payload:** Query params only. No body.

**Response (200):**

```json
{
  "data": [
    {
      "id": "clxx...",
      "content": "My status",
      "userId": "clxx...",
      "created_at": "2024-01-01T00:00:00.000Z",
      "updated_at": "2024-01-01T00:00:00.000Z"
    }
  ],
  "meta": {
    "totalPages": 1,
    "currentPage": 1,
    "itemsPerPage": 3,
    "totalItems": 2
  }
}
```

---

### POST `/status/`

Create a status (text and/or media).

**Headers:** `Authorization: Bearer <token>`

**Request body (createStatusDto):**

| Field   | Type   | Required | Description     |
| ------- | ------ | -------- | --------------- |
| content | string | No       | Text content    |
| fileId  | string | No       | Uploaded file ID |

**Request payload (example):**

```json
{
  "content": "Having a great day!",
  "fileId": "clxxfileid"
}
```

**Response (200):**

```json
{
  "message": "Status created will dissapear after 24 hrs",
  "data": {
    "id": "clxx...",
    "file": { "url": "https://..." }
  }
}
```

---

### DELETE `/status/:id`

Delete a status (owner only).

**Headers:** `Authorization: Bearer <token>`  
**Params:** `id` — status ID

**Request payload:** None (DELETE, no body).

**Response (200):**

```json
{
  "message": "Status deleted"
}
```

---

## 7. Wallet

**Prefix:** `/wallet`  
**Auth required:** Yes (JWT), except callback

### GET `/wallet`

Get current user's wallet info (balance, etc.).

**Headers:** `Authorization: Bearer <token>`

**Request payload:** None (GET, no body).

**Response (200):**

```json
{
  "message": "Wallet information retrieved successfully",
  "data": {
    "id": "clxx...",
    "balance": 150,
    "updated_at": "2024-01-01T00:00:00.000Z"
  }
}
```

---

### POST `/wallet/buy-coins`

Purchase coins (initiates payment flow). With **no provider**, returns a **checkout page link** where the user chooses Paystack or Flutterwave. With a **provider**, returns the direct payment link.

**Headers:** `Authorization: Bearer <token>`

**Request body (WalletDto):**

| Field    | Type   | Required | Description                                                                 |
| -------- | ------ | -------- | --------------------------------------------------------------------------- |
| amount   | number | Yes      | Coin amount (USD)                                                           |
| provider | string | No       | Omit for checkout page; use `"paystack"` or `"flutterwave"` for direct link  |

**Request payload (example — checkout page, recommended):**

```json
{
  "amount": 50
}
```

**Response (200) — checkout page:**

```json
{
  "message": "Checkout link created. Complete payment on the page.",
  "link": "https://your-api.com/wallet/checkout?token=eyJ...",
  "amount": 50
}
```

Open `link` in a browser to show a basic HTML page with two options: **Pay with Paystack** and **Pay with Flutterwave (card, bank transfer, USSD)**. Flutterwave supports card, bank transfer, and USSD.

**Request payload (example — direct Paystack link):**

```json
{
  "amount": 50,
  "provider": "paystack"
}
```

**Response (200) — direct link:**

```json
{
  "message": "Payment link created successfully",
  "link": "https://checkout.paystack.com/...",
  "provider": "paystack"
}
```

Same for `"provider": "flutterwave"` (direct Flutterwave link; includes card, bank transfer, USSD).

---

### GET `/wallet/gifts`

List available gifts (paginated).

**Headers:** `Authorization: Bearer <token>`

**Query (PaginationParams):**

| Field | Type   | Description   |
| ----- | ------ | ------------- |
| page  | number | Page number   |
| limit | number | Items per page |

**Request payload:** Query params only, e.g. `?page=1&limit=10`. No body.

**Response (200):**

```json
{
  "data": [
    {
      "id": "clxx...",
      "name": "Rose",
      "points": 10,
      "description": null,
      "image": { "url": "https://..." },
      "category": { "name": "Flowers" }
    }
  ],
  "meta": {
    "totalPages": 1,
    "currentPage": 1,
    "itemsPerPage": 10,
    "totalItems": 8
  }
}
```

---

### POST `/wallet/gifts/send`

Send a gift to another user (spends coins).

**Headers:** `Authorization: Bearer <token>`

**Request body (sendGiftDto):**

| Field      | Type   | Required | Description   |
| ---------- | ------ | -------- | ------------- |
| giftId     | string | Yes      | Gift ID       |
| receiverId | string | Yes      | Recipient user ID |

**Request payload (example):**

```json
{
  "giftId": "clxxgiftid",
  "receiverId": "clxxuserid"
}
```

**Response (200):**

```json
{
  "message": "Gift sent successfully"
}
```

---

### GET `/wallet/transactions`

Get current user's transactions (paginated).

**Headers:** `Authorization: Bearer <token>`

**Query (PaginationParams):** `page`, `limit`

**Request payload:** Query params only. No body.

**Response (200):**

```json
{
  "data": [
    {
      "id": "clxx...",
      "amount": 50,
      "currency": "USD",
      "status": "success",
      "type": "credit",
      "created_at": "2024-01-01T00:00:00.000Z"
    }
  ],
  "meta": {
    "totalPages": 2,
    "currentPage": 1,
    "itemsPerPage": 10,
    "totalItems": 15
  }
}
```

---

### GET `/wallet/transactions/:id`

Get a single transaction by ID.

**Headers:** `Authorization: Bearer <token>`  
**Params:** `id` — transaction ID

**Request payload:** None (GET, no body).

**Response (200):**

```json
{
  "message": "Transaction retrieved successfully",
  "data": {
    "id": "clxx...",
    "amount": 50,
    "fee": 0,
    "type": "credit",
    "description": "Purchase of coins",
    "status": "success",
    "currency": "USD",
    "payment_link": "https://...",
    "created_at": "2024-01-01T00:00:00.000Z",
    "updated_at": "2024-01-01T00:00:00.000Z",
    "userId": "clxx..."
  }
}
```

---

### POST `/wallet/deduct`

Deduct coins (e.g. internal use or admin).

**Headers:** `Authorization: Bearer <token>`

**Request body (DeductDto):**

| Field       | Type   | Required | Description   |
| ----------- | ------ | -------- | ------------- |
| amount      | number | Yes      | Amount to deduct |
| description | string | Yes      | Reason/description |

**Request payload (example):**

```json
{
  "amount": 10,
  "description": "Premium feature purchase"
}
```

**Response (200):**

```json
{
  "message": "Coins deducted successfully"
}
```

---

### GET `/wallet/checkout`

Serves the payment-method choice page (used when the user opens the link from `POST /wallet/buy-coins` without a provider).

**Query:** `token` (required) — JWT from the buy-coins checkout link.

**Response:** `200` with `Content-Type: text/html`. A basic HTML page with two buttons: **Pay with Paystack** and **Pay with Flutterwave (card, bank transfer, USSD)**. Clicking either sends the user to `/wallet/redirect?token=...&provider=...`.

---

### GET `/wallet/redirect`

Redirects the user to the chosen payment provider (Paystack or Flutterwave). Called when the user clicks a button on the checkout page.

**Query:** `token` (required), `provider` (required) — `paystack` or `flutterwave`.

**Response:** HTTP redirect to the provider’s payment URL. After payment, the provider redirects to `/wallet/callback`.

---

### GET `/wallet/callback`

Payment provider callback (Flutterwave or Paystack). Not for direct client use.

**Query:** Provider-specific (`tx_ref`, `status`, `transaction_id`, `reference`, etc.)

**Request payload:** None. Callback receives query params from payment provider.

**Response:** HTTP redirect to `milove://payment-callback?status=successful&transaction_id=...&reference=...` or `status=failed&reference=...`.

---

## 8. Upload

**Prefix:** `/upload`  
**Auth required:** No (guard commented out)

### POST `/upload`

Upload files (images) to Cloudinary. Max 5 files per request.

**Content-Type:** `multipart/form-data`

**Body:** Form field `files` — array of files (e.g. images). Use `multipart/form-data` with key `files`.

**Request payload:** Form-data with `files`: [File, File, ...] (max 5).

**Response (200):**

```json
{
  "data": [
    {
      "id": "clxx...",
      "provider": "cloudinary",
      "url": "https://res.cloudinary.com/.../image/upload/..."
    }
  ]
}
```

---

## 9. Notifications

**Prefix:** `/notifications`  
**Auth required:** Yes (JWT)

Notifications are **stored in the database** when the server sends them (for example after a new chat message). The list is ordered **newest first**. For **Socket.IO** (namespace `/chat`, events, logging), see **[SOCKET_API.md](SOCKET_API.md)**. For **Expo push** (`POST /profile/save-fcm`) and the **full HTTP route index**, see **[SOCKET_AND_PUSH_API.md](SOCKET_AND_PUSH_API.md)**.

### GET `/notifications`

Get current user's notifications (paginated).

**Headers:** `Authorization: Bearer <token>`

**Query (PaginationParams):**

| Field | Type   | Description   |
| ----- | ------ | ------------- |
| page  | number | Page number   |
| limit | number | Items per page |

**Request payload:** Query params only, e.g. `?page=1&limit=10`. No body.

**Response (200):**

```json
{
  "data": [
    {
      "id": "clxx...",
      "title": "New message",
      "body": "You have a new message from John",
      "type": "message",
      "is_read": false,
      "userId": "clxx...",
      "created_at": "2024-01-01T00:00:00.000Z",
      "updated_at": "2024-01-01T00:00:00.000Z"
    }
  ],
  "meta": {
    "totalPages": 1,
    "currentPage": 1,
    "itemsPerPage": 10,
    "totalItems": 5
  }
}
```

---

## 10. Emergencies

**Prefix:** `/emergencies`

### POST `/emergencies/panic`

**Auth required:** Yes (JWT)

Trigger panic (e.g. share location with emergency contacts).

**Headers:** `Authorization: Bearer <token>`

**Request body (PanicDto):**

| Field     | Type   | Required | Description   |
| --------- | ------ | -------- | ------------- |
| latitude  | number | Yes      | Current lat   |
| longitude | number | Yes      | Current lng   |
| reason    | string | No       | Optional reason |

**Request payload (example):**

```json
{
  "latitude": 6.5244,
  "longitude": 3.3792,
  "reason": "Feeling unsafe"
}
```

**Response (200):**

```json
{
  "message": "Panic Alert sent successfully"
}
```

Or when no emergency contact: `{ "message": "Panic Alert not sent due to no contact" }`

---

### ALL `/emergencies/webhook`

**Auth required:** No

Meta (WhatsApp) webhook for verification and incoming messages. Used by Meta to verify the webhook and to send message events.

**Query (verification):** `hub.mode`, `hub.challenge`, `hub.verify_token`  
**Body:** Meta webhook payload (see `emergency.dto.ts` for structure).

**Request payload (verification):** Query params `hub.mode`, `hub.challenge`, `hub.verify_token`.  
**Request payload (events):** Meta webhook JSON body (see `emergency.dto.ts`).

**Response:** For verification: respond with `hub.challenge` value. For events: 200 OK with empty body.

---

## 11. Streams

**Prefix:** `/streams`  
**Auth required:** Yes (JWT)

### GET `/streams/token`

Get Stream.io token for the current user (for chat/streaming features).

**Headers:** `Authorization: Bearer <token>`

**Request payload:** None (GET, no body).

**Response (200):**

```json
{
  "message": "Call Streams Token Generate Successfully",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

---

## Common

### Pagination

Where **PaginationParams** is used:

- `page`: number or string (default often `1`)
- `limit`: number or string (default often `50` or module-specific)

Response meta often includes:

- `totalPages`
- `currentPage`
- `itemsPerPage`
- `totalItems`

### Errors

- **400 Bad Request:** Validation or business rule error (e.g. user exists, invalid OTP).
- **401 Unauthorized:** Missing or invalid JWT.
- **403 Forbidden:** Not allowed to perform action.
- **404 Not Found:** Resource not found.
- **502 Bad Gateway:** Upstream/service error (e.g. “No message or fileId provided” in send-message).

### Enums (Prisma)

- **gender:** `male` \| `female` \| `other`
- **post_visibility:** `public` \| `friends`
- **otp type:** `reset` \| `verify`
- **notification_type:** `message` \| `security` \| `system` \| `social`
- **transaction_type:** `credit` \| `debit`
- **status_type:** `success` \| `failed` \| `pending`

---

*Generated from Mi-Love API backend. For interactive docs, use Swagger at `/docs`. Socket.IO: [SOCKET_API.md](SOCKET_API.md). Expo push and HTTP route index: [SOCKET_AND_PUSH_API.md](SOCKET_AND_PUSH_API.md).*
