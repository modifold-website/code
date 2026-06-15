---
title: Get a version
description: Get a project version directly by its version ID.
order: 101
---

## GET /v2/version/{versionId}

**Summary:** Get a version by ID

Returns a project version without requiring the parent project slug or ID. Public requests can access approved versions. Project owners, team members with version permissions, moderators, and administrators can also access non-public version states when authenticated.

### Example Request

```bash
curl -X GET "https://api.modifold.com/v2/version/UddlN6L4"
```

### Parameters

| Name | In | Type | Required | Description |
| --- | --- | --- | --- | --- |
| versionId | path | string | yes | Unique version ID |

### Example Response

Status: `200`

```json
{
  "id": "UddlN6L4",
  "project_id": "FlmWzw",
  "version_number": "1.0.0",
  "downloads": 20,
  "changelog": "Initial release",
  "release_channel": "release",
  "game_versions": [
    "0.5.0-pre.9.1"
  ],
  "loaders": [
    "vanilla"
  ],
  "file_url": "https://media.modifold.com/projects/FlmWzw/example.jar",
  "file_size": 1870358,
  "created_at": "2026-06-15T00:00:00.000Z",
  "files": [
    {
      "url": "https://media.modifold.com/projects/FlmWzw/example.jar",
      "size": 1870358,
      "primary": true
    }
  ],
  "dependencies": []
}
```

### Responses

| Status | Description |
| --- | --- |
| `200` | Version details |
| `404` | Version not found or not visible to the current user |
| `500` | Server error during database query |
