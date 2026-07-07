import { cache } from "react";
import fs from "fs/promises";
import path from "path";
import matter from "gray-matter";

const newsDir = path.join(process.cwd(), "data", "news");

const getNewsFiles = cache(async () => {
    const files = await fs.readdir(newsDir);
    return files.filter((file) => file.endsWith(".md"));
});

const getLocalizedFile = (files, slug, locale) => (
    files.find((file) => file.startsWith(`${slug}-${locale}.md`)) ||
    files.find((file) => file.startsWith(`${slug}-en.md`))
);

const getLocalizedEntry = (entries, locale) => (
    entries.find((entry) => entry.file.endsWith(`-${locale}.md`)) ||
    entries.find((entry) => entry.file.endsWith("-en.md"))
);

export const getNewsIndex = cache(async (locale) => {
    const files = await getNewsFiles();
    const entries = await Promise.all(
        files.map(async (file) => {
            const fileContent = await fs.readFile(path.join(newsDir, file), "utf-8");
            const { data } = matter(fileContent);
            return { file, data };
        })
    );
    const newsBySlug = new Map();

    for(const entry of entries) {
        const slug = entry.data?.slug;
        if(!slug) {
            continue;
        }

        if(!newsBySlug.has(slug)) {
            newsBySlug.set(slug, []);
        }

        newsBySlug.get(slug).push(entry);
    }

    const news = Array.from(newsBySlug.values()).map((candidates) => {
        const entry = getLocalizedEntry(candidates, locale);
        if(!entry) {
            return null;
        }

        const { data } = entry;
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
    });

    const articles = news.filter((item) => item !== null && item.hiddenFromFeed !== true).sort((a, b) => new Date(b.date) - new Date(a.date));
    const featuredArticle = articles.find((article) => article.featured) || articles[0] || null;
    const otherArticles = featuredArticle ? articles.filter((article) => article !== featuredArticle) : articles;

    return {
        articles,
        featuredArticle,
        otherArticles,
    };
});

export const getNewsArticle = cache(async (slug, locale) => {
    const files = await getNewsFiles();
    const file = getLocalizedFile(files, slug, locale);

    if(!file) {
        return null;
    }

    const fileContent = await fs.readFile(path.join(newsDir, file), "utf-8");
    const { data, content } = matter(fileContent);

    if(data.slug !== `/news/${slug}`) {
        return null;
    }

    return {
        content,
        data,
        file,
    };
});