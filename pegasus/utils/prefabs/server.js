import { cache } from "react";

const serverApiBase = process.env.API_BASE || process.env.NEXT_PUBLIC_API_BASE;

export const getPrefabPreviewBySlug = cache(async (slug) => {
	if(!slug) {
		return null;
	}

	try {
		const response = await fetch(`${serverApiBase}/v2/prefabs/${encodeURIComponent(slug)}/preview`, {
			headers: { Accept: "application/json" },
			cache: "no-store",
		});
		if(!response.ok) {
			return null;
		}

		const preview = await response.json();
		return typeof preview?.url === "string" && preview.url ? preview : null;
	} catch {
		return null;
	}
});