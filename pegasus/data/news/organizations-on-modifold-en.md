---
title: "Introducing Organizations"
description: "Organizations on Modifold: shared project ownership, member roles, and publishing under a team identity."
author: ["modifold"]
date: 2026-02-28
slug: /news/organizations-on-modifold
image: https://media.modifold.com/news/organizations banner.png
featured: false
locale: en
---

# Introducing Organizations

Big news: we are shipping **Organizations** on Modifold.

Organizations are built for creators who work together and need shared ownership, clear permissions, and one team identity for publishing.

## TL;DR

- Organizations for team-owned projects
- Invite members by user slug through notifications
- Role-based permissions for organization and project actions
- Attach projects to organizations and publish as a team
- Public visitors see approved projects, while members can also access attached drafts

## Design goals

Most creators do not stay solo forever. As projects grow, shared ownership and access control become essential.

Before this release, teams had to manage ownership and permissions manually across projects. That can work for small teams, but it becomes fragile as they scale.

Organizations solve this by keeping membership, permissions, and publishing in one place.

## Creating an organization

When creating an organization, you can set:

- Name
- Summary
- Icon

After creation, organization settings become your team control center.

![](https://media.modifold.com/news/organization_settings.png)

## Invites and membership

Organizations use slug-based invites.

`Slug` is the profile identifier in the URL. For example, in `https://modifold.com/user/john-doe`, the slug is `john-doe`.

To add a member, enter their slug. They receive a notification and can accept or decline right away.

This keeps onboarding quick without external invite links or manual access handoffs.

## Roles and permissions

Each member can have role-based permissions for:

- Organization management actions
- Project-level actions

This gives teams precise control over who manages settings, maintains projects, and publishes updates.

![](https://media.modifold.com/news/organization_settings_members.png)

## Project ownership and visibility

Projects can now be attached to an organization and shown on the organization page.

Visibility rules:

- Public visitors: approved projects only
- Signed-in organization members: approved projects plus attached drafts

This lets teams safely coordinate unpublished work while keeping public pages clean.

## For solo creators

Nothing changes for solo creators. Organizations are optional.

You can keep publishing as before and adopt organizations when your project becomes a team effort.

## What is next

This is the first release of Organizations. We will keep improving it based on community feedback.

Thanks for building on Modifold.