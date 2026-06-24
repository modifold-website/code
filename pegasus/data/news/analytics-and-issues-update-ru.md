---
title: "Аналитика и Issues в Modifold"
description: "В Modifold появились графики игроков и серверов, а также Issues для сбора фидбека и баг-репортов прямо на странице проекта."
author: ["bogdan"]
date: 2026-04-16
slug: /news/analytics-and-issues-update
image: https://media.modifold.com/news/analytics_2.png
featured: false
locale: ru
---

Сегодня у нас не одно, а сразу два важных обновления для авторов модов: расширенная аналитика и полноценные Issues на странице проекта.

С аналитикой вы лучше понимаете реальное использование мода, а с Issues проще собираете идеи и отчеты о проблемах от сообщества в одном месте.

## Новая аналитика проекта

Видеть число скачиваний мода полезно, но еще важнее понимать, сколько людей реально играет с вашим модом.

Мы сделали **Modifold Analytics Plugin**: после интеграции в проекте на Modifold появятся расширенные графики с количеством игроков и активных серверов.

Исходный код открыт на GitHub: [modifold-website/analytics](https://github.com/modifold-website/analytics)

### Что вы получите

После интеграции, вы получите расширенную аналитику проекта на странице Analytics. Там, будет отображаться текущий онлайн (сколько игроков сейчас играют с вашим модом), график игроков по дням и график активных серверов.

![](https://media.modifold.com/news/606shots_so.png)

### Как добавить в ваш мод

В качестве демонстрационного мода, мы использовали:
- Java 25
- Maven
- Gson

1. Скопируйте файл `src/main/java/com/modifold/ModifoldAnalytics.java` из [modifold-website/analytics](https://github.com/modifold-website/analytics/blob/main/src/main/java/com/modifold/ModifoldAnalytics.java) в исходники вашего мода.
2. При необходимости измените строку `package` под структуру вашего проекта.
3. Убедитесь, что `Gson` доступен в runtime/build вашего мода.
4. Инициализируйте аналитику на старте мода/плагина (этап setup/init):

```java
new ModifoldAnalytics("your-project-slug", "1.0.0");
```

Замените значения:

- `your-project-slug` - slug вашего проекта на Modifold
- `1.0.0` - текущая версия мода

После этого расширенная аналитика появится на странице вашего проекта в [Modifold](https://modifold.com/).

### Встраивание графика в Markdown

Для красоты, вы так же можете добавить график прямо в описание проекта:

```md
![](https://api.modifold.com/analytics/optimized-somehow/embed)
```

Темная тема:

```md
![](https://api.modifold.com/analytics/optimized-somehow/embed?theme=dark)
```

Где `optimized-somehow` - это slug вашего проекта.

![](https://api.modifold.com/analytics/optimized-somehow/embed?theme=dark)

## Issues

У проектов в Modifold теперь есть отдельный раздел **Issues**.

<div class="video-wrapper mb-8">
    <video autoplay="" loop="" muted="" playsinline="">
        <source src="https://media.modifold.com/news/export-1776350808960.mp4" type="video/mp4">
    </video>
</div>

Там пользователи могут:

- предлагать новые функции для вашего мода
- сообщать о проблемах и багах
- обсуждать открытые Issues в комментариях

Комментировать открытые Issues могут любые пользователи. Автор проекта или участники организации могут управлять такими Issues: редактировать их, закреплять и закрывать при необходимости.

![](https://media.modifold.com/news/277shots_so.png)

### Настройки Issues в проекте

В настройках проекта появился отдельный раздел **Issues**.

![](https://media.modifold.com/news/168shots_so.png)

Там можно:

- добавлять новые Labels
- редактировать существующие Labels
- создавать шаблоны Issues (и конечно, редактировать старые)

Эти шаблоны будут предлагаться пользователям при создании нового Issues на странице вашего проекта.

## Конец

Спасибо, что строите Modifold вместе с нами.