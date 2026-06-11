---
title: Add image to project gallery
description: Add image to project gallery
order: 12
---

## POST /projects/{slug}/gallery

**Summary:** Add image to project gallery

Uploads a new screenshot/image to the project gallery.

### Authentication

Requires authentication.

### Example Request

```bash
curl -X POST "https://api.modifold.com/projects/example-project/gallery" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "image=@image.png" \
  -F "title=Better Lighting Mod" \
  -F "description=A detailed project description." \
  -F "ordering=20" \
  -F "featured=true"
```

### Parameters

| Name | In | Type | Required | Description |
| --- | --- | --- | --- | --- |
| slug | path | string | yes | - |

### Request Body

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| image | string (binary) | yes | Format: `binary` |
| title | string | no | - |
| description | string | no | - |
| ordering | integer | no | - |
| featured | boolean | no | Set as featured image (resets others) |

### Example Response

Status: `200`

```json
{
  "success": true,
  "url": "https://example.com"
}
```

### Responses

| Status | Description |
| --- | --- |
| `200` | Image added |
| `400` | No image uploaded |
| `403` | Unauthorized |
| `500` | Server error |
