import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import Tooltip from "@/components/ui/Tooltip";

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
				<div className="news-header">
					<h2 className="news-title">{t("title")}</h2>
					<Tooltip content="RSS Feed">
						<a
							href="/blog/rss.xml"
							target="_blank"
							rel="noopener noreferrer"
							className="news-rss button button--size-m button--type-secondary button--active-transform button--icon-only"
							aria-label={t("rssFeed")}
						>
							<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
								<path d="M4 11a9 9 0 0 1 9 9M4 4a16 16 0 0 1 16 16" />
								<circle cx="5" cy="19" r="1" />
							</svg>
						</a>
					</Tooltip>
				</div>

                {featuredArticle && (
                    <Link prefetch={false} href={featuredArticle.slug} className="featured-article-link">
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
                        <Link prefetch={false} key={index} href={article.slug}>
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