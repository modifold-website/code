---
title: Update project external links
description: Update project external links
order: 6
---

## PUT /projects/{slug}/links

**Summary:** Update project external links

Updates issue tracker, source code, wiki, Discord links. Partial updates supported.

### Authentication

Requires authentication.

### Example Request

```bash
curl -X PUT "https://api.modifold.com/projects/example-project/links" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
  "issue_url": "https://example.com",
  "source_url": "https://example.com",
  "wiki_url": "https://example.com",
  "discord_url": "https://example.com",
  "hytale_wiki_url": "https://example.com"
}'
```

### Example JSON Body

```json
{
  "issue_url": "https://example.com",
  "source_url": "https://example.com",
  "wiki_url": "https://example.com",
  "discord_url": "https://example.com",
  "hytale_wiki_url": "https://example.com"
}
```

### Parameters

| Name | In | Type | Required | Description |
| --- | --- | --- | --- | --- |
| slug | path | string | yes | - |

### Request Body

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| issue_url | string (uri) | no | Format: `uri` |
| source_url | string (uri) | no | Format: `uri` |
| wiki_url | string (uri) | no | Format: `uri` |
| discord_url | string (uri) | no | Format: `uri` |
| hytale_wiki_url | string (uri) | no | Format: `uri` |

### Responses

| Status | Description |
| --- | --- |
| `200` | Links updated |
| `400` | No data to update |
| `403` | Unauthorized or project not found |
| `500` | Server error |
