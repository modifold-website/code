---
title: Create a project
description: Create a new project (mod/modpack)
order: 2
---

## POST /projects

**Summary:** Create a new project (mod/modpack)

Creates a new project (mods or modpacks).
Requires authentication (JWT or API token starting with mf_).
Uploads an icon file and creates project directory structure.

### Authentication

Requires authentication.

### Example Request

```bash
curl -X POST "https://api.modifold.com/projects" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "title=Better Lighting Mod" \
  -F "summary=Improves lighting and adds realistic shadows" \
  -F "visibility=public" \
  -F "project_type=mod" \
  -F "icon=@icon.png"
```

### Request Body

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| title | string | yes | Project title (used to generate slug)<br>Min length: `3`<br>Max length: `100` |
| summary | string | yes | Short description of the project<br>Max length: `256` |
| visibility | string | no | Project visibility level<br>Allowed values: `public`, `unlisted`, `private`<br>Default: `public` |
| project_type | string | yes | Type of project<br>Allowed values: `mod`, `modpack` |
| icon | string (binary) | no | Project icon image (JPEG, PNG, GIF, WebP)<br>Format: `binary` |

### Example Response

Status: `200`

```json
{
  "id": "123",
  "slug": "example-project",
  "title": "Better Lighting Mod",
  "summary": "Improves lighting and adds realistic shadows",
  "visibility": "public",
  "project_type": "mod",
  "icon_url": "https://example.com",
  "color": "#067aff",
  "success": true
}
```

### Responses

| Status | Description |
| --- | --- |
| `200` | Project successfully created |
| `400` | Validation error (missing required fields, invalid project type, or unable to generate unique slug) |
| `401` | Unauthorized - missing or invalid authentication token |
| `500` | Server error (database issue, file system error, etc.) |
