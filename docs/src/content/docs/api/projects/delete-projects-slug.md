---
title: Delete a project
description: Delete a project
order: 16
---

## DELETE /projects/{slug}

**Summary:** Delete a project

Permanently deletes the project, all its versions, categories, gallery images, 
and associated files from the storage (MEDIA_ROOT/projects/{projectId}).

Only the project owner can perform this action. 
Files are deleted recursively; if deletion fails (e.g. permissions), 
a warning is logged, but the database records are still removed.

### Authentication

Requires authentication.

### Example Request

```bash
curl -X DELETE "https://api.modifold.com/projects/example-project" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Parameters

| Name | In | Type | Required | Description |
| --- | --- | --- | --- | --- |
| slug | path | string | yes | Unique project slug |

### Example Response

Status: `200`

```json
{
  "success": true,
  "message": "Project and associated files deleted"
}
```

### Responses

| Status | Description |
| --- | --- |
| `200` | Project and associated data successfully deleted |
| `403` | Unauthorized (not the project owner) |
| `404` | Project not found |
| `500` | Server error (database or file system issue) |
