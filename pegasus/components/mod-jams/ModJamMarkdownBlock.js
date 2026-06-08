"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { getSafeMarkdownHref, getSafeMarkdownImageSrc, prepareProjectDescriptionMarkdown } from "@/utils/projectDescriptionContent";

export default function ModJamMarkdownBlock({ children }) {
	return (
		<div className="markdown-body">
			<ReactMarkdown
				remarkPlugins={[remarkGfm]}
				rehypePlugins={[rehypeRaw]}
				components={{
					a: ({ href, children: linkChildren }) => {
						const safeHref = getSafeMarkdownHref(href);
						if(!safeHref) {
							return <>{linkChildren}</>;
						}

						const isExternal = /^https?:\/\//i.test(safeHref);
						return <a href={safeHref} target={isExternal ? "_blank" : undefined} rel={isExternal ? "noopener noreferrer" : undefined}>{linkChildren}</a>;
					},
					img: ({ src, alt, title }) => {
						const safeSrc = getSafeMarkdownImageSrc(src);
						return safeSrc ? <img src={safeSrc} alt={alt || ""} title={title} loading="lazy" /> : null;
					},
				}}
			>
				{prepareProjectDescriptionMarkdown(children || "")}
			</ReactMarkdown>
		</div>
	);
}