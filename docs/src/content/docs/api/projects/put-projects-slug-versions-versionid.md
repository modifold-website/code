---
title: Update an existing project version
description: Update an existing project version
order: 10
---

## PUT /projects/{slug}/versions/{versionId}

**Summary:** Update an existing project version

Updates version metadata (version number, changelog, release channel, 
supported game versions, loaders) and optionally replaces the version file.

Only the project owner can perform this action.

### Authentication

Requires authentication.

### Example Request

```bash
curl -X PUT "https://api.modifold.com/projects/example-project/versions/UddlN6L4" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "version_number=1.0.0" \
  -F "changelog=string" \
  -F "release_channel=release" \
  -F "game_versions=[\"0.5.0-pre.9.1\",\"0.5.0-pre.9\"]" \
  -F "loaders=[\"vanilla\"]" \
  -F "dependencies=[{\"slug\":\"mermaids\",\"version_id\":\"oCK3bg\",\"type\":\"required\"}]" \
  -F "file=@file.png"
```

### Parameters

| Name | In | Type | Required | Description |
| --- | --- | --- | --- | --- |
| slug | path | string | yes | Project slug or project ID |
| versionId | path | string | yes | Unique version ID |

### Request Body

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| version_number | string | no | New version number (e.g. 1.2.3) |
| changelog | string | no | Update changelog (Markdown supported)<br>Nullable |
| release_channel | string | no | Release stability channel<br>Allowed values: `release`, `beta`, `alpha`<br>Default: `release` |
| game_versions | string | no | JSON-stringified array of supported game versions from GET /tags/game-versions. Early Access is not used. |
| loaders | string | no | JSON-stringified array of supported loaders |
| dependencies | string | no | JSON-stringified array of dependencies |
| file | string (binary) | no | Optional new version file (replaces existing)<br>Format: `binary` |

### Example Response

Status: `200`

```json
{
  "success": true
}
```

### Responses

| Status | Description |
| --- | --- |
| `200` | Version updated successfully |
| `403` | Unauthorized or project not found |
| `404` | Version not found |
| `500` | Server error during update |
