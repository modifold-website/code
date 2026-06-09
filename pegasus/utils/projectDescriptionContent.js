import sanitizeHtml from "sanitize-html";

const LEGACY_HTML_ENTITY_RE = /&(lt|gt|amp|quot|#39);/i;
const MARKDOWN_IMAGE_DIMENSION_RE = /^\d{1,4}$/;
const SAFE_TEXT_ALIGN_VALUES = new Set(["left", "right", "center", "justify"]);

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
        p: ["align", "style"],
        div: ["align", "style"],
        span: ["align", "style"],
        h1: ["align", "style"],
        h2: ["align", "style"],
        h3: ["align", "style"],
        h4: ["align", "style"],
        h5: ["align", "style"],
        h6: ["align", "style"],
    },
    allowedStyles: {
        p: {
            "text-align": [/^left$/i, /^right$/i, /^center$/i, /^justify$/i],
        },
        div: {
            "text-align": [/^left$/i, /^right$/i, /^center$/i, /^justify$/i],
        },
        span: {
            "text-align": [/^left$/i, /^right$/i, /^center$/i, /^justify$/i],
        },
        h1: {
            "text-align": [/^left$/i, /^right$/i, /^center$/i, /^justify$/i],
        },
        h2: {
            "text-align": [/^left$/i, /^right$/i, /^center$/i, /^justify$/i],
        },
        h3: {
            "text-align": [/^left$/i, /^right$/i, /^center$/i, /^justify$/i],
        },
        h4: {
            "text-align": [/^left$/i, /^right$/i, /^center$/i, /^justify$/i],
        },
        h5: {
            "text-align": [/^left$/i, /^right$/i, /^center$/i, /^justify$/i],
        },
        h6: {
            "text-align": [/^left$/i, /^right$/i, /^center$/i, /^justify$/i],
        },
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

const normalizeMarkdownImageDimension = (value) => {
    if(typeof value !== "string" && typeof value !== "number") {
        return null;
    }

    const normalized = String(value).trim();
    if(!MARKDOWN_IMAGE_DIMENSION_RE.test(normalized)) {
        return null;
    }

    const dimension = Number.parseInt(normalized, 10);
    if(!Number.isSafeInteger(dimension) || dimension < 1 || dimension > 4096) {
        return null;
    }

    return dimension;
};

export const getSafeMarkdownImageSizeProps = ({ width, height } = {}) => {
    const safeWidth = normalizeMarkdownImageDimension(width);
    const safeHeight = normalizeMarkdownImageDimension(height);
    const sizeProps = {};
    const style = {};

    if(safeWidth) {
        sizeProps.width = safeWidth;
        style.width = `${safeWidth}px`;
    }

    if(safeHeight) {
        sizeProps.height = safeHeight;
        style.height = `${safeHeight}px`;
    }

    if(safeWidth || safeHeight) {
        return {
            ...sizeProps,
            style,
        };
    }

    return {};
};

const normalizeMarkdownTextAlign = (value) => {
    if(typeof value !== "string") {
        return null;
    }

    const normalized = value.trim().toLowerCase();
    return SAFE_TEXT_ALIGN_VALUES.has(normalized) ? normalized : null;
};

const getTextAlignFromStyle = (style) => {
    if(!style) {
        return null;
    }

    if(typeof style === "object") {
        return normalizeMarkdownTextAlign(style.textAlign);
    }

    if(typeof style !== "string") {
        return null;
    }

    const declaration = style.split(";").map((part) => part.trim()).find((part) => /^text-align\s*:/i.test(part));

    if(!declaration) {
        return null;
    }

    return normalizeMarkdownTextAlign(declaration.split(":").slice(1).join(":"));
};

export const getSafeMarkdownTextAlignStyle = ({ align, style } = {}) => {
    const textAlign = getTextAlignFromStyle(style) || normalizeMarkdownTextAlign(align);

    if(!textAlign) {
        return undefined;
    }

    return { textAlign };
};

export const prepareProjectDescriptionMarkdown = (value) => {
    const raw = typeof value === "string" ? value : "";
    const normalized = LEGACY_HTML_ENTITY_RE.test(raw) ? decodeLegacyEscapedHtml(raw) : raw;
    return sanitizeHtml(normalized, PROJECT_DESCRIPTION_SANITIZE_OPTIONS).trim();
};