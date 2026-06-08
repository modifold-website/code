import sanitizeHtml from "sanitize-html";

const LEGACY_HTML_ENTITY_RE = /&(lt|gt|amp|quot|#39);/i;

export const PROJECT_DESCRIPTION_SANITIZE_OPTIONS = {
    allowedTags: [
        "a",
        "img",
        "br",
        "hr",
        "p",
        "div",
        "span",
        "strong",
        "b",
        "em",
        "i",
        "u",
        "s",
        "del",
        "blockquote",
        "code",
        "pre",
        "ul",
        "ol",
        "li",
        "table",
        "thead",
        "tbody",
        "tr",
        "th",
        "td",
        "h1",
        "h2",
        "h3",
        "h4",
        "h5",
        "h6",
    ],
    allowedAttributes: {
        a: ["href", "title"],
        img: ["src", "alt", "title", "width", "height"],
        th: ["colspan", "rowspan", "align"],
        td: ["colspan", "rowspan", "align"],
        p: ["align"],
        div: ["align"],
        span: ["align"],
        h1: ["align"],
        h2: ["align"],
        h3: ["align"],
        h4: ["align"],
        h5: ["align"],
        h6: ["align"],
    },
    allowedSchemes: ["http", "https", "mailto"],
    allowedSchemesByTag: {
        img: ["http", "https"],
    },
    allowProtocolRelative: false,
};

const decodeLegacyEscapedHtml = (value) => value.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\"").replace(/&#39;/g, "'").replace(/&amp;/g, "&");

export const getSafeMarkdownHref = (href) => {
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

export const getSafeMarkdownImageSrc = (src) => {
    if(typeof src !== "string") {
        return null;
    }

    if(src.startsWith("/")) {
        return src;
    }

    try {
        const parsed = new URL(src);
        if(!["http:", "https:"].includes(parsed.protocol)) {
            return null;
        }

        const allowedHostnames = new Set([
            "imgur.com",
            "i.imgur.com",
            "github.com",
            "raw.githubusercontent.com",
            "img.shields.io",
            "i.postimg.cc",
            "wsrv.nl",
            "cf.way2muchnoise.eu",
            "bstats.org",
            "hstats.dev",
            "api.hstats.dev",
            "staging-api.modifold.com",
            "api.modifold.com",
        ]);

        if(allowedHostnames.has(parsed.hostname)) {
            return parsed.toString();
        }

        return `https://api.modifold.com/media/markdown-image?url=${encodeURIComponent(parsed.toString())}`;
    } catch {
        return null;
    }
};

export const prepareProjectDescriptionMarkdown = (value) => {
    const raw = typeof value === "string" ? value : "";
    const normalized = LEGACY_HTML_ENTITY_RE.test(raw) ? decodeLegacyEscapedHtml(raw) : raw;
    return sanitizeHtml(normalized, PROJECT_DESCRIPTION_SANITIZE_OPTIONS).trim();
};