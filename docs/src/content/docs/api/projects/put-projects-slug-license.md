---
title: Update project license
description: Update project license
order: 5
---

## PUT /projects/{slug}/license

**Summary:** Update project license

Changes license ID and/or name. Partial updates allowed.

### Authentication

Requires authentication.

### Example Request

```bash
curl -X PUT "https://api.modifold.com/projects/example-project/license" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
  "license_id": "string",
  "license_name": "string"
}'
```

### Example JSON Body

```json
{
  "license_id": "string",
  "license_name": "string"
}
```

### Parameters

| Name | In | Type | Required | Description |
| --- | --- | --- | --- | --- |
| slug | path | string | yes | - |

### Request Body

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| license_id | string | no | License identifier (SPDX or custom) |
| license_name | string | no | Human-readable license name |

### Responses

| Status | Description |
| --- | --- |
| `200` | License updated |
| `400` | No data to update |
| `403` | Unauthorized or project not found |
| `500` | Server error |
