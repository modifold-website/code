---
title: Search projects
description: Get list of approved projects (mods/modpacks)
order: 1
---

## GET /projects

**Summary:** Get list of approved projects (mods/modpacks)

Retrieves a paginated list of approved projects with filtering, sorting and search capabilities.
Supports filtering by project type, tags, game versions, loaders, search by title.

### Example Request

```bash
curl -X GET "https://api.modifold.com/projects?type=mod&sort=downloads&search=lighting&tags=Adventure&game_versions=0.5.0-pre.9.1&loaders=vanilla&page=1&limit=20"
```

### Parameters

| Name | In | Type | Required | Description |
| --- | --- | --- | --- | --- |
| type | query | string | no | Project type filter ("mod" or "modpack")<br>Allowed values: `mod`, `modpack` |
| sort | query | string | no | Sorting method - by downloads count (default) or creation date<br>Allowed values: `downloads`, `recent`<br>Default: `downloads` |
| search | query | string | no | Search by project title (partial match) |
| tags | query | string | no | Comma-separated list of tags (example: "Adventure,Optimization") |
| game_versions | query | string | no | Comma-separated list of supported game versions from GET /tags/game-versions (example: "0.5.0-pre.9.1,0.5.0-pre.9"). Early Access is not used. |
| loaders | query | string | no | Comma-separated list of supported mod loaders (example: "vanilla") |
| page | query | integer | no | Page number for pagination<br>Default: `1`<br>Minimum: `1` |
| limit | query | integer | no | Number of projects per page<br>Default: `20`<br>Minimum: `1`<br>Maximum: `100` |

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
      "followers": 20,
      "color": "#067aff",
      "user_id": "string",
      "created_at": "string",
      "updated_at": "string",
      "project_type": "mod",
      "license": {
        "id": "123",
        "name": "string"
      },
      "tags": [
        "Adventure"
      ],
      "game_versions": [
        "0.5.0-pre.9.1"
      ],
      "loaders": [
        "vanilla"
      ],
      "gallery": [
        {
          "url": "https://example.com",
          "featured": 20
        }
      ],
      "owner": {
        "id": "123",
        "username": "string",
        "slug": "example-project",
        "avatar": "string",
        "summary": "Improves lighting and adds realistic shadows",
        "isVerified": 20,
        "type": "user",
        "profile_url": "https://example.com"
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
| `200` | Successful response with paginated list of projects |
| `400` | Invalid query parameters (wrong type, page, limit, etc.) |
| `429` | #/components/responses/RateLimitExceeded |
| `500` | Server error during database query |
