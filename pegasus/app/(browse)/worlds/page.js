import { getLocale, getTranslations } from "next-intl/server";
import { cookies } from "next/headers";
import BrowsePage from "@/components/pages/BrowsePage";
import { fetchGameVersionItems, getEffectiveBrowseGameVersions } from "@/utils/gameVersions";

const apiBase = process.env.API_BASE || process.env.NEXT_PUBLIC_API_BASE;

export async function generateMetadata() {
    const resolvedLocale = await getLocale();
    const t = await getTranslations({ locale: resolvedLocale, namespace: "pageTitle" });

    return {
        title: t("worlds"),
    };
}

function parseBrowseSearchParams(searchParams) {
    const fromObject = (key) => {
        const value = searchParams?.[key];
        if(Array.isArray(value)) {
            return value.filter(Boolean).map((item) => String(item));
        }

        if(value === null || value === undefined || value === "") {
            return [];
        }

        return [String(value)];
    };

    const fromUrlSearchParams = (key) => searchParams instanceof URLSearchParams ? searchParams.getAll(key).filter(Boolean) : [];

    const getValues = (key) => {
        const values = fromUrlSearchParams(key);
        return values.length > 0 ? values : fromObject(key);
    };

    const tags = getValues("c");
    const gameVersions = getValues("v");
    const useDefaultGameVersions = gameVersions.length === 0 && getValues("versions")[0] !== "all";
    const search = getValues("q")[0] || "";
    const sortCandidate = getValues("sort")[0] || "";
    const sort = ["downloads", "recent", "updated"].includes(sortCandidate) ? sortCandidate : "downloads";
    const parsedPage = Number.parseInt(getValues("page")[0] || "", 10);
    const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;

    return {
        sort,
        search,
        tags,
        gameVersions,
        useDefaultGameVersions,
        page,
    };
}

export default async function WorldsPage({ searchParams }) {
    const cookieStore = await cookies();
    const resolvedSearchParams = await searchParams;
    const initialState = parseBrowseSearchParams(resolvedSearchParams);
    const initialCardView = cookieStore.get("browse_card_view_world")?.value === "media" ? "media" : "list";
    const sortedTags = [...initialState.tags].sort();
    const gameVersions = await fetchGameVersionItems();
    const effectiveGameVersions = getEffectiveBrowseGameVersions(initialState.gameVersions, gameVersions, { useDefault: initialState.useDefaultGameVersions });
    const sortedGameVersions = [...effectiveGameVersions].sort();
    const apiParams = {
        type: "world",
        sort: initialState.sort,
        search: initialState.search,
        tags: sortedTags.join(","),
        page: initialState.page,
        limit: 20,
    };
    if(sortedGameVersions.length > 0) {
        apiParams.game_versions = sortedGameVersions.join(",");
    }
    const initialApiKey = JSON.stringify(apiParams);
    let initialData = null;
    let initialTags = [];

    try {
        const requestParams = new URLSearchParams({
            type: apiParams.type,
            sort: apiParams.sort,
            search: apiParams.search,
            tags: apiParams.tags,
            page: String(apiParams.page),
            limit: String(apiParams.limit),
        });
        if(apiParams.game_versions) {
            requestParams.set("game_versions", apiParams.game_versions);
        }

        const response = await fetch(`${apiBase}/projects?${requestParams.toString()}`, {
            next: { revalidate: 60 },
        });

        if(response.ok) {
            const data = await response.json();
            initialData = {
                projects: data.projects || [],
                totalPages: data.totalPages || 1,
                apiKey: initialApiKey,
                timestamp: Date.now(),
            };
        } else {
            console.error("Failed to fetch worlds browse data:", response.status);
        }
    } catch (error) {
        console.error("Failed to fetch worlds browse data:", error);
    }

    try {
        const tagsResponse = await fetch(`${apiBase}/tags/world`, {
            next: { revalidate: 300 },
        });
        if(tagsResponse.ok) {
            const data = await tagsResponse.json();
            initialTags = Array.isArray(data?.tags) ? data.tags : [];
        }
    } catch (error) {
        console.error("Failed to fetch world tags:", error);
    }

    return <BrowsePage projectType="world" initialState={initialState} initialData={initialData} initialCardView={initialCardView} tags={initialTags} gameVersions={gameVersions} />;
}