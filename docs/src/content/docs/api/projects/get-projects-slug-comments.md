---
title: Get project comments
description: Get project comments
order: 18
---

## GET /projects/{slug}/comments

**Summary:** Get project comments

Returns threaded project comments (flat list with parent_id).

### Example Request

```bash
curl -X GET "https://api.modifold.com/projects/example-project/comments"
```

### Parameters

| Name | In | Type | Required | Description |
| --- | --- | --- | --- | --- |
| slug | path | string | yes | Project slug |

### Example Response

Status: `200`

```json
{
  "projectId": "string",
  "ownerId": "string",
  "viewerId": "string",
  "canModerate": true,
  "comments": [
    {
      "id": 20,
      "parent_id": 20,
      "content": "string",
      "created_at": "string",
      "updated_at": "string",
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
  ]
}
```

### Responses

| Status | Description |
| --- | --- |
| `200` | List of comments |
| `403` | Comments are disabled for this project |
| `404` | Project not found |
