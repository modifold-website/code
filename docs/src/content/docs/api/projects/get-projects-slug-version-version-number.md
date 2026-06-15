---
title: Get details of a specific project version
description: Get details of a specific project version
order: 9
---

## GET /projects/{slug}/version/{version_number}

**Summary:** Get details of a specific project version

Retrieves detailed information about a specific version of the project by its ID.
Includes parsed game versions and loaders as arrays, and file information as an array of objects.

### Example Request

```bash
curl -X GET "https://api.modifold.com/projects/example-project/version/UddlN6L4"
```

### Parameters

| Name | In | Type | Required | Description |
| --- | --- | --- | --- | --- |
| slug | path | string | yes | Project slug or project ID |
| version_number | path | string | yes | Unique version ID (not version number string) |

### Example Response

Status: `200`

```json
{
  "id": "123",
  "project_id": "string",
  "version_number": "1.0.0",
  "downloads": 20,
  "changelog": "string",
  "release_channel": "release",
  "game_versions": [
    "0.5.0-pre.9.1",
    "0.5.0-pre.9"
  ],
  "loaders": [
    "vanilla"
  ],
  "file_url": "https://example.com",
  "file_size": 20,
  "created_at": "string",
  "files": [
    {
      "url": "https://example.com",
      "size": 20,
      "primary": true
    }
  ],
  "dependencies": [
    {
      "project_id": "abc123",
      "project_slug": "mermaids",
      "project_title": "Mermaids",
      "project_icon_url": "https://media.modifold.com/projects/abc123/icon.webp",
      "project_type": "mod",
      "version_id": "oCK3bg",
      "version_number": "1.0.0",
      "dependency_type": "required"
    }
  ]
}
```

### Responses

| Status | Description |
| --- | --- |
| `200` | Version details successfully retrieved |
| `404` | Project or version not found |
| `500` | Server error during database query |
