import React from "react";
import { getSafeMarkdownHref, getSafeMarkdownImageSizeProps, getSafeMarkdownImageSrc, getSafeMarkdownTextAlignStyle } from "@/utils/projectDescriptionContent";

const renderAlignedBlock = (Tag) => ({ align, children, style }) => (
	<Tag style={getSafeMarkdownTextAlignStyle({ align, style })}>
		{children}
	</Tag>
);

export const projectDescriptionMarkdownComponents = {
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
	img: ({ src, alt, title, width, height }) => {
		const safeSrc = getSafeMarkdownImageSrc(src);
		if(!safeSrc) {
			return null;
		}

		return <img src={safeSrc} alt={alt || ""} title={title} loading="lazy" {...getSafeMarkdownImageSizeProps({ width, height })} />;
	},
	p: renderAlignedBlock("p"),
	div: renderAlignedBlock("div"),
	span: renderAlignedBlock("span"),
	h1: renderAlignedBlock("h1"),
	h2: renderAlignedBlock("h2"),
	h3: renderAlignedBlock("h3"),
	h4: renderAlignedBlock("h4"),
	h5: renderAlignedBlock("h5"),
	h6: renderAlignedBlock("h6"),
};