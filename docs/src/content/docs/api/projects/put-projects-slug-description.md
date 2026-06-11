---
title: Update project full description
description: Update project full description
order: 4
---

## PUT /projects/{slug}/description

**Summary:** Update project full description

Updates the detailed description of the project. Only owner.

### Authentication

Requires authentication.

### Example Request

```bash
curl -X PUT "https://api.modifold.com/projects/example-project/description" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
  "description": "A detailed project description."
}'
```

### Example JSON Body

```json
{
  "description": "A detailed project description."
}
```

### Parameters

| Name | In | Type | Required | Description |
| --- | --- | --- | --- | --- |
| slug | path | string | yes | - |

### Request Body

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| description | string | yes | Full project description (Markdown supported) |

### Responses

| Status | Description |
| --- | --- |
| `200` | Description updated |
| `403` | Unauthorized or project not found |
| `500` | Server error |
