---
title: Delete a specific project version
description: Delete a specific project version
order: 11
---

## DELETE /projects/{slug}/versions/{versionId}

**Summary:** Delete a specific project version

Permanently deletes a version record from database and removes 
its associated file from storage (if exists).

Only the project owner can delete versions.

### Authentication

Requires authentication.

### Example Request

```bash
curl -X DELETE "https://api.modifold.com/projects/example-project/versions/UddlN6L4" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Parameters

| Name | In | Type | Required | Description |
| --- | --- | --- | --- | --- |
| slug | path | string | yes | Project slug or project ID |
| versionId | path | string | yes | Unique version ID to delete |

### Example Response

Status: `200`

```json
{
  "success": true,
  "message": "Version deleted successfully"
}
```

### Responses

| Status | Description |
| --- | --- |
| `200` | Version deleted successfully |
| `403` | Unauthorized (not the project owner) |
| `404` | Project or version not found |
| `500` | Server error (database or file deletion issue) |
