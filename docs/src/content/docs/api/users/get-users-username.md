---
title: Get a user
description: Get public user profile by username/slug
order: 3
---

## GET /users/{username}

**Summary:** Get public user profile by username/slug

Returns public information about a user (profile, stats, social links).
Sensitive data (email, etc.) is excluded.
Public endpoint — no authentication required.

### Example Request

```bash
curl -X GET "https://api.modifold.com/users/string"
```

### Parameters

| Name | In | Type | Required | Description |
| --- | --- | --- | --- | --- |
| username | path | string | yes | Username or slug |

### Example Response

Status: `200`

```json
{
  "id": "123",
  "username": "string",
  "slug": "example-project",
  "description": "A detailed project description.",
  "avatar": "string",
  "created_at": "string",
  "isVerified": true,
  "isRole": "string",
  "subscribers": 20,
  "subscriptions": 20,
  "social_links": {}
}
```

### Responses

| Status | Description |
| --- | --- |
| `200` | User profile |
| `404` | User not found |
| `500` | Server error |
