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

    const project = await response.json();

    return {
        ...project,
        owner: await enrichProjectCreator(project.owner, authToken),
    };
});

export const getProjectMembersBySlug = cache(async (slug, authToken = "") => {
    try {
        const response = await fetch(`${serverApiBase}/projects/${slug}/members`, getAuthorizedFetchOptions(authToken, {
            next: { revalidate: 60, tags: [`project:${slug}:members`] },
        }));

        if(response.ok) {
            const members = await response.json();
            return Promise.all((members || []).map((member) => enrichProjectCreator(member, authToken)));
        }
    } catch {}

    return [];
});

const fetchProjectCreatorJson = async (url, options) => {
    try {
        const response = await fetch(url, options);
        if(response.ok) {
            return response.json();
        }
    } catch {}

    return null;
};

const getOrganizationDownloadsTotal = (projects = []) => projects.reduce((total, project) => total + Math.max(0, Number(project?.downloads) || 0), 0);

const enrichProjectCreator = async (creator, authToken = "") => {
    if(!creator || !creator.slug) {
        return creator;
    }

    if(creator.type === "organization") {
        const organizationData = await fetchProjectCreatorJson(`${serverApiBase}/organizations/${creator.slug}`, {
            headers: { Accept: "application/json" },
            next: { revalidate: 60, tags: [`organization:${creator.slug}`] },
        });
        const organization = organizationData?.organization || {};
        const projects = Array.isArray(organizationData?.projects) ? organizationData.projects : [];
        const slug = organization.slug || creator.slug;
        const totalProjects = organizationData ? projects.length : Number(creator.totalProjects || 0);
        const totalDownloads = organizationData ? getOrganizationDownloadsTotal(projects) : Number(creator.totalDownloads || 0);

        return {
            ...creator,
            id: organization.id || creator.id,
            username: organization.name || creator.username,
            slug,
            avatar: organization.icon_url || organization.avatar || creator.avatar,
            type: "organization",
            profile_url: `/organization/${slug}`,
            totalProjects,
            totalDownloads,
        };
    }

    const [userData, projectsData] = await Promise.all([
        fetchProjectCreatorJson(`${serverApiBase}/users/${creator.slug}`, {
            headers: { Accept: "application/json" },
            next: { revalidate: 60, tags: [`user:${creator.slug}`] },
        }),
        fetchProjectCreatorJson(`${serverApiBase}/users/${creator.slug}/projects?page=1&limit=1&sort=downloads`, {
            headers: { Accept: "application/json" },
            next: { revalidate: 60, tags: [`user:${creator.slug}:projects`] },
        }),
    ]);

    const userId = userData?.id || creator.id || creator.user_id || null;
    let subscriptionData = null;

    if(authToken && userId) {
        subscriptionData = await fetchProjectCreatorJson(`${serverApiBase}/subscriptions/${userId}`, {
            headers: {
                Accept: "application/json",
                Authorization: `Bearer ${authToken}`,
            },
            cache: "no-store",
        });
    }

    return {
        ...creator,
        id: userId,
        username: userData?.username || creator.username,
        slug: userData?.slug || creator.slug,
        avatar: userData?.avatar || creator.avatar,
        isVerified: userData?.isVerified ?? creator.isVerified,
        activeProfileBadge: userData?.activeProfileBadge ?? creator.activeProfileBadge,
        type: "user",
        profile_url: `/user/${userData?.slug || creator.slug}`,
        subscribers: Number(userData?.subscribers || 0),
        totalProjects: Number(projectsData?.totalProjects || 0),
        totalDownloads: Number(projectsData?.totalDownloads || 0),
        isSubscribed: Boolean(subscriptionData?.isSubscribed),
        subscriptionId: subscriptionData?.subscriptionId || null,
    };
};

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