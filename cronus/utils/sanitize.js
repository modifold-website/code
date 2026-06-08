const sanitizeHtml = require("sanitize-html");

const CONTROL_CHARS_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const TAG_RE = /<[^>]*>/g;
const LEGACY_HTML_ENTITY_RE = /&(lt|gt|amp|quot|#39);/i;

const normalizeString = (value) => String(value ?? "").replace(/\r\n?/g, "\n").replace(CONTROL_CHARS_RE, "");

const escapeHtml = (value) => normalizeString(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const PROJECT_DESCRIPTION_SANITIZE_OPTIONS = {
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

const sanitizePlainText = (value, { preserveNewlines = false } = {}) => {
    if(value === undefined || value === null) {
        return value;
    }

    let next = normalizeString(value).replace(TAG_RE, "");
    if(preserveNewlines) {
        next = next.split("\n").map((line) => line.trimEnd()).join("\n").trim();
    } else {
        next = next.replace(/\s+/g, " ").trim();
    }

    return next;
};

const sanitizeMarkdownText = (value) => {
    if(value === undefined || value === null) {
        return value;
    }

    const normalized = normalizeString(value);
    const decoded = LEGACY_HTML_ENTITY_RE.test(normalized) ? decodeLegacyEscapedHtml(normalized) : normalized;

    return sanitizeHtml(decoded, PROJECT_DESCRIPTION_SANITIZE_OPTIONS).trim();
};

const sanitizeExternalUrl = (value) => {
    if(typeof value !== "string") {
        return null;
    }

    const raw = value.trim();
    if(!raw) {
        return null;
    }

    try {
        const parsed = new URL(raw);
        if(parsed.protocol !== "https:" && parsed.protocol !== "http:") {
            return null;
        }

        return parsed.toString();
    } catch {
        return null;
    }
};

const sanitizeSocialLinks = (links) => {
    if(!links || typeof links !== "object" || Array.isArray(links)) {
        return {};
    }

    const sanitized = {};
    for(const [key, value] of Object.entries(links)) {
        if(typeof key !== "string") {
            continue;
        }

        const normalizedKey = key.trim();
        if(!normalizedKey) {
            continue;
        }

        const safeUrl = sanitizeExternalUrl(value);
        if(safeUrl) {
            sanitized[normalizedKey] = safeUrl;
        }
    }

    return sanitized;
};

module.exports = {
    escapeHtml,
    sanitizePlainText,
    sanitizeMarkdownText,
    sanitizeExternalUrl,
    sanitizeSocialLinks,
};