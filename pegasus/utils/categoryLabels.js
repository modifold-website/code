export const normalizeCategoryKey = (label) => (
    String(label || "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "")
);

export const getCategoryLabel = (t, label) => {
    const key = normalizeCategoryKey(label);
    if(!key || typeof t !== "function") {
        return label;
    }

    try {
        return t(key);
    } catch (err) {
        return label;
    }
};