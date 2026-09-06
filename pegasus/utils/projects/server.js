import { cache } from "react";
import { after } from "next/server";
import { forbidden, notFound } from "next/navigation";
import { cookies } from "next/headers";

const serverApiBase = process.env.API_BASE || process.env.NEXT_PUBLIC_API_BASE;

const getAuthorizedFetchOptions = (authToken, cacheOptions) => authToken ? {
    headers: {
        Accept: "application/json",
        Authorization: `Bearer ${authToken}`,
    },
    cache: "no-store",
} : {
    headers: { Accept: "application/json" },
    ...cacheOptions,
};

export const getProjectTypeTitle = (projectType) => ({
    mod: "Hytale Mod",
    modpack: "Hytale Modpack",
    world: "Hytale World",
	prefab: "Hytale Prefab",
})[projectType] || "Hytale Project";

export const getApplicationCategory = (projectType) => ({
    mod: "Game Mod",
    modpack: "Modpack",
    world: "Game Map",
	prefab: "Game Asset",
})[projectType] || String(projectType || "project").replace("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

export const getProjectBySlug = cache(async (slug, authToken = "", versionsLimit = 100, versionsOffset = 0) => {
	let response;
	const query = new URLSearchParams({
		versions_limit: String(versionsLimit),
		versions_offset: String(versionsOffset),
	});

	try {
		response = await fetch(`${serverApiBase}/projects/${slug}?${query}`, getAuthorizedFetchOptions(authToken, {
			next: { revalidate: 60, tags: [`project:${slug}`] },
		}));
    } catch {
        notFound();
    }

    if(response.status === 403) {
		forbidden();
	}

    if(!response.ok) {
        notFound();
    }

	return response.json();
});

export const getProjectForRequest = cache(async (slug, versionsLimit = 0, versionsOffset = 0) => {
	const cookieStore = await cookies();
	const authToken = cookieStore.get("authToken")?.value || "";
	const project = await getProjectBySlug(slug, authToken, versionsLimit, versionsOffset);

	return { project, authToken };
});

export const recordProjectView = (slug, clientIp) => {
    after(() => {
        fetch(`${serverApiBase}/projects/${slug}/view`, {
            method: "POST",
            headers: {
                ...(clientIp ? { "x-forwarded-for": clientIp } : {}),
            },
            cache: "no-store",
        }).catch(console.error);
    });
};