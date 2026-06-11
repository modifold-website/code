---
title: Moderate a project comment
description: Moderate or delete a comment
order: 20
---

## PATCH /projects/{slug}/comments/{commentId}

**Summary:** Moderate or delete a comment

Allows comment author to delete, and project owner/moderator to hide/show/spam.

### Authentication

Requires authentication.

### Example Request

```bash
curl -X PATCH "https://api.modifold.com/projects/example-project/comments/42" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
  "action": "delete"
}'
```

### Example JSON Body

```json
{
  "action": "delete"
}
```

### Parameters

| Name | In | Type | Required | Description |
| --- | --- | --- | --- | --- |
| slug | path | string | yes | - |
| commentId | path | integer | yes | - |

### Request Body

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| action | string | no | Allowed values: `delete`, `hide`, `show`, `spam` |

### Example Response

Status: `200`

```json
{
  "success": true,
  "status": "deleted"
}
```

### Responses

| Status | Description |
| --- | --- |
| `200` | Comment updated |
| `401` | Unauthorized |
| `403` | Forbidden |
| `404` | Not found |
