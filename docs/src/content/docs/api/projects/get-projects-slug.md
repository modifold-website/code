---
title: Get a project
description: Get full project details by slug
order: 15
---

## GET /projects/{slug}

**Summary:** Get full project details by slug

Returns complete information about a project including metadata, versions, gallery images, team members, and like status.
Some fields (is_liked) depend on authentication.

### Example Request

```bash
curl -X GET "https://api.modifold.com/projects/example-project"
```

### Parameters

| Name | In | Type | Required | Description |
| --- | --- | --- | --- | --- |
| slug | path | string | yes | Unique project slug |

### Example Response

Status: `200`

```json
{
  "id": "123",
  "slug": "example-project",
  "project_type": "mod",
  "title": "Better Lighting Mod",
  "summary": "Improves lighting and adds realistic shadows",
  "description": "A detailed project description.",
  "visibility": "public",
  "comments_enabled": true,
  "created_at": "string",
  "updated_at": "string",
  "status": "string",
  "license": {
    "id": "123",
    "name": "string"
  },
  "issue_url": "https://example.com",
  "source_url": "https://example.com",
  "wiki_url": "https://example.com",
  "discord_url": "https://example.com",
  "hytale_wiki_slug": "example-project",
  "hytale_wiki_url": "https://example.com",
  "icon_url": "https://example.com",
  "downloads": 20,
  "followers": 20,
  "color": "#067aff",
  "game_versions": [
    "0.5.0-pre.9.1"
  ],
  "loaders": [
    "vanilla"
  ],
  "tags": "Adventure",
  "user_id": "string",
  "showProjectBackground": true,
  "owner": {
    "id": "123",
    "username": "string",
    "slug": "example-project",
    "avatar": "string",
    "summary": "Improves lighting and adds realistic shadows",
    "isVerified": 20,
    "type": "user",
    "profile_url": "https://example.com"
  },
  "organization": {
    "id": "123",
    "slug": "example-project",
    "name": "string",
    "summary": "Improves lighting and adds realistic shadows",
    "icon_url": "https://example.com"
  },
  "members": [
    {
      "user_id": "string",
      "role": "Owner",
      "status": "accept",
      "username": "string",
      "slug": "example-project",
      "avatar": "string"
    }
  ],
  "versions": [
    {
      "id": "123",
      "version_number": "1.0.0",
      "changelog": "string",
      "release_channel": "release",
      "file_url": "https://example.com",
      "file_size": 20,
      "game_versions": "0.5.0-pre.9.1",
      "loaders": "vanilla",
      "downloads": 20,
      "created_at": "string"
    }
  ],
  "gallery": [
    {
      "id": "123",
      "url": "https://example.com",
      "raw_url": "https://example.com",
      "title": "Better Lighting Mod",
      "description": "A detailed project description.",
      "ordering": 20,
      "featured": true
    }
  ],
  "is_liked": true,
  "permissions": {
    "can_edit_details": true,
    "can_edit_body": true,
    "can_edit_gallery": true,
    "can_manage_versions": true,
    "can_delete_project": true
  }
}
```

### Responses

| Status | Description |
| --- | --- |
| `200` | Project details |
| `404` | Project not found |
| `500` | Server error during data fetching |
