---
title: Upload or update project icon
description: Upload or update project icon
order: 7
---

## PUT /projects/{slug}/icon

**Summary:** Upload or update project icon

Replaces the project icon with a new image file.

### Authentication

Requires authentication.

### Example Request

```bash
curl -X PUT "https://api.modifold.com/projects/example-project/icon" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "icon=@icon.png"
```

### Parameters

| Name | In | Type | Required | Description |
| --- | --- | --- | --- | --- |
| slug | path | string | yes | - |

### Request Body

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| icon | string (binary) | yes | Format: `binary` |

### Example Response

Status: `200`

```json
{
  "success": true,
  "icon_url": "https://example.com",
  "color": "#067aff"
}
```

### Responses

| Status | Description |
| --- | --- |
| `200` | Icon updated successfully |
| `400` | No file uploaded |
| `403` | Unauthorized or project not found |
| `500` | Server error during file handling |
