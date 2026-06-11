---
title: Create a project comment
description: Create a project comment
order: 19
---

## POST /projects/{slug}/comments

**Summary:** Create a project comment

Creates a new comment or reply (auth required).

### Authentication

Requires authentication.

### Example Request

```bash
curl -X POST "https://api.modifold.com/projects/example-project/comments" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
  "content": "string",
  "parent_id": 20
}'
```

### Example JSON Body

```json
{
  "content": "string",
  "parent_id": 20
}
```

### Parameters

| Name | In | Type | Required | Description |
| --- | --- | --- | --- | --- |
| slug | path | string | yes | Project slug |

### Request Body

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| content | string | no | - |
| parent_id | integer | no | Nullable |

### Example Response

Status: `201`

```json
{
  "id": 20,
  "parent_id": 20,
  "content": "string",
  "created_at": 20,
  "updated_at": 20,
  "status": "string",
  "author": {
    "id": "123",
    "username": "string",
    "slug": "example-project",
    "avatar": "string",
    "isVerified": 20,
    "isRole": "string"
  },
  "isAuthor": true
}
```

### Responses

| Status | Description |
| --- | --- |
| `201` | Comment created |
| `400` | Invalid input |
| `401` | Unauthorized |
| `403` | Comments are disabled for this project |
| `429` | Rate limited or duplicate content |
