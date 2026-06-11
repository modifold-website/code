---
title: Overview
description: User profile, public project lists, and account management endpoints.
order: 0
---

## Endpoints

| Method | Path | Summary |
| --- | --- | --- |
| `PUT` | [`/users/me`](/api/users/put-users-me) | Update current user's profile |
| `GET` | [`/users/{username}/projects`](/api/users/get-users-username-projects) | Get paginated list of user's approved projects |
| `GET` | [`/users/{username}`](/api/users/get-users-username) | Get public user profile by username/slug |
| `DELETE` | [`/users/me`](/api/users/delete-users-me) | Delete current user account |
