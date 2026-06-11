---
title: Delete gallery image
description: Delete gallery image
order: 14
---

## DELETE /projects/{slug}/gallery/{galleryId}

**Summary:** Delete gallery image

Removes image from gallery and deletes files from storage.

### Authentication

Requires authentication.

### Example Request

```bash
curl -X DELETE "https://api.modifold.com/projects/example-project/gallery/7" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Parameters

| Name | In | Type | Required | Description |
| --- | --- | --- | --- | --- |
| slug | path | string | yes | - |
| galleryId | path | string | yes | - |

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
| `200` | Image deleted successfully |
| `403` | Unauthorized |
| `404` | Project or gallery image not found |
| `500` | Server error (partial file deletion possible) |
