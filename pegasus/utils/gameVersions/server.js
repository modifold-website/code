import "server-only";

import { getServerApiBase, serverApiFetch } from "@/utils/api/server";
import { DEFAULT_GAME_VERSIONS, normalizeGameVersionItemsPayload } from "@/utils/gameVersions";

const fallbackGameVersions = () => DEFAULT_GAME_VERSIONS.map((version) => ({ version, version_type: "release" }));

export async function fetchGameVersionItems() {
	try {
		const response = await serverApiFetch(`${getServerApiBase()}/tags/game-versions`, {
			next: { revalidate: 300 },
		});

		if(!response.ok) {
			return fallbackGameVersions();
		}

		const data = await response.json();
		const versions = normalizeGameVersionItemsPayload(data);
		return versions.length > 0 ? versions : fallbackGameVersions();
	} catch (error) {
		console.error("Failed to fetch game versions:", error);
		return fallbackGameVersions();
	}
}

export async function fetchGameVersions() {
	const items = await fetchGameVersionItems();
	return items.map((item) => item.version);
}