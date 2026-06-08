import { getLocale, getTranslations } from "next-intl/server";
import { cookies } from "next/headers";
import BrowsePage from "@/components/pages/BrowsePage";
import { fetchGameVersionItems } from "@/utils/gameVersions";

const apiBase = process.env.API_BASE || process.env.NEXT_PUBLIC_API_BASE;

export async function generateMetadata() {
    const resolvedLocale = await getLocale();
    const t = await getTranslations({ locale: resolvedLocale, namespace: "pageTitle" });

    return {
        title: t("mods"),
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
        page,
    };
}

async function fetchActiveModJams() {
    const limit = 100;
    let page = 1;
    let totalPages = 1;
    const modJams = [];

    do {
        const activeModJamsResponse = await fetch(`${apiBase}/mod-jams?status=active&page=${page}&limit=${limit}`, {
            next: { revalidate: 60 },
        });

        if(!activeModJamsResponse.ok) {
            console.error("Failed to fetch active mod jams for browse hero:", activeModJamsResponse.status);
            break;
        }

        const data = await activeModJamsResponse.json();
        modJams.push(...(Array.isArray(data?.mod_jams) ? data.mod_jams : []));
        totalPages = Number.isFinite(Number(data?.totalPages)) ? Number(data.totalPages) : 1;
        page += 1;
    } while(page <= totalPages);

    return modJams;
}

export default async function ModsPage({ searchParams }) {
    const cookieStore = await cookies();
    const resolvedSearchParams = await searchParams;
    const initialState = parseBrowseSearchParams(resolvedSearchParams);
    const initialCardView = cookieStore.get("browse_card_view_mod")?.value === "media" ? "media" : "list";
    const initialRecommendedCollapsed = cookieStore.get("browse_recommended_collapsed_mod")?.value === "1";
    const sortedTags = [...initialState.tags].sort();
    const sortedGameVersions = [...initialState.gameVersions].sort();
    const apiParams = {
        type: "mod",
        sort: initialState.sort,
        search: initialState.search,
        tags: sortedTags.join(","),
        game_versions: sortedGameVersions.join(","),
        page: initialState.page,
        limit: 20,
    };
    const initialApiKey = JSON.stringify(apiParams);
    let initialData = null;
    let initialTags = [];
    let gameVersions = [];
    let recommendedProjects = [];
    let activeModJams = [];

    try {
        const requestParams = new URLSearchParams({
            type: apiParams.type,
            sort: apiParams.sort,
            search: apiParams.search,
            tags: apiParams.tags,
            game_versions: apiParams.game_versions,
            page: String(apiParams.page),
            limit: String(apiParams.limit),
        });

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
            console.error("Failed to fetch mods browse data:", response.status);
        }
    } catch (error) {
        console.error("Failed to fetch mods browse data:", error);
    }

    try {
        const tagsResponse = await fetch(`${apiBase}/tags/mod`, {
            next: { revalidate: 300 },
        });

        if(tagsResponse.ok) {
            const data = await tagsResponse.json();
            initialTags = Array.isArray(data?.tags) ? data.tags : [];
        }
    } catch (error) {
        console.error("Failed to fetch mod tags:", error);
    }

    gameVersions = await fetchGameVersionItems();

    try {
        const recommendedResponse = await fetch(`${apiBase}/recommended?type=mod`, {
            next: { revalidate: 60 },
        });

        if(recommendedResponse.ok) {
            const data = await recommendedResponse.json();
            recommendedProjects = Array.isArray(data?.projects) ? data.projects : [];
        } else {
            console.error("Failed to fetch recommended mods:", recommendedResponse.status);
        }
    } catch (error) {
        console.error("Failed to fetch recommended mods:", error);
    }

    try {
        activeModJams = await fetchActiveModJams();
    } catch (error) {
        console.error("Failed to fetch active mod jams for browse hero:", error);
    }

    return <BrowsePage projectType="mod" initialState={initialState} initialData={initialData} initialCardView={initialCardView} tags={initialTags} gameVersions={gameVersions} recommendedProjects={recommendedProjects} activeModJams={activeModJams} initialRecommendedCollapsed={initialRecommendedCollapsed} />;
}
