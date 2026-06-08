const normalizeSlugInput = (value, { maxLength = 30 } = {}) => String(value ?? "").toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, maxLength);

const validateSlug = (value, { minLength = 4, maxLength = 30, allowLegacy = false } = {}) => {
    const normalized = normalizeSlugInput(value, { maxLength });

    if(!normalized) {
        return { valid: false, normalized, reason: "required" };
    }

    if(allowLegacy) {
        return { valid: true, normalized, reason: null };
    }

    if(normalized.length < minLength) {
        return { valid: false, normalized, reason: "too_short" };
    }

    if(normalized.length > maxLength) {
        return { valid: false, normalized, reason: "too_long" };
    }

    if(normalized.includes("modifold")) {
        return { valid: false, normalized, reason: "reserved_word" };
    }

    if(normalized.endsWith("-")) {
        return { valid: false, normalized, reason: "trailing_hyphen" };
    }

    if(normalized.startsWith("-")) {
        return { valid: false, normalized, reason: "leading_hyphen" };
    }

    if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalized)) {
        return { valid: false, normalized, reason: "invalid_format" };
    }

    return { valid: true, normalized, reason: null };
};

const getSlugValidationMessage = (reason) => {
    switch(reason) {
    case "required":
        return "Slug is required";
    case "too_short":
        return "Slug must be at least 4 characters";
    case "too_long":
        return "Slug must be 30 characters or fewer";
    case "reserved_word":
        return 'Slug cannot contain "modifold"';
    case "trailing_hyphen":
        return "Slug cannot end with a hyphen";
    case "leading_hyphen":
        return "Slug cannot start with a hyphen";
    case "invalid_format":
    default:
        return "Slug can contain only English letters, numbers, and single hyphens between words";
    }
};

module.exports = {
    normalizeSlugInput,
    validateSlug,
    getSlugValidationMessage,
};