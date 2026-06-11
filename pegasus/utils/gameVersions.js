export const DEFAULT_GAME_VERSIONS = [];

export function normalizeGameVersionItemsPayload(data) {
    const rawVersions = Array.isArray(data?.game_versions) ? data.game_versions : data?.versions;
    const versions = Array.isArray(rawVersions) ? rawVersions : [];

    const normalized = versions.map((item) => {
        if(typeof item === "string") {
            const version = item.trim();
            return version ? { version, version_type: "release" } : null;
        }

        if(item && typeof item.version === "string") {
            const version = item.version.trim();
            return version ? {
                id: item.id,
                version,
                version_type: item.version_type || "release",
            } : null;
        }

        return null;
    }).filter(Boolean);

    const seen = new Set();
    return normalized.filter((item) => {
        if(seen.has(item.version)) {
            return false;
        }

        seen.add(item.version);
        return true;
    });
}

export function normalizeGameVersionsPayload(data) {
    return normalizeGameVersionItemsPayload(data).map((item) => item.version);
}

export async function fetchGameVersionItems() {
    try {
        const apiBase = process.env.API_BASE || process.env.NEXT_PUBLIC_API_BASE;
        const response = await fetch(`${apiBase}/tags/game-versions`, {
            next: { revalidate: 300 },
        });

        if(!response.ok) {
            return DEFAULT_GAME_VERSIONS.map((version) => ({ version, version_type: "release" }));
        }

        const data = await response.json();
        const versions = normalizeGameVersionItemsPayload(data);
        return versions.length > 0 ? versions : DEFAULT_GAME_VERSIONS.map((version) => ({ version, version_type: "release" }));
    } catch (error) {
        console.error("Failed to fetch game versions:", error);
        return DEFAULT_GAME_VERSIONS.map((version) => ({ version, version_type: "release" }));
    }
}

export async function fetchGameVersions() {
    const items = await fetchGameVersionItems();
    return items.map((item) => item.version);
}

export function sortByKnownGameVersions(items, gameVersions = DEFAULT_GAME_VERSIONS) {
    const order = new Map(gameVersions.map((version, index) => [version, index]));

    return [...items].sort((a, b) => {
        const left = order.has(a) ? order.get(a) : Number.MAX_SAFE_INTEGER;
        const right = order.has(b) ? order.get(b) : Number.MAX_SAFE_INTEGER;

        if(left !== right) {
            return left - right;
        }

        return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
    });
}