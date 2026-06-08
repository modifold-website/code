"use client";

import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { usePathname } from "next/navigation";
import Link from "next/link";

const getSafeMarkdownHref = (href) => {
    if(typeof href !== "string") {
        return null;
    }

    if(href.startsWith("/") || href.startsWith("#")) {
        return href;
    }

    try {
        const parsed = new URL(href);
        if(!["http:", "https:", "mailto:"].includes(parsed.protocol)) {
            return null;
        }

        return parsed.toString();
    } catch {
        return null;
    }
};

const contentRulesEN = `
# Content Rules

**Last modified: February 18, 2026**

These Content Rules are part of our [Terms of Use](/legal/terms) and apply to all User Contributions, Gaming Content (e.g., mods, modpacks), and use of interactive features (profiles, posts, comments; collectively, "Content") on Modifold (\`modifold.com\` and \`api.modifold.com\`).

If you find violations of these rules, please report them using the **Report** button or email us at [support@modifold.com](mailto:support@modifold.com).

## 1. Prohibited Content

Content must comply with all applicable laws and must not:

- Be defamatory, obscene, indecent, abusive, offensive, harassing, violent, hateful, inflammatory or otherwise objectionable
- Promote sexually explicit or pornographic material, violence, or discrimination based on race, sex, gender, religion, nationality, disability, sexual orientation, or age
- Infringe any patent, trademark, trade secret, copyright, or other intellectual property rights
- Violate the legal rights (e.g., publicity or privacy) of others
- Promote illegal activity or assist unlawful acts
- Contain intentionally false or misleading claims
- Impersonate any person or misrepresent identity/affiliation
- Suggest endorsement by Modifold, Hytale developers or any other entity (unless true)
- Contain excessive profanity
- Upload data to remote servers without clear user disclosure and consent
- Attempt to bypass game restrictions or protections implemented by Hytale developers

## 2. Clear and Honest Description

The project (including its title, avatar, and gallery) must reflect the real functionality or content it adds. Misleading presentation is not allowed.

Every project must clearly and honestly describe:
- What exactly the project does or adds
- Why someone might want to use it
- All important information the user should know before downloading

**Requirements for descriptions:**
- Must have a plain-text version (images/videos are welcome as addition, but cannot replace text)
- Use proper markdown formatting (headers, lists, etc.)
- Main description should be in **English** (additional languages are welcome)

## 3. Cheats, Hacks & Unfair Advantage

Projects must not:
- Be advertised as cheats/hacks
- Provide unfair advantage in multiplayer without server-side opt-out
- Include (but not limited to):
  - X-ray / cave finder
  - Kill aura / aim assist / auto-clicker
  - Flight / speed / no-clip / other movement cheats
  - Item duplication / infinite resources
  - Automatic combat / PvP assistance

Such features are allowed **only** when they are server-side plugins/mods with explicit opt-in.

## 4. Copyright & Re-uploads

- You must own the content or have all necessary rights/permissions
- Direct re-uploads of other people's work without explicit permission are prohibited
- Forks and substantial modifications are allowed if they follow the original license and give proper credit
- We recommend using in-game screenshots or images that accurately show your mod, rather than fully AI-generated visuals

## 5. Good Practices (strongly recommended)

- Fill in all metadata accurately (license, side, tags)
- Use clean project titles (without spam, version numbers, emojis in title)
- Keep short description concise and without formatting
- Specify correct dependencies
- Use "Additional files" only for truly supplementary materials
`;

const contentRulesRU = `
# Правила контента

**Последнее изменение: 18 февраля 2026**

Данные Правила контента являются частью наших [Условий использования](/legal/terms) и распространяются на все пользовательские материалы, игровой контент (моды, модпаки) и интерактивные функции (профили, посты, комментарии) на платформе Modifold.

Нашли нарушение? Используйте кнопку **Пожаловаться** или пишите на [support@modifold.com](mailto:support@modifold.com).

## 1. Запрещённый контент

Контент не должен:
- Быть оскорбительным, непристойным, насильственным, разжигающим ненависть
- Содержать порнографию, призывы к насилию или дискриминацию
- Нарушать авторские права, товарные знаки и другие права интеллектуальной собственности
- Продвигать незаконную деятельность
- Содержать заведомо ложную информацию
- Выдавать себя за других людей/организации
- Создавать впечатление официальной поддержки от Modifold или разработчиков Hytale (если это не так)
- Содержать чрезмерное количество мата
- Загружать данные на сторонние серверы без явного согласия пользователя

## 2. Честное и понятное описание

Проект (включая название, аватар и изображения в галерее) должен отражать реальную функцию или то, что добавляет мод. Вводящие в заблуждение описания и визуалы запрещены.

Каждый проект обязан понятно и честно описывать:
- Что именно делает мод/пак/карта
- Зачем это может быть полезно
- Все важные моменты, которые нужно знать до скачивания

**Требования к описанию:**
- Обязательно текстовый вариант (картинки и видео — только дополнение)
- Основной язык описания — **английский** (другие языки приветствуются дополнительно)

## 3. Читы, хаки и нечестное преимущество

Запрещены проекты, которые:
- Рекламируются как читы/хаки
- Дают нечестное преимущество в мультиплеере без возможности отключения на стороне сервера
- Содержат (но не ограничиваясь):
  - Просмотр сквозь блоки (x-ray)
  - Аимбот, киллаура, авто-кликер
  - Полёт, спидхак, ноклип
  - Дюп предметов
  - Автоматический бой/PvP

Такие функции допустимы **только** в серверных плагинах с явным согласием игроков.

## 4. Авторские права и перезаливы

- Вы должны обладать всеми правами на загружаемый контент
- Прямой перезалив чужих работ без разрешения запрещён
- Форки и значительные переработки допустимы при соблюдении лицензии и указании авторства
- Рекомендуется использовать скриншоты или изображения прямо из игры, которые честно показывают ваш мод, а не полностью сгенерированные ИИ визуалы

## 5. Хорошие практики (настоятельно рекомендуется)

- Заполняйте все поля метаданных (лицензия, сторона, теги)
- Чистое название проекта без спама
- Краткое описание без форматирования
- Указывайте корректные зависимости
- Используйте «Дополнительные файлы» только по назначению
`;

export default function ContentRules() {
    const [lang, setLang] = useState("en");

    const content = lang === "en" ? contentRulesEN : contentRulesRU;

    const pathname = usePathname();
    const isActive = (href) => pathname === href;

    return (
        <div className="layout">
            <div className="page-content settings-page">
                <div className="sidebar">
                    <div className="sidebar__main">
                        <Link href={`/legal/terms`} className={`sidebar-item ${isActive(`/legal/terms`) ? "sidebar-item--active" : ""}`} data-ripple>
                            <svg className="icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true"><path d="M20.42 4.58a5.4 5.4 0 0 0-7.65 0l-.77.78-.77-.78a5.4 5.4 0 0 0-7.65 0C1.46 6.7 1.33 10.28 4 13l8 8 8-8c2.67-2.72 2.54-6.3.42-8.42"></path><path d="M12 5.36 8.87 8.5a2.13 2.13 0 0 0 0 3h0a2.13 2.13 0 0 0 3 0l2.26-2.21a3 3 0 0 1 4.22 0l2.4 2.4M18 15l-2-2M15 18l-2-2"></path></svg>

                            Terms of Use
                        </Link>

                        <Link href={`/legal/rules`} className={`sidebar-item ${isActive(`/legal/rules`) ? "sidebar-item--active" : ""}`} data-ripple>
                            <svg className="icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="m3 6 3 1m0 0-3 9a5 5 0 0 0 6.001 0M6 7l3 9M6 7l6-2m6 2 3-1m-3 1-3 9a5 5 0 0 0 6.001 0M18 7l3 9m-3-9-6-2m0-2v2m0 16V5m0 16H9m3 0h3"></path></svg>

                            Content Rules
                        </Link>

                        <Link href={`/legal/privacy`} className={`sidebar-item ${isActive(`/legal/privacy`) ? "sidebar-item--active" : ""}`} data-ripple>
                            <svg className="icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>

                            Privacy Policy
                        </Link>

                        <Link href={`/legal/copyright`} className={`sidebar-item ${isActive(`/legal/copyright`) ? "sidebar-item--active" : ""}`} data-ripple>
                            <svg className="icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><path d="M15 9.354a4 4 0 1 0 0 5.292"></path></svg>

                            Copyright Policy
                        </Link>
                    </div>
                </div>

                <div className="content content--padding markdown-body">
                    <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                        <button onClick={() => setLang("en")} className={`button button--size-m ${lang === "en" ? "button--type-primary" : "button--type-secondary"}`}>
                            English
                        </button>

                        <button onClick={() => setLang("ru")} className={`button button--size-m ${lang === "ru" ? "button--type-primary" : "button--type-secondary"}`}>
                            Русский
                        </button>
                    </div>

                    <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                            a: ({ href, children }) => {
                                const safeHref = getSafeMarkdownHref(href);
                                if(!safeHref) {
                                    return <>{children}</>;
                                }

                                const isExternal = /^https?:\/\//i.test(safeHref);
                                return (
                                    <a href={safeHref} target={isExternal ? "_blank" : undefined} rel={isExternal ? "noopener noreferrer" : undefined}>
                                        {children}
                                    </a>
                                );
                            },
                        }}
                    >
                        {content}
                    </ReactMarkdown>
                </div>
            </div>
        </div>
    );
}