import { getLocale, getTranslations } from "next-intl/server";
import NewsPage from "@/components/pages/NewsPage";
import fs from "fs/promises";
import path from "path";
import matter from "gray-matter";

export async function generateMetadata() {
    const resolvedLocale = await getLocale();
    const t = await getTranslations({ locale: resolvedLocale, namespace: "NewsPage" });

    return {
        title: `${t("title")} — Modifold`,
    };
}

export default async function Page() {
    const resolvedLocale = await getLocale();
    const newsDir = path.join(process.cwd(), "data", "news");

    const files = await fs.readdir(newsDir);

    const newsBySlug = {};
    for(const file of files) {
        if(!file.endsWith(".md")) {
            continue;
        }

        const filePath = path.join(newsDir, file);
        const fileContent = await fs.readFile(filePath, "utf-8");
        const { data } = matter(fileContent);
        const slug = data.slug;

        if(!newsBySlug[slug]) {
            newsBySlug[slug] = [];
        }

        newsBySlug[slug].push({ file, data });
    }

	const news = await Promise.all(
		Object.keys(newsBySlug).map(async (slug) => {
            const candidates = newsBySlug[slug];
            let fileData = candidates.find((c) => c.file.endsWith(`-${resolvedLocale}.md`));
            if(!fileData && resolvedLocale !== "en") {
                fileData = candidates.find((c) => c.file.endsWith("-en.md"));
            }

            if(!fileData) {
                console.log(`No file found for slug ${slug} in locale ${resolvedLocale} or en`);
                return null;
            }

            const { data } = fileData;

			return {
				title: data.title,
				description: data.description,
				date: data.date,
				author: data.author,
				slug: data.slug,
				image: data.image,
				featured: data.featured || false,
				hiddenFromFeed: data.hiddenFromFeed === true || data.hiddenFromFeed === "true",
			};
		})
	);

	const filteredNews = news.filter((item) => item !== null && item.hiddenFromFeed !== true).sort((a, b) => new Date(b.date) - new Date(a.date));

    const featuredArticle = filteredNews.find((article) => article.featured) || filteredNews[0];
    const otherArticles = filteredNews.filter((article) => article !== featuredArticle);

    return <NewsPage featuredArticle={featuredArticle} otherArticles={otherArticles} locale={resolvedLocale} />;
}