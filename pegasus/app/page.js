import { getLocale, getTranslations } from "next-intl/server";
import { cookies } from "next/headers";
import HomePage from "@/components/pages/HomePage";
import fs from "fs/promises";
import path from "path";
import matter from "gray-matter";

export const revalidate = 60;

const apiBase = process.env.API_BASE || process.env.NEXT_PUBLIC_API_BASE;

export async function generateMetadata() {
    const resolvedLocale = await getLocale();
    const t = await getTranslations({ locale: resolvedLocale, namespace: "HomePage" });

    return {
        title: t("title"),
        description: t("description"),
    };
}

async function loadNews(locale) {
	const newsDir = path.join(process.cwd(), "data", "news");
	const files = await fs.readdir(newsDir);
	const entries = await Promise.all(files.filter((file) => file.endsWith(".md")).map(async (file) => {
		const fileContent = await fs.readFile(path.join(newsDir, file), "utf-8");
		const { data } = matter(fileContent);
		return { file, data };
	}));
	const newsBySlug = new Map();

	entries.forEach((entry) => {
		const slugEntries = newsBySlug.get(entry.data.slug) || [];
		slugEntries.push(entry);
		newsBySlug.set(entry.data.slug, slugEntries);
	});

	return Array.from(newsBySlug.values()).map((candidates) => {
		let fileData = candidates.find((candidate) => candidate.file.endsWith(`-${locale}.md`));
		if(!fileData && locale !== "en") {
			fileData = candidates.find((candidate) => candidate.file.endsWith("-en.md"));
		}

		if(!fileData) {
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
	}).filter((item) => item && item.hiddenFromFeed !== true).sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 3);
}

async function fetchDiscoverData() {
	if(!apiBase) {
		return null;
	}

	try {
		const response = await fetch(`${apiBase}/v2/discover`, {
			next: { revalidate: 60 },
		});

		if(!response.ok) {
			console.error("Failed to fetch homepage discover data:", response.status);
			return null;
		}

		return await response.json();
	} catch (error) {
		console.error("Failed to fetch homepage discover data:", error);
		return null;
	}
}

export default async function Page() {
	const resolvedLocale = await getLocale();
	const [news, discoverData, cookieStore] = await Promise.all([
		loadNews(resolvedLocale),
		fetchDiscoverData(),
		cookies(),
	]);
	const authToken = cookieStore.get("authToken")?.value || null;

	return <HomePage news={news} locale={resolvedLocale} discoverData={discoverData} authToken={authToken} />;
}