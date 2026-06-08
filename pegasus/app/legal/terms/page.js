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
# Terms of Use

**Last modified: February 26, 2026**

## 1. Scope of These Terms

These Terms of Use ("Terms") govern your access to and use of **Modifold**, including:
- modifold.com
- api.modifold.com
- related web pages, APIs, and platform features (collectively, the "Service")

By accessing or using the Service, you agree to these Terms and our [Privacy Policy](/legal/privacy). If you do not agree, do not use the Service.

## 2. Eligibility

You must be at least **13 years old** to use the Service.

By using the Service, you represent that:
- you can lawfully agree to these Terms;
- your use of the Service is not prohibited by applicable law; and
- any information you provide to us is accurate and reasonably up to date.

## 3. Changes to the Service or Terms

We may update these Terms from time to time. If we make material changes, we may provide notice through the website, your account, or email when practical.

Your continued use of the Service after updated Terms are posted means you accept the updated Terms.

We may also change, suspend, or discontinue parts of the Service at any time.

## 4. Compliance With Applicable Laws (Including Belarus)

Modifold is operated for an international audience. Our owner and part of our team are located in the **Republic of Belarus**, and we aim to operate the Service in compliance with applicable laws, including where relevant the laws of Belarus, as well as other laws applicable to our users and operations.

You are responsible for complying with laws that apply to you based on your location and how you use the Service.

## 5. Accounts and Security

Some features require an account.

You are responsible for:
- maintaining the confidentiality of your account credentials;
- activity that occurs under your account (except where caused by our failure to secure the Service);
- notifying us promptly at [support@modifold.com](mailto:support@modifold.com) if you suspect unauthorized access.

You must not share your account password with another person.

We may suspend, restrict, or terminate accounts that violate these Terms, applicable law, or our safety/security requirements.

## 6. Project Collaboration, Teams, and Permissions

Modifold may allow project owners or authorized maintainers to invite other registered users to collaborate on projects using roles and permissions.

By using these features, you agree that:
- project owners/maintainers are responsible for granting and revoking access;
- collaborators may act within the permissions assigned to their own accounts;
- account sharing is not an acceptable substitute for permission-based collaboration;
- we may keep audit/security logs of project actions (for example version uploads, edits, deletions, membership changes, and settings changes).

If you invite a collaborator, you represent that you are authorized to grant that access.

## 7. User Content and Project Files

The Service allows users to upload and publish gaming-related content (for example mods, packs, shaders, project files, metadata, and descriptions) ("Project Content").

### 7.1 Ownership

You retain ownership of Project Content you upload, to the extent you own those rights.

### 7.2 License to Modifold

By uploading or publishing Project Content, you grant Modifold a non-exclusive, worldwide, royalty-free license to host, store, reproduce, process, display, distribute, and make available that content solely for operating, improving, securing, and promoting the Service.

This license ends when the content is removed from the Service, except to the extent:
- copies already exist in backups;
- users previously downloaded the content; or
- retention is required for legal, security, or abuse-prevention reasons.

### 7.3 Your Responsibility

You are responsible for Project Content you upload or publish, including ensuring you have the rights necessary to do so.

All content must comply with our [Content Rules](/legal/rules).

## 8. User Contributions (Profiles, Comments, Posts)

If the Service includes comments, profile text, posts, or similar user-submitted content that is not Project Content ("User Contributions"), you remain responsible for that content.

By submitting User Contributions, you grant us a non-exclusive, worldwide, royalty-free license to host, display, reproduce, and distribute them through the Service, subject to your account settings and these Terms.

## 9. Prohibited Conduct

You may not use the Service to:
- violate applicable law or regulations;
- infringe intellectual property, privacy, or other rights;
- upload malware or harmful code;
- interfere with or disrupt the Service;
- scrape or automate access in a way that harms the Service or bypasses restrictions;
- impersonate another person or misrepresent affiliation;
- spam, scam, or distribute abusive, deceptive, or unlawful content;
- attempt unauthorized access to accounts, servers, or systems.

We may investigate and take action against prohibited conduct.

## 10. API Use

If you use api.modifold.com, you must comply with these Terms, our [Privacy Policy](/legal/privacy), our [Content Rules](/legal/rules), and applicable law.

We may set or enforce API limits, authentication requirements, or usage restrictions to protect reliability and security.

We may suspend or revoke API access if your usage creates risk, abuse, or operational issues.

## 11. Intellectual Property of the Service

Except for user-owned content, the Service (including software, design, branding, text, and other platform materials) is owned by Modifold or its licensors and protected by applicable intellectual property laws.

These Terms do not grant you ownership of the Service or our trademarks.

## 12. Moderation, Enforcement, and Removal

We may review, moderate, restrict, remove, or refuse content or accounts when we reasonably believe it is necessary to:
- enforce these Terms or our policies;
- protect users or the Service;
- comply with law or legal process;
- investigate abuse, fraud, or security incidents.

We are not obligated to publish or keep any content on the Service.

## 13. Copyright and Rights Complaints

If you believe content on Modifold infringes your copyright or other rights, contact us at [support@modifold.com](mailto:support@modifold.com) with sufficient information for us to review the complaint.

We may remove or restrict access to content while investigating and may act against repeat infringers.

## 14. Third-Party Links and Services

The Service may contain links to third-party websites or services. We do not control them and are not responsible for their content, policies, or availability.

Your use of third-party services is at your own risk and subject to their terms.

## 15. Disclaimers

The Service is provided on an **"as is"** and **"as available"** basis to the maximum extent permitted by law.

We do not guarantee that the Service will be uninterrupted, secure, error-free, or free from harmful components, and we do not guarantee the accuracy or reliability of user-submitted content.

## 16. Limitation of Liability

To the maximum extent permitted by law, Modifold and its operators, affiliates, and service providers are not liable for indirect, incidental, special, consequential, exemplary, or punitive damages, or for loss of profits, data, goodwill, or business interruption arising from or related to the Service.

To the maximum extent permitted by law, our aggregate liability for claims arising out of or relating to the Service will not exceed the greater of:
- the amount you paid us (if any) in the **3 months** before the event giving rise to the claim; or
- **USD $50**.

Some jurisdictions do not allow certain limitations, so some of the above may not apply to you.

## 17. Indemnification

To the extent permitted by law, you agree to indemnify and hold harmless Modifold and its operators from claims, liabilities, damages, and expenses (including reasonable legal fees) arising from:
- your misuse of the Service;
- your content;
- your violation of these Terms; or
- your violation of applicable law or third-party rights.

## 18. Termination

You may stop using the Service at any time.

We may suspend or terminate your access (in whole or in part) if we reasonably believe:
- you violated these Terms;
- your use creates legal, security, or operational risk; or
- we must do so to comply with law.

Termination does not affect provisions that by their nature should survive (for example licenses already granted for operation of the Service, disclaimers, limitations of liability, and dispute provisions).

## 19. Governing Law and Dispute Resolution

These Terms are governed by the laws of the **State of Delaware, USA**, without regard to conflict of law rules, unless mandatory law in your jurisdiction provides otherwise.

You agree that disputes may be brought in courts located in Delaware, USA, subject to applicable law. We may also seek injunctive or protective relief in any competent jurisdiction where necessary.

## 20. Miscellaneous

### 20.1 Entire Agreement

These Terms and our [Privacy Policy](/legal/privacy) are the entire agreement between you and Modifold regarding the Service.

### 20.2 Severability

If part of these Terms is unenforceable, the remaining parts remain in effect.

### 20.3 Waiver

A failure to enforce any provision is not a waiver of our right to do so later.

### 20.4 Assignment

You may not assign these Terms without our consent. We may assign these Terms as part of a reorganization, transfer, or sale of the Service.

## 21. Contact

For support or legal questions, contact: [support@modifold.com](mailto:support@modifold.com)
`;

const contentRulesRU = `
# Условия использования

**Последнее изменение: 26 февраля 2026**

## 1. Сфера действия Условий

Настоящие Условия использования (далее — «Условия») регулируют ваш доступ и использование **Modifold**, включая:
- modifold.com
- api.modifold.com
- связанные веб-страницы, API и функции платформы (совместно — «Сервис»)

Используя Сервис, вы соглашаетесь с настоящими Условиями и нашей [Политикой конфиденциальности](/legal/privacy). Если вы не согласны, не используйте Сервис.

## 2. Требования к пользователю

Для использования Сервиса вам должно быть не менее **13 лет**.

Используя Сервис, вы подтверждаете, что:
- вправе заключать обязательные для вас соглашения;
- использование Сервиса не запрещено применимым законодательством;
- предоставляемая вами информация является точной и по возможности актуальной.

## 3. Изменения Условий и Сервиса

Мы можем время от времени обновлять настоящие Условия. При существенных изменениях мы можем уведомлять пользователей через сайт, аккаунт или электронную почту, если это практически возможно.

Продолжение использования Сервиса после публикации обновлённых Условий означает их принятие.

Мы также можем изменять, приостанавливать или прекращать работу отдельных частей Сервиса.

## 4. Соблюдение применимого законодательства (включая Беларусь)

Modifold работает для международной аудитории. Владелец проекта и часть команды находятся в **Республике Беларусь**, и мы стремимся осуществлять деятельность Сервиса в соответствии с применимым законодательством, включая, где это применимо, законодательство Республики Беларусь, а также иные нормы, применимые к нашим пользователям и операциям.

Вы несёте ответственность за соблюдение законов, которые применяются к вам с учётом вашего местонахождения и способа использования Сервиса.

## 5. Аккаунты и безопасность

Для части функций требуется аккаунт.

Вы отвечаете за:
- конфиденциальность данных для входа;
- действия, совершаемые через ваш аккаунт (за исключением случаев, вызванных нашей ошибкой в обеспечении безопасности Сервиса);
- своевременное уведомление нас по адресу [support@modifold.com](mailto:support@modifold.com), если вы подозреваете несанкционированный доступ.

Нельзя передавать пароль от аккаунта другим лицам.

Мы можем ограничить, приостановить или прекратить доступ к аккаунту при нарушении Условий, закона или требований безопасности.

## 6. Совместная работа, команды и права доступа

Modifold может позволять владельцам проектов или уполномоченным участникам приглашать других зарегистрированных пользователей для совместной работы с использованием ролей и прав доступа.

Используя такие функции, вы соглашаетесь, что:
- владельцы/поддерживающие участники отвечают за выдачу и отзыв доступа;
- соавторы действуют в рамках прав, назначенных их собственным аккаунтам;
- передача аккаунта не является допустимой заменой системе прав доступа;
- мы можем хранить журналы действий по проекту (например, загрузка, редактирование и удаление версий, изменения участников и настроек) в целях безопасности и аудита.

Если вы приглашаете соавтора, вы подтверждаете, что имеете право предоставить такой доступ.

## 7. Контент пользователя и файлы проектов

Сервис позволяет загружать и публиковать игровой контент (например, моды, паки, шейдеры, файлы проекта, метаданные и описания) (далее — «Контент проекта»).

### 7.1 Право собственности

Вы сохраняете право собственности на Контент проекта в той мере, в какой эти права принадлежат вам.

### 7.2 Лицензия для Modifold

Загружая или публикуя Контент проекта, вы предоставляете Modifold неисключительную, всемирную, безвозмездную лицензию на размещение, хранение, воспроизведение, обработку, отображение, распространение и предоставление такого контента исключительно для работы, улучшения, защиты и развития Сервиса.

Эта лицензия прекращается после удаления контента из Сервиса, кроме случаев, когда:
- копии уже находятся в резервных копиях;
- пользователи ранее скачали контент;
- хранение необходимо по юридическим, защитным или антиабузным причинам.

### 7.3 Ваша ответственность

Вы несёте ответственность за загружаемый и публикуемый Контент проекта, включая наличие необходимых прав.

Весь контент должен соответствовать нашим [Правилам контента](/legal/rules).

## 8. Пользовательские материалы (профили, комментарии, посты)

Если в Сервисе есть комментарии, тексты профиля, посты или иной пользовательский контент, не являющийся Контентом проекта (далее — «Пользовательские материалы»), вы сохраняете ответственность за такой контент.

Публикуя Пользовательские материалы, вы предоставляете нам неисключительную, всемирную, безвозмездную лицензию на их размещение, отображение, воспроизведение и распространение через Сервис в соответствии с настройками аккаунта и настоящими Условиями.

## 9. Запрещённое поведение

Запрещается использовать Сервис для того, чтобы:
- нарушать закон или нормативные требования;
- нарушать права на интеллектуальную собственность, приватность или иные права;
- загружать вредоносный код;
- мешать работе Сервиса;
- осуществлять скрейпинг или автоматизированный доступ способом, вредящим Сервису или обходящим ограничения;
- выдавать себя за другое лицо или вводить в заблуждение относительно связи с кем-либо;
- распространять спам, мошеннический, оскорбительный, незаконный или вводящий в заблуждение контент;
- пытаться получить несанкционированный доступ к аккаунтам, серверам или системам.

Мы можем расследовать такие нарушения и принимать меры.

## 10. Использование API

При использовании api.modifold.com вы обязаны соблюдать настоящие Условия, [Политику конфиденциальности](/legal/privacy), [Правила контента](/legal/rules) и применимое законодательство.

Мы можем вводить лимиты API, требования к аутентификации и иные ограничения для обеспечения надёжности и безопасности.

Мы можем приостановить или отозвать доступ к API, если использование создаёт риск, злоупотребления или операционные проблемы.

## 11. Интеллектуальная собственность Сервиса

За исключением пользовательского контента, Сервис (включая программное обеспечение, дизайн, бренд, тексты и иные материалы платформы) принадлежит Modifold или его лицензиарам и защищён применимым законодательством об интеллектуальной собственности.

Настоящие Условия не передают вам право собственности на Сервис или наши товарные знаки.

## 12. Модерация, применение правил и удаление

Мы можем проверять, модерировать, ограничивать, удалять или отклонять контент и аккаунты, если разумно считаем это необходимым для:
- соблюдения настоящих Условий и наших правил;
- защиты пользователей или Сервиса;
- соблюдения закона или юридических требований;
- расследования злоупотреблений, мошенничества или инцидентов безопасности.

Мы не обязаны публиковать или хранить какой-либо контент на Сервисе.

## 13. Жалобы на нарушение прав

Если вы считаете, что контент на Modifold нарушает ваши авторские или иные права, напишите на [support@modifold.com](mailto:support@modifold.com) и предоставьте достаточно информации для проверки.

Мы можем удалить или ограничить доступ к контенту на время проверки и принимать меры в отношении повторных нарушителей.

## 14. Ссылки и сторонние сервисы

Сервис может содержать ссылки на сторонние сайты и сервисы. Мы их не контролируем и не несем ответственности за их содержимое, политики или доступность.

Использование сторонних сервисов осуществляется вами на свой риск и по их правилам.

## 15. Отказ от гарантий

Сервис предоставляется по принципу **«как есть»** и **«как доступно»** в максимальной степени, допустимой законом.

Мы не гарантируем бесперебойную, безопасную и безошибочную работу Сервиса, отсутствие вредоносных компонентов, а также точность или надёжность пользовательского контента.

## 16. Ограничение ответственности

В максимальной степени, допустимой законом, Modifold, его операторы, аффилированные лица и поставщики услуг не несут ответственности за косвенные, случайные, специальные, последующие, штрафные убытки, а также за упущенную выгоду, потерю данных, деловой репутации или перерывы в деятельности, связанные с Сервисом.

В максимальной степени, допустимой законом, совокупная ответственность по требованиям, связанным с Сервисом, не превышает большей из сумм:
- суммы, уплаченной вами нам (если таковая была) за **3 месяца** до события, вызвавшего требование; или
- **50 долларов США**.

В некоторых юрисдикциях часть ограничений может не применяться.

## 17. Возмещение убытков

В пределах, допустимых законом, вы обязуетесь возмещать и защищать Modifold и его операторов от претензий, обязательств, убытков и расходов (включая разумные юридические расходы), возникающих из-за:
- неправомерного использования Сервиса;
- вашего контента;
- нарушения настоящих Условий;
- нарушения закона или прав третьих лиц.

## 18. Прекращение доступа

Вы можете прекратить использование Сервиса в любое время.

Мы можем приостановить или прекратить ваш доступ (полностью или частично), если разумно считаем, что:
- вы нарушили настоящие Условия;
- использование создаёт юридический, технический или операционный риск;
- это требуется по закону.

Прекращение доступа не затрагивает положения, которые по своей природе должны продолжать действовать (например, лицензии для работы Сервиса, отказ от гарантий, ограничение ответственности и положения о спорах).

## 19. Применимое право и споры

Настоящие Условия регулируются законодательством **штата Делавэр, США**, без учёта коллизионных норм, если иное не требуется императивным правом вашей юрисдикции.

Вы соглашаетесь, что споры могут рассматриваться судами в штате Делавэр, США, с учётом применимого законодательства. Мы также вправе обращаться за обеспечительными мерами в любой компетентный суд при необходимости.

## 20. Прочие положения

### 20.1 Полное соглашение

Настоящие Условия и наша [Политика конфиденциальности](/legal/privacy) составляют полное соглашение между вами и Modifold относительно Сервиса.

### 20.2 Делимость положений

Если какое-либо положение окажется неисполнимым, остальные положения сохраняют силу.

### 20.3 Отказ от прав

Неприменение какого-либо положения не означает отказ от права применить его позже.

### 20.4 Передача прав и обязанностей

Вы не можете передавать свои права и обязанности по этим Условиям без нашего согласия. Мы можем передать их в рамках реорганизации, передачи или продажи Сервиса.

## 21. Контакты

По вопросам поддержки и правовым вопросам: [support@modifold.com](mailto:support@modifold.com)
`;

export default function TermsOfUse() {
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