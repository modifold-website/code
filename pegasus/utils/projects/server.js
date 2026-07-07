import { cache } from "react";
import { after } from "next/server";
import { notFound } from "next/navigation";

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
})[projectType] || "Hytale Project";

export const getApplicationCategory = (projectType) => ({
    mod: "Game Mod",
    modpack: "Modpack",
    world: "Game Map",
})[projectType] || String(projectType || "project").replace("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

export const getProjectBySlug = cache(async (slug, authToken = "") => {
    let response;
    try {
        response = await fetch(`${serverApiBase}/projects/${slug}`, getAuthorizedFetchOptions(authToken, {
            next: { revalidate: 60, tags: [`project:${slug}`] },
        }));
    } catch {
        notFound();
    }

    if(!response.ok) {
        notFound();
    }

    return response.json();
});

export const getProjectMembersBySlug = cache(async (slug, authToken = "") => {
    try {
        const response = await fetch(`${serverApiBase}/projects/${slug}/members`, getAuthorizedFetchOptions(authToken, {
            next: { revalidate: 60, tags: [`project:${slug}:members`] },
        }));

        if(response.ok) {
            return response.json();
        }
    } catch {}

    return [];
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