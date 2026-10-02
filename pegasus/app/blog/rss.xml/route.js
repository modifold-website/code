import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeRaw from "rehype-raw";
import rehypeStringify from "rehype-stringify";
import sanitizeHtml from "sanitize-html";
import { getNewsIndex, getNewsArticle } from "@/utils/news/server";

export const dynamic = "force-static";
export const revalidate = 300;

const markdown = unified().use(remarkParse).use(remarkGfm).use(remarkRehype, { allowDangerousHtml: true }).use(rehypeRaw).use(rehypeStringify);
const escapeXml = (value) => String(value ?? "").replace(/[<>&"']/g, (character) => ({
	"<": "&lt;",
	">": "&gt;",
	"&": "&amp;",
	'"': "&quot;",
	"'": "&apos;",
}[character]));
const cdata = (value) => `<![CDATA[${String(value ?? "").replaceAll("]]>", "]]]]><![CDATA[>")}]]>`;

export async function GET() {
	const { articles } = await getNewsIndex("en");
	const items = await Promise.all(articles.map(async (article) => {
		const url = new URL(article.slug, "https://modifold.com").href;
		const post = await getNewsArticle(article.slug.slice("/blog/".length), "en");
		const html = await markdown.process(post?.content || "");
		const cover = article.image
			? `<img src="${escapeXml(new URL(article.image, url).href)}" alt="${escapeXml(article.title)}">`
			: "";
		const content = sanitizeHtml(cover + String(html), {
			allowedTags: [...sanitizeHtml.defaults.allowedTags, "img"],
			allowedAttributes: {
				...sanitizeHtml.defaults.allowedAttributes,
				img: ["src", "alt", "title"],
			},
			transformTags: {
				a: (tagName, attribs) => ({
					tagName,
					attribs: { ...attribs, ...(attribs.href ? { href: new URL(attribs.href, url).href } : {}) },
				}),
				img: (tagName, attribs) => ({
					tagName,
					attribs: { ...attribs, ...(attribs.src ? { src: new URL(attribs.src, url).href } : {}) },
				}),
			},
		});
		const creators = (Array.isArray(article.author) ? article.author : []).map((author) => `\t\t\t<dc:creator>${escapeXml(author)}</dc:creator>`).join("\n");

		return `\t\t<item>
			<title>${cdata(article.title)}</title>
			<description>${cdata(article.description)}</description>
			<link>${escapeXml(url)}</link>
			<guid isPermaLink="true">${escapeXml(url)}</guid>
			<pubDate>${new Date(article.date).toUTCString()}</pubDate>
			${creators}
			<content:encoded>${cdata(content)}</content:encoded>
		</item>`;
	}));
	const lastBuildDate = articles.length > 0
		? `\n\t\t<lastBuildDate>${new Date(articles[0].date).toUTCString()}</lastBuildDate>`
		: "";
	const xml = `<?xml version="1.0" encoding="UTF-8"?>
		<rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:atom="http://www.w3.org/2005/Atom">
			<channel>
				<title>Modifold Blog</title>
				<description>Latest news and updates from Modifold.</description>
				<link>https://modifold.com/blog</link>
				<language>en</language>${lastBuildDate}
				<atom:link href="https://modifold.com/blog/rss.xml" rel="self" type="application/rss+xml" />
				${items.join("\n")}
			</channel>
		</rss>
	`;

	return new Response(xml, {
		headers: {
			"Content-Type": "application/xml; charset=utf-8",
			"Cache-Control": "public, max-age=300, s-maxage=300",
		},
	});
}