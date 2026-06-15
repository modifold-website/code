---
title: Update basic project settings
description: Update basic project settings
order: 3
---

## PUT /projects/{slug}/settings

**Summary:** Update basic project settings

Updates title, summary and/or visibility of the project. Only the project owner can do this.

### Authentication

Requires authentication.

### Example Request

```bash
curl -X PUT "https://api.modifold.com/projects/example-project/settings" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
  "title": "Updated Lighting Mod",
  "summary": "Improved lighting with dynamic shadows",
  "visibility": "public",
  "comments_enabled": true
}'
```

### Example JSON Body

```json
{
  "title": "Updated Lighting Mod",
  "summary": "Improved lighting with dynamic shadows",
  "visibility": "public",
  "comments_enabled": true
}
```

### Parameters

| Name | In | Type | Required | Description |
| --- | --- | --- | --- | --- |
| slug | path | string | yes | Project slug or project ID |

### Request Body

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| title | string | no | New project title |
| summary | string | no | New short description<br>Min length: `30`<br>Max length: `256` |
| visibility | string | no | New visibility level<br>Allowed values: `public`, `unlisted`, `private` |
| comments_enabled | boolean | no | Enable or disable comments |

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
| `200` | Settings updated successfully |
| `400` | No data provided or invalid summary |
| `403` | Unauthorized or project not found |
| `500` | Server error |
