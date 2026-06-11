---
title: Update current user
description: Update current user's profile
order: 1
---

## PUT /users/me

**Summary:** Update current user's profile

Updates username, description, social links, avatar photo.
Requires authentication (JWT or API token).

- Avatar are uploaded as multipart files
- Social links are sent as JSON string or object

### Authentication

Requires authentication.

### Example Request

```bash
curl -X PUT "https://api.modifold.com/users/me" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "username=NewUserName" \
  -F "description=A detailed project description." \
  -F "social_links={\"youtube\":\"https://youtube.com/@user\",\"discord\":\"user#1234\"}" \
  -F "avatar=@avatar.png"
```

### Request Body

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| username | string | no | New username |
| description | string | no | Bio/description |
| social_links | string | no | JSON string with social links (youtube, telegram, x, discord) |
| avatar | string (binary) | no | New profile avatar (JPEG/PNG/GIF, max 20MB)<br>Format: `binary` |

### Example Response

Status: `200`

```json
{
  "id": "123",
  "username": "string",
  "slug": "example-project",
  "avatar": "string",
  "description": "A detailed project description.",
  "created_at": "string",
  "social_links": {}
}
```

### Responses

| Status | Description |
| --- | --- |
| `200` | Profile updated successfully |
| `400` | No data provided for update or invalid input |
| `401` | Unauthorized (no valid token) |
| `429` | #/components/responses/RateLimitExceeded |
| `500` | Server error |
