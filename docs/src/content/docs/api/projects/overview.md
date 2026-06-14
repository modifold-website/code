---
title: Overview
description: Project discovery, creation, updates, versions, and gallery endpoints.
order: 0
---

## Endpoints

| Method | Path | Summary |
| --- | --- | --- |
| `GET` | [`/projects`](/api/projects/get-projects) | Get list of approved projects (mods/modpacks) |
| `POST` | [`/projects`](/api/projects/post-projects) | Create a new project (mod/modpack) |
| `PUT` | [`/projects/{slug}/settings`](/api/projects/put-projects-slug-settings) | Update basic project settings |
| `PUT` | [`/projects/{slug}/description`](/api/projects/put-projects-slug-description) | Update project full description |
| `PUT` | [`/projects/{slug}/license`](/api/projects/put-projects-slug-license) | Update project license |
| `PUT` | [`/projects/{slug}/links`](/api/projects/put-projects-slug-links) | Update project external links |
| `PUT` | [`/projects/{slug}/icon`](/api/projects/put-projects-slug-icon) | Upload or update project icon |
| `POST` | [`/projects/{slug}/versions`](/api/projects/post-projects-slug-versions) | Upload new project version (file) |
| `GET` | [`/projects/{slug}/version/{version_number}`](/api/projects/get-projects-slug-version-version-number) | Get details of a specific project version |
| `PUT` | [`/projects/{slug}/versions/{versionId}`](/api/projects/put-projects-slug-versions-versionid) | Update an existing project version |
| `DELETE` | [`/projects/{slug}/versions/{versionId}`](/api/projects/delete-projects-slug-versions-versionid) | Delete a specific project version |
| `POST` | [`/projects/{slug}/gallery`](/api/projects/post-projects-slug-gallery) | Add image to project gallery |
| `PUT` | [`/projects/{slug}/gallery/{galleryId}`](/api/projects/put-projects-slug-gallery-galleryid) | Update gallery image |
| `DELETE` | [`/projects/{slug}/gallery/{galleryId}`](/api/projects/delete-projects-slug-gallery-galleryid) | Delete gallery image |
| `GET` | [`/projects/{slug}`](/api/projects/get-projects-slug) | Get full project details by slug |
| `DELETE` | [`/projects/{slug}`](/api/projects/delete-projects-slug) | Delete a project |
| `PUT` | [`/projects/{id}`](/api/projects/put-projects-id) | Update project by ID |
