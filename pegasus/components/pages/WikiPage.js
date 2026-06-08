"use client";

import React from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { useLocale, useTranslations } from "next-intl";
import MermaidDiagram from "@/utils/MermaidDiagram";
import { getSafeMarkdownHref, getSafeMarkdownImageSrc } from "@/utils/projectDescriptionContent";
import { getProjectBasePath } from "@/utils/projectRoutes";

const renderPages = (pages, basePath, projectSlug, activeSlug, level = 0) => {
    if(!Array.isArray(pages) || pages.length === 0) {
        return null;
    }

    return (
        <ul className={`wiki-pages-list wiki-pages-list--level-${level}`}>
            {pages.map((page, index) => {
                const isActive = activeSlug === page.slug;
                const isFirstTopLevelPage = level === 0 && index === 0;

                return (
                    <li key={page.id}>
                        <Link href={`${basePath}/${projectSlug}/wiki/${page.slug}`} className={`wiki-pages-link ${isActive ? "wiki-pages-link--active" : ""}`} data-ripple>
                            {isFirstTopLevelPage ? (
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-star-icon lucide-star">
                                    <path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"/>
                                </svg>
                            ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-book-open-icon lucide-book-open">
                                    <path d="M12 7v14"/>
                                    <path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/>
                                </svg>
                            )}
                            
                            {page.title}
                        </Link>

                        {Array.isArray(page.children) && page.children.length > 0 && renderPages(page.children, basePath, projectSlug, activeSlug, level + 1)}
                    </li>
                );
            })}
        </ul>
    );
};

export default function WikiPage({ project, authToken, wikiData, wikiError }) {
    const t = useTranslations("ProjectPage");
    const locale = useLocale();
    const basePath = getProjectBasePath(project?.project_type);
    const pageTitle = wikiData?.selected_page?.title || wikiData?.page?.content?.match(/^#\s+(.+)$/m)?.[1] || wikiData?.selected_page_slug || "Wiki";

    const formattedUpdatedAt = wikiData?.mod?.updated_at ? new Intl.DateTimeFormat(locale || undefined, { year: "numeric", month: "short", day: "numeric" }).format(new Date(wikiData.mod.updated_at)) : null;

    return (
        <>
            <div className="project__general project__general--wiki">
                <div>
                    <div className="wiki-shell">
                        <aside className="wiki-left-rail">
                            <div className="content content--padding wiki-contents-card">
                                <h2>{t("contents")}</h2>
                                
                                {renderPages(wikiData?.pages || [], basePath, project.slug, wikiData?.selected_page_slug)}
                            </div>
                        </aside>

                        <section className="wiki-content">
                            <div className="content content--padding wiki-content__header">
                                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                    <svg style={{ fill: "none" }} xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-book-open-icon lucide-book-open">
                                        <path d="M12 7v14"/>
                                        <path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/>
                                    </svg>
                                    
                                    <h1 style={{ fontWeight: "600", fontSize: "20px" }}>{pageTitle}</h1>
                                </div>

                                {formattedUpdatedAt && <p style={{ fontSize: "16px" }}>{t("updated")} {formattedUpdatedAt}</p>}
                            </div>

                            <div className="content content--padding markdown-body wiki-content__body">
                                {wikiError ? (
                                    <p>{wikiError}</p>
                                ) : (
                                    <ReactMarkdown
                                        remarkPlugins={[remarkGfm]}
                                        rehypePlugins={[rehypeRaw]}
                                        components={{
                                            pre: ({ children }) => {
                                                const child = Array.isArray(children) ? children[0] : children;
                                                if(React.isValidElement(child) && typeof child.props?.className === "string" && child.props.className.includes("language-mermaid")) {
                                                    return <>{child}</>;
                                                }

                                                return <pre>{children}</pre>;
                                            },
                                            code: ({ inline, className, children, ...props }) => {
                                                const language = className?.match(/language-(\S+)/)?.[1];
                                                const content = String(children ?? "").replace(/\n$/, "");

                                                if(!inline && language === "mermaid") {
                                                    return <MermaidDiagram code={content} />;
                                                }

                                                return (
                                                    <code className={className} {...props}>
                                                        {children}
                                                    </code>
                                                );
                                            },
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
                                            img: ({ src, alt, title }) => {
                                                const safeSrc = getSafeMarkdownImageSrc(src);
                                                if(!safeSrc) {
                                                    return null;
                                                }

                                                return <img src={safeSrc} alt={alt || ""} title={title} loading="lazy" />;
                                            },
                                        }}
                                    >
                                        {wikiData?.page?.content || ""}
                                    </ReactMarkdown>
                                )}
                            </div>

                            <div className="wiki-powered-by">
                                <span>{t("poweredBy")}</span>
                                
                                <a href="https://wiki.hytalemodding.dev/?utm_source=modifold&utm_medium=link&utm_campaign=wiki-page" target="_blank" style={{ height: "44px" }} rel="noopener noreferrer">
                                    <img src="https://wiki.hytalemodding.dev/banner_transparent_dark.png" alt="HytaleModding" style={{ pointerEvents: "none" }} />
                                </a>
                            </div>
                        </section>
                    </div>
                </div>
            </div>
        </>
    );
}