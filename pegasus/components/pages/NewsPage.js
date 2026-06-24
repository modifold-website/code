"use client";

import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";

export default function NewsPage({ featuredArticle, otherArticles, locale }) {
    const t = useTranslations("NewsPage");
    const activeLocale = useLocale();

    const dateLocale = locale || activeLocale;
    const formatArticleDate = (dateString) => {
        const date = new Date(dateString);
        const options = {
            month: "long",
            day: "numeric",
        };

        if(date.getFullYear() !== new Date().getFullYear()) {
            options.year = "numeric";
        }

        return date.toLocaleDateString(dateLocale, options);
    };

    return (
        <div className="layout">
            <section className="news">
                <h2 className="news-title">{t("title")}</h2>

                {featuredArticle && (
                    <Link href={featuredArticle.slug} className="featured-article-link">
                        <div className="featured-article">
                            <div className="featured-article-inner button--active-transform">
                                <img src={featuredArticle.image} alt={featuredArticle.title} />

                                <div className="featured-content">
                                    <span className="featured-label">{t("featuredArticle.label")}</span>
                                    <h3 className="featured-heading">{featuredArticle.title}</h3>
                                    <p className="featured-desc">{featuredArticle.description}</p>

                                    <span className="featured-date">
                                        {formatArticleDate(featuredArticle.date)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </Link>
                )}

                <h3 className="more-title">{t("moreTitle")}</h3>

                <div className="articles-grid">
                    {otherArticles.map((article, index) => (
                        <Link key={index} href={article.slug}>
                            <article className="article button--active-transform">
                                <img src={article.image} alt={article.title} />

                                <h4>{article.title}</h4>

                                <p>{article.description}</p>

                                <span>
                                    {formatArticleDate(article.date)}
                                </span>
                            </article>
                        </Link>
                    ))}
                </div>
            </section>
        </div>
    );
}