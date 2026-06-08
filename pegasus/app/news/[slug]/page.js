const serverApiBase = process.env.API_BASE || process.env.NEXT_PUBLIC_API_BASE;

﻿import { getLocale, getTranslations } from "next-intl/server";
import fs from "fs/promises";
import path from "path";
import matter from "gray-matter";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import Link from "next/link";
import Image from "next/image";
import ShareButtons from "@/components/ui/ShareButtons";

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

export async function generateMetadata({ params }) {
    const { slug } = await params;
    const resolvedLocale = await getLocale();
    const t = await getTranslations({ locale: resolvedLocale, namespace: "NewsPage" });
    const newsDir = path.join(process.cwd(), "data", "news");

    try {
        const files = await fs.readdir(newsDir);
        const file = files.find((f) => f.startsWith(`${slug}-${resolvedLocale}.md`)) || files.find((f) => f.startsWith(`${slug}-en.md`));

        if(!file) {
            return { title: `${t("notFound")} — Modifold` };
        }

        const filePath = path.join(newsDir, file);
        const fileContent = await fs.readFile(filePath, "utf-8");
        const { data } = matter(fileContent);

        if(data.slug !== `/news/${slug}`) {
            return { title: `${t("notFound")} — Modifold` };
        }

        return {
            title: `${data.title} — Modifold`,
            description: data.description || data.title,
            openGraph: {
                title: `${data.title} — Modifold`,
                description: data.description || data.title,
                url: `https://modifold.com${data.slug}`,
                siteName: "Modifold",
                images: data.image ? [
                    {
                        url: data.image,
                        width: 1200,
                        height: 630,
                        alt: data.title,
                    },
                ] : [],
                type: "article",
            },
            twitter: {
                card: "summary_large_image",
                title: `${data.title} — Modifold`,
                description: data.description || data.title,
                creator: "@modifold",
                site: "@modifold",
                images: data.image ? [data.image] : [],
            },
        };
    } catch (error) {
        console.error("Error generating metadata:", error);
        return { title: `${t("notFound")} — Modifold` };
    }
}

export default async function NewsArticle({ params }) {
    const { slug } = await params;
    const resolvedLocale = await getLocale();
    const t = await getTranslations({ locale: resolvedLocale, namespace: "NewsPage" });
    const newsDir = path.join(process.cwd(), "data", "news");

    try {
        const files = await fs.readdir(newsDir);
        const file = files.find((f) => f.startsWith(`${slug}-${resolvedLocale}.md`)) || files.find((f) => f.startsWith(`${slug}-en.md`));

        if(!file) {
            return <div>{t("notFound")}</div>;
        }

        const filePath = path.join(newsDir, file);
        const fileContent = await fs.readFile(filePath, "utf-8");
        const { data, content } = matter(fileContent);

        if(data.slug !== `/news/${slug}`) {
            return <div>{t("notFound")}</div>;
        }

        const authorSlugs = Array.isArray(data.author) ? data.author : [];
        const authors = [];

        if(authorSlugs.length > 0) {
            const results = await Promise.all(
                authorSlugs.map(async (authorSlug) => {
                    try {
						const res = await fetch(`${serverApiBase}/users/${authorSlug}`, {
							cache: "no-store",
						});

                        if(res.ok) {
                            const user = await res.json();
                            if(user.id && user.username && user.slug && user.avatar) {
                                return user;
                            }
                        }
                    } catch (err) {
                        console.error(`Failed to fetch author: ${authorSlug}`, err);
                    }

                    return null;
                })
            );

            authors.push(...results.filter(Boolean));
        }

        const formattedDate = new Date(data.date).toLocaleDateString(resolvedLocale, {
            month: "long",
            day: "numeric",
            year: "numeric",
        });

        const authorCount = authors.length;

        return (
            <div className="layout">
                <section className="news">
                    <Link href="/news">
                        <h2 className="news-title news-title--hover" style={{ borderColor: "var(--theme-sidebar-separator-color-background)", borderStyle: "solid", borderBottomWidth: "1px", paddingBottom: "20px" }}>
                            {t("title")}
                        </h2>
                    </Link>

                    <div className="markdown-body">
                        <h2 className="news-page--title">
                            {data.title}
                        </h2>

                        <span style={{ display: "block", fontSize: "18px", lineHeight: "28px", marginBottom: "20px" }}>
                            {data.description}
                        </span>

                        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px", fontSize: "16px", lineHeight: "24px", marginBottom: "20px" }}>
                            {authorCount > 0 ? (
                                <>
                                    {authors.map((author, index) => (
                                        <span key={author.id} style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                                            {index === authorCount - 1 && authorCount > 1 && <span>{t("byline.and")} </span>}

                                            <Link href={`/user/${author.slug}`} className="news-page--author button--active-transform">
                                                <div style={{ position: "relative", width: "24px", height: "24px", borderRadius: "50%", overflow: "hidden" }}>
                                                    <Image src={author.avatar} alt={author.username} fill style={{ objectFit: "cover" }} unoptimized />
                                                </div>

                                                {author.username}
                                            </Link>

                                            {index < authorCount - 1 && authorCount > 2 && <>, </>}
                                        </span>
                                    ))}
                                </>
                            ) : (
                                <span style={{ fontWeight: "500" }}>{t("byline.team")}</span>
                            )}

                            <span>{t("byline.separator")}</span>

                            <time dateTime={data.date}>{formattedDate}</time>
                        </div>

                        <ShareButtons title={data.title} url={`https://modifold.com${data.slug}`} />

                        {data.image && (
                            <div style={{ marginBottom: "24px", borderRadius: "20px", overflow: "hidden" }}>
                                <Image src={data.image} alt={data.title} width={1200} height={630} style={{ width: "100%", height: "auto", display: "block" }} unoptimized />
                            </div>
                        )}

                        <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            rehypePlugins={[rehypeRaw]}
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
                                img: ({ src, alt }) => {
                                    if(typeof src !== "string" || !src.trim()) {
                                        return null;
                                    }

                                    return (
                                        <img
                                            src={src}
                                            alt={alt || ""}
                                            loading="lazy"
                                            style={{ borderRadius: "20px" }}
                                        />
                                    );
                                },
                            }}
                        >
                            {content}
                        </ReactMarkdown>
                    </div>
                </section>
            </div>
        );
    } catch (error) {
        console.error("Error rendering news article:", error);
        return <div>{t("notFound")}</div>;
    }
}