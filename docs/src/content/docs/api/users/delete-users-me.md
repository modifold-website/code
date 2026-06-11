---
title: Delete current user
description: Delete current user account
order: 4
---

## DELETE /users/me

**Summary:** Delete current user account

Permanently deletes the user account and all related data:
- All owned projects
- Project versions, gallery, members, likes, analytics, ad impressions
- Files from storage (projects folders)

Requires authentication. This action is irreversible.

### Authentication

Requires authentication.

### Example Request

```bash
curl -X DELETE "https://api.modifold.com/users/me" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Example Response

Status: `200`

```json
{
  "success": true,
  "message": "Account and all related data successfully deleted"
}
```

### Responses

| Status | Description |
| --- | --- |
| `200` | Account and related data successfully deleted |
| `401` | Unauthorized (no token) |
| `500` | Server error during deletion |
