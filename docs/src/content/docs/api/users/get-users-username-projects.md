---
title: Get user projects
description: Get paginated list of user's approved projects
order: 2
---

## GET /users/{username}/projects

**Summary:** Get paginated list of user's approved projects

Returns list of approved projects where the user is either owner or member.
Sorted by downloads descending by default.
Public endpoint — no authentication required.

### Example Request

```bash
curl -X GET "https://api.modifold.com/users/string/projects?page=1&limit=20"
```

### Parameters

| Name | In | Type | Required | Description |
| --- | --- | --- | --- | --- |
| username | path | string | yes | User's username or slug |
| page | query | integer | no | Page number<br>Default: `1`<br>Minimum: `1` |
| limit | query | integer | no | Items per page<br>Default: `20`<br>Minimum: `1`<br>Maximum: `100` |

### Example Response

Status: `200`

```json
{
  "projects": [
    {
      "id": "123",
      "slug": "example-project",
      "title": "Better Lighting Mod",
      "summary": "Improves lighting and adds realistic shadows",
      "icon_url": "https://example.com",
      "downloads": 20,
      "created_at": "string",
      "updated_at": "string",
      "project_type": "mod",
      "tags": [
        "Adventure"
      ],
      "gallery": [
        {
          "url": "https://example.com",
          "featured": 20
        }
      ],
      "owner": {
        "username": "string",
        "slug": "example-project",
        "avatar": "string"
      }
    }
  ],
  "totalPages": 1,
  "currentPage": 1
}
```

### Responses

| Status | Description |
| --- | --- |
| `200` | List of projects |
| `400` | Invalid page or limit parameters |
| `429` | #/components/responses/RateLimitExceeded |
| `500` | Server error |
