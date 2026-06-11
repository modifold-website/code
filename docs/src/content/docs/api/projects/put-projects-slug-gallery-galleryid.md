---
title: Update gallery image
description: Update gallery image
order: 13
---

## PUT /projects/{slug}/gallery/{galleryId}

**Summary:** Update gallery image

Updates title, description, order, featured status or replaces the image.

### Authentication

Requires authentication.

### Example Request

```bash
curl -X PUT "https://api.modifold.com/projects/example-project/gallery/7" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "title=Better Lighting Mod" \
  -F "description=A detailed project description." \
  -F "ordering=20" \
  -F "featured=true" \
  -F "image=@image.png"
```

### Parameters

| Name | In | Type | Required | Description |
| --- | --- | --- | --- | --- |
| slug | path | string | yes | - |
| galleryId | path | string | yes | - |

### Request Body

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| title | string | no | - |
| description | string | no | - |
| ordering | integer | no | - |
| featured | boolean | no | - |
| image | string (binary) | no | Format: `binary` |

### Example Response

Status: `200`

```json
{
  "success": true,
  "message": "Request completed successfully"
}
```

### Responses

| Status | Description |
| --- | --- |
| `200` | Image updated |
| `400` | No data to update |
| `403` | Unauthorized |
| `404` | Gallery image not found |
| `500` | Server error |
