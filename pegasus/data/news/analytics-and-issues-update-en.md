---
title: "Analytics and Issues in Modifold"
description: "Modifold now includes player and server charts, plus Issues so your community can share feedback and bug reports right on the project page."
author: ["bogdan"]
date: 2026-04-16
slug: /news/analytics-and-issues-update
image: https://media.modifold.com/news/analytics_2.png
featured: false
locale: en
---

Today we have not one, but two major updates for mod creators: advanced analytics and full Issues support on project pages.

Analytics helps you understand how your mod is actually being used, and Issues helps you collect ideas and bug reports from the community in one place.

## New project analytics

Seeing total downloads is useful, but it is even more important to understand how many people are actually playing with your mod.

We built the **Modifold Analytics Plugin**. After integration, your project on Modifold gets expanded charts for player count and active servers.

The source code is open on GitHub: [modifold-website/analytics](https://github.com/modifold-website/analytics)

### What you get

After integration, you get expanded analytics on the Analytics page. You will see current online players (how many users are playing with your mod right now), a daily player chart, and an active servers chart.

![](https://media.modifold.com/news/606shots_so.png)

### How to add it to your mod

For the demo mod, we used:
- Java 25
- Maven
- Gson

1. Copy `src/main/java/com/modifold/ModifoldAnalytics.java` from [modifold-website/analytics](https://github.com/modifold-website/analytics/blob/main/src/main/java/com/modifold/ModifoldAnalytics.java) into your mod source code.
2. Update the `package` line if your project uses a different package structure.
3. Make sure `Gson` is available in your mod runtime/build.
4. Initialize analytics during your mod/plugin startup (setup/init phase):

```java
new ModifoldAnalytics("your-project-slug", "1.0.0");
```

Replace the placeholders:

- `your-project-slug` - your Modifold project slug
- `1.0.0` - your current mod version

After this, expanded analytics will appear on your project page in [Modifold](https://modifold.com/).

### Embedding the chart in Markdown

If you want, you can also add the chart directly to your project description:

```md
![](https://api.modifold.com/analytics/optimized-somehow/embed)
```

Dark theme:

```md
![](https://api.modifold.com/analytics/optimized-somehow/embed?theme=dark)
```

Here, `optimized-somehow` is your project slug.

![](https://api.modifold.com/analytics/optimized-somehow/embed?theme=dark)

## Issues

Projects on Modifold now have a dedicated **Issues** section.

<div class="video-wrapper mb-8">
    <video autoplay="" loop="" muted="" playsinline="">
        <source src="https://media.modifold.com/news/export-1776350808960.mp4" type="video/mp4">
    </video>
</div>

There, users can:

- suggest new features for your mod
- report bugs and problems
- discuss open Issues in comments

Any user can comment on open Issues. The project author or organization members can manage these Issues by editing, pinning, and closing them when needed.

![](https://media.modifold.com/news/277shots_so.png)

### Project Issues settings

Project settings now include a separate **Issues** section.

![](https://media.modifold.com/news/168shots_so.png)

There you can:

- add new Labels
- edit existing Labels
- create Issues templates (and edit old ones too)

These templates are shown to users when they create a new Issue on your project page.

## End

Thank you for building Modifold with us.