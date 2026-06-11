---
title: Upload new project version (file)
description: Upload new project version (file)
order: 8
---

## POST /projects/{slug}/versions

**Summary:** Upload new project version (file)

Creates a new version of the mod/project with uploaded JAR/file.

### Authentication

Requires authentication.

### Example Request

```bash
curl -X POST "https://api.modifold.com/projects/example-project/versions" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "version_number=1.0.0" \
  -F "changelog=string" \
  -F "release_channel=release" \
  -F "game_versions=[\"0.5.0-pre.9.1\",\"0.5.0-pre.9\"]" \
  -F "loaders=vanilla" \
  -F "dependencies=[{\"slug\":\"mermaids\",\"version_id\":\"oCK3bg\",\"type\":\"required\"}]" \
  -F "file=@file.png"
```

### Parameters

| Name | In | Type | Required | Description |
| --- | --- | --- | --- | --- |
| slug | path | string | yes | - |

### Request Body

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| version_number | string | yes | - |
| changelog | string | no | - |
| release_channel | string | no | Allowed values: `release`, `beta`, `alpha`<br>Default: `release` |
| game_versions | string | yes | JSON-stringified array of supported game versions from GET /tags/game-versions. Early Access is not used. |
| loaders | string | yes | JSON-stringified array of supported loaders |
| dependencies | string | no | JSON-stringified array of dependencies |
| file | string (binary) | yes | Format: `binary` |

### Example Response

Status: `200`

```json
{
  "success": true,
  "versionId": "1.0.0",
  "fileUrl": "https://example.com"
}
```

### Responses

| Status | Description |
| --- | --- |
| `200` | Version created |
| `400` | Missing required fields |
| `403` | Unauthorized |
| `404` | Project not found |
| `500` | Server error |
