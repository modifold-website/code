---
title: Modify a project
description: Update project by ID
order: 17
---

## PUT /projects/{id}

**Summary:** Update project by ID

Updates project title, summary, visibility, slug and/or icon.
Only the project owner can perform this action.

- Slug must be unique, lowercase, 1-30 characters, alphanumeric + hyphens
- Icon upload replaces the existing one (multipart/form-data)

### Authentication

Requires authentication.

### Example Request

```bash
curl -X PUT "https://api.modifold.com/projects/123" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "title=Updated Epic Mod" \
  -F "summary=Improves lighting and adds realistic shadows" \
  -F "visibility=public" \
  -F "comments_enabled=true" \
  -F "slug=example-project" \
  -F "icon=@icon.png"
```

### Parameters

| Name | In | Type | Required | Description |
| --- | --- | --- | --- | --- |
| id | path | string | yes | Unique project ID (not slug) |

### Request Body

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| title | string | no | New project title |
| summary | string | no | New short summary<br>Min length: `30`<br>Max length: `256` |
| visibility | string | no | Allowed values: `public`, `unlisted`, `private` |
| comments_enabled | boolean | no | Enable or disable comments |
| slug | string | no | New URL-friendly slug (must be unique) |
| icon | string (binary) | no | Optional new icon file<br>Format: `binary` |

### Example Response

Status: `200`

```json
{
  "success": true,
  "message": "Project updated",
  "slug": "example-project"
}
```

### Responses

| Status | Description |
| --- | --- |
| `200` | Project updated successfully |
| `400` | Invalid slug format or slug already taken |
| `403` | Unauthorized (not the owner) |
| `404` | Project not found |
| `500` | Server error (database or file handling) |
