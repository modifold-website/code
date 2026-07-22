export const DEFAULT_GAME_VERSIONS = [];

function normalizeBoolean(value) {
	return value === true || value === 1 || value === "1";
}

function normalizeNumber(value, fallback = 0) {
	const number = Number(value);
	return Number.isFinite(number) ? number : fallback;
}

function compareGameVersionLabels(a, b) {
	return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
}

function createVersionRangeLabel(versions) {
	if(!Array.isArray(versions) || versions.length === 0) {
		return "";
	}

	const sortedVersions = [...versions].sort(compareGameVersionLabels);
	const firstVersion = sortedVersions[0];
	const lastVersion = sortedVersions[sortedVersions.length - 1];

	return firstVersion === lastVersion ? firstVersion : `${firstVersion} - ${lastVersion}`;
}

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
				browse_group_key: typeof item.browse_group_key === "string" ? item.browse_group_key.trim() : "",
				browse_group_label: typeof item.browse_group_label === "string" ? item.browse_group_label.trim() : "",
				browse_group_sort: normalizeNumber(item.browse_group_sort, 0),
				is_browse_default: normalizeBoolean(item.is_browse_default),
				is_browse_visible: item.is_browse_visible === undefined ? true : normalizeBoolean(item.is_browse_visible),
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

export function getBrowseGameVersionGroups(gameVersions = []) {
	const normalizedItems = normalizeGameVersionItemsPayload({ game_versions: gameVersions });
	const groupedByKey = new Map();

	normalizedItems.forEach((item) => {
		if(!item.browse_group_key) {
			return;
		}

		if(!groupedByKey.has(item.browse_group_key)) {
			groupedByKey.set(item.browse_group_key, {
				key: item.browse_group_key,
				label: item.browse_group_label || item.browse_group_key,
				sort_order: item.browse_group_sort,
				versions: [],
				is_browse_default: false,
			});
		}

		const group = groupedByKey.get(item.browse_group_key);
		group.versions.push(item.version);
		group.is_browse_default = group.is_browse_default || item.is_browse_default;

		if(item.browse_group_label) {
			group.label = item.browse_group_label;
		}
	});

	const groups = Array.from(groupedByKey.values()).map((group) => ({
		...group,
		versions: [...new Set(group.versions)].sort((a, b) => compareGameVersionLabels(b, a)),
		range_label: createVersionRangeLabel(group.versions),
	}));

	return groups.filter((group) => group.versions.length > 0).sort((a, b) => {
		if(a.sort_order !== b.sort_order) {
			return b.sort_order - a.sort_order;
		}

		return a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: "base" });
	});
}

export function getDefaultBrowseGameVersions(gameVersions = []) {
	const defaultGroup = getBrowseGameVersionGroups(gameVersions).find((group) => group.is_browse_default);
	return defaultGroup ? defaultGroup.versions : [];
}

export function getEffectiveBrowseGameVersions(selectedGameVersions = [], gameVersions = []) {
	return selectedGameVersions.length > 0 ? selectedGameVersions : getDefaultBrowseGameVersions(gameVersions);
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