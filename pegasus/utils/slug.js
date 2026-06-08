"use client";

export const SLUG_MAX_LENGTH = 30;
export const SLUG_MIN_LENGTH = 4;

export const normalizeSlugInput = (value, maxLength = SLUG_MAX_LENGTH) => String(value ?? "").toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, maxLength);

export const validateSlug = (value, { currentSlug = "" } = {}) => {
    const normalized = normalizeSlugInput(value);
    const savedSlug = String(currentSlug || "").toLowerCase();
    const isUnchanged = Boolean(normalized && normalized === savedSlug);

    if(!normalized) {
        return { valid: false, normalized, reason: "required" };
    }

    if(isUnchanged) {
        return { valid: true, normalized, reason: null };
    }

    if(normalized.length < SLUG_MIN_LENGTH) {
        return { valid: false, normalized, reason: "too_short" };
    }

    /* forbid using "modifold" in the link name */
    if(normalized.includes("modifold")) {
        return { valid: false, normalized, reason: "reserved_word" };
    }

    if(normalized.startsWith("-")) {
        return { valid: false, normalized, reason: "leading_hyphen" };
    }

    if(normalized.endsWith("-")) {
        return { valid: false, normalized, reason: "trailing_hyphen" };
    }

    if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalized)) {
        return { valid: false, normalized, reason: "invalid_format" };
    }

    return { valid: true, normalized, reason: null };
};