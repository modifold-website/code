"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import ProjectCard from "../project/ProjectCard";
import ProjectCardMedia from "../project/ProjectCardMedia";
import ProjectCardSkeleton from "../ui/ProjectCardSkeleton";
import ProjectCardMediaSkeleton from "../ui/ProjectCardMediaSkeleton";
import BrowseFiltersSidebar from "./browse/BrowseFiltersSidebar";
import BrowseToolbar from "./browse/BrowseToolbar";
import BrowseRecommendedRail from "./browse/BrowseRecommendedRail";
import { useTranslations } from "next-intl";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { getCategoryLabel } from "@/utils/categoryLabels";

function parseQueryString(queryString) {
    const params = new URLSearchParams(queryString || "");
    const rawSort = params.get("sort");
    const rawPage = Number.parseInt(params.get("page"), 10);

    return {
        tags: params.getAll("c"),
        gameVersions: params.getAll("v"),
        sort: ["downloads", "recent", "updated"].includes(rawSort) ? rawSort : "downloads",
        search: params.get("q") || "",
        page: Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1,
    };
}

function buildQueryString({ sort, search, selectedTags, selectedGameVersions, currentPage }) {
    const params = new URLSearchParams();

    if(search) {
        params.set("q", search);
    }

    if(sort && sort !== "downloads") {
        params.set("sort", sort);
    }

    if(currentPage > 1) {
        params.set("page", String(currentPage));
    }

    [...selectedTags].sort().forEach((tag) => params.append("c", tag));
    [...selectedGameVersions].sort().forEach((version) => params.append("v", version));

    return params.toString();
}

function normalizeInitialState(initialState) {
    return {
        tags: Array.isArray(initialState?.tags) ? initialState.tags : [],
        gameVersions: Array.isArray(initialState?.gameVersions) ? initialState.gameVersions : [],
        sort: ["downloads", "recent", "updated"].includes(initialState?.sort) ? initialState.sort : "downloads",
        search: typeof initialState?.search === "string" ? initialState.search : "",
        page: Number.isFinite(initialState?.page) && initialState.page > 0 ? initialState.page : 1,
    };
}

export default function BrowsePage({ projectType, initialState = null, initialData = null, initialCardView = "list", tags = [], gameVersions = [], recommendedProjects = [], activeModJams = [], initialRecommendedCollapsed = false }) {
    const t = useTranslations("BrowsePage");
    const tLabels = useTranslations("CategoryLabels");
    const router = useRouter();
    const searchParams = useSearchParams();
    const pathname = usePathname();

    const urlQueryString = searchParams.toString();
    const normalizedInitialState = useMemo(() => normalizeInitialState(initialState), [initialState]);
    const hasInitialData = Boolean(initialData?.apiKey);

    const [projects, setProjects] = useState(() => initialData?.projects || []);
    const [sort, setSort] = useState(normalizedInitialState.sort);
    const [search, setSearch] = useState(normalizedInitialState.search);
    const [searchInput, setSearchInput] = useState(normalizedInitialState.search);
    const [selectedTags, setSelectedTags] = useState(normalizedInitialState.tags);
    const [selectedGameVersions, setSelectedGameVersions] = useState(normalizedInitialState.gameVersions);
    const [loading, setLoading] = useState(!hasInitialData);
    const [currentPage, setCurrentPage] = useState(normalizedInitialState.page);
    const [totalPages, setTotalPages] = useState(() => initialData?.totalPages || 1);
    const [cardView, setCardView] = useState(initialCardView === "media" ? "media" : "list");
    const [relativeTimeBase, setRelativeTimeBase] = useState(() => initialData?.timestamp || Date.now());
    const apiCacheRef = useRef(hasInitialData ? new Map([
        [initialData.apiKey, {
            projects: initialData.projects || [],
            totalPages: initialData.totalPages || 1,
            fetchedAt: initialData.timestamp || Date.now(),
        }],
    ]) : new Map());

    useEffect(() => {
        try {
            document.cookie = `browse_card_view_${projectType}=${encodeURIComponent(cardView)}; path=/; max-age=31536000; samesite=lax`;
        } catch {}
    }, [projectType, cardView]);

    useEffect(() => {
        const parsed = parseQueryString(urlQueryString);

        setSelectedTags(parsed.tags);
        setSelectedGameVersions(parsed.gameVersions);
        setSort(parsed.sort);
        setSearch(parsed.search);
        setSearchInput(parsed.search);
        setCurrentPage(parsed.page);
    }, [urlQueryString]);

    useEffect(() => {
        const timer = setTimeout(() => {
            if(search !== searchInput) {
                setCurrentPage(1);
                setSearch(searchInput);
            }
        }, 350);

        return () => clearTimeout(timer);
    }, [searchInput, search]);

    const nextQueryString = useMemo(() => buildQueryString({
        sort,
        search,
        selectedTags,
        selectedGameVersions,
        currentPage,
    }), [sort, search, selectedTags, selectedGameVersions, currentPage]);

    useEffect(() => {
        if(nextQueryString === urlQueryString) {
            return;
        }

        router.replace(`${pathname}${nextQueryString ? `?${nextQueryString}` : ""}`, { scroll: false });
    }, [nextQueryString, urlQueryString, router, pathname]);

    const apiParams = useMemo(() => ({
        type: projectType,
        sort,
        search,
        tags: [...selectedTags].sort().join(","),
        game_versions: [...selectedGameVersions].sort().join(","),
        page: currentPage,
        limit: 20,
    }), [projectType, sort, search, selectedTags, selectedGameVersions, currentPage]);

    const apiKey = useMemo(() => JSON.stringify(apiParams), [apiParams]);

    useEffect(() => {
        const cached = apiCacheRef.current.get(apiKey);
        const now = Date.now();
        const cacheFresh = cached && now - cached.fetchedAt < 30000;

        if(cached) {
            setProjects(cached.projects);
            setTotalPages(cached.totalPages);
            setRelativeTimeBase(cached.fetchedAt);
            setLoading(false);
        } else {
            setLoading(true);
        }

        if(cacheFresh) {
            return;
        }

        const controller = new AbortController();

        const fetchProjects = async () => {
            try {
                const res = await axios.get(`${process.env.NEXT_PUBLIC_API_BASE}/projects`, {
                    params: apiParams,
                    signal: controller.signal,
                });

                const nextProjects = res.data.projects || [];
                const nextTotalPages = res.data.totalPages || 1;
                const fetchedAt = Date.now();

                setProjects(nextProjects);
                setTotalPages(nextTotalPages);
                setRelativeTimeBase(fetchedAt);

                apiCacheRef.current.set(apiKey, {
                    projects: nextProjects,
                    totalPages: nextTotalPages,
                    fetchedAt,
                });
            } catch (err) {
                if(!controller.signal.aborted && !cached) {
                    console.error("Error fetching projects:", err);
                }
            } finally {
                if(!controller.signal.aborted) {
                    setLoading(false);
                }
            }
        };

        fetchProjects();

        return () => {
            controller.abort();
        };
    }, [apiKey, apiParams]);

    const toggleCardView = () => {
        setCardView((prev) => (prev === "media" ? "list" : "media"));
    };

    const toggleTag = (tag) => {
        setSelectedTags((prev) => prev.includes(tag) ? prev.filter((item) => item !== tag) : [...prev, tag]);
        setCurrentPage(1);
    };

    const toggleGameVersion = (version) => {
        setSelectedGameVersions((prev) => prev.includes(version) ? prev.filter((item) => item !== version) : [...prev, version]);
        setCurrentPage(1);
    };

    const clearFilters = () => {
        setSelectedTags([]);
        setSelectedGameVersions([]);
        setSearch("");
        setSearchInput("");
        setSort("downloads");
        setCurrentPage(1);
    };

    const formatCategoryLabel = (tag) => getCategoryLabel(tLabels, tag);

    const handleSortSelect = (sortOption) => {
        setSort(sortOption);
        setCurrentPage(1);
    };

    const handleSearchChange = (event) => {
        setSearchInput(event.target.value);
    };

    const handleClearSearch = () => {
        setSearchInput("");
        setSearch("");
        setCurrentPage(1);
    };

    const scrollToPageTop = () => {
        window.scrollTo({
            top: 0,
            behavior: "smooth",
        });
    };

    const handlePageChange = (nextPage) => {
        const normalizedPage = Math.min(totalPages, Math.max(1, nextPage));

        if(normalizedPage === currentPage) {
            return;
        }

        setCurrentPage(normalizedPage);
        scrollToPageTop();
    };

    const getPageButtons = () => {
        const maxButtons = 10;
        let startPage = Math.max(1, currentPage - Math.floor(maxButtons / 2));
        let endPage = Math.min(totalPages, startPage + maxButtons - 1);

        if(endPage - startPage + 1 < maxButtons) {
            startPage = Math.max(1, endPage - maxButtons + 1);
        }

        const buttons = [];
        for(let i = startPage; i <= endPage; i++) {
            buttons.push(
                <button key={i} className={`button button--size-m pagination-button ${currentPage === i ? "button--type-primary" : "button--type-secondary"}`} onClick={() => handlePageChange(i)} aria-current={currentPage === i ? "page" : undefined}>
                    {i}
                </button>
            );
        }

        return buttons;
    };

    const renderPaginationControls = (style) => {
        if(totalPages <= 1) {
            return null;
        }

        return (
            <div className="pagination-controls" style={style}>
                <button className="button button--size-m button--type-secondary button--icon-only" onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1} aria-disabled={currentPage === 1} aria-label={t("previous")}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-chevron-left-icon lucide-chevron-left">
                        <path d="m15 18-6-6 6-6"/>
                    </svg>
                </button>

                {getPageButtons()}

                <button className="button button--size-m button--type-secondary button--icon-only" onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages} aria-disabled={currentPage === totalPages} aria-label={t("next")}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-chevron-right-icon lucide-chevron-right">
                        <path d="m9 18 6-6-6-6"/>
                    </svg>
                </button>
            </div>
        );
    };

    return (
        <div className="browse-page">
            <BrowseFiltersSidebar t={t} projectType={projectType} tags={tags} selectedTags={selectedTags} onToggleTag={toggleTag} gameVersions={gameVersions} selectedGameVersions={selectedGameVersions} onToggleGameVersion={toggleGameVersion} onClearFilters={clearFilters} getCategoryLabel={formatCategoryLabel} />

            <div className="browse-content">
                {projectType === "mod" && (
                    <BrowseRecommendedRail projects={recommendedProjects} modJams={activeModJams} t={t} projectType={projectType} initialCollapsed={initialRecommendedCollapsed} />
                )}

                <BrowseToolbar t={t} searchInput={searchInput} onSearchChange={handleSearchChange} onClearSearch={handleClearSearch} cardView={cardView} onToggleCardView={toggleCardView} sort={sort} onSortSelect={handleSortSelect} paginationControls={renderPaginationControls({ marginTop: 0, marginLeft: "auto" })} />

                {(selectedTags.length > 0 || selectedGameVersions.length > 0) && (
                    <div className="browse-selected-filters">
                        {selectedTags.length + selectedGameVersions.length > 1 && (
                            <button className="browse-selected-filter-chip" type="button" onClick={clearFilters}>
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-circle-x-icon lucide-circle-x">
                                    <circle cx="12" cy="12" r="10"/>
                                    <path d="m15 9-6 6"/>
                                    <path d="m9 9 6 6"/>
                                </svg>

                                {t("clearAllFilters")}
                            </button>
                        )}

                        {selectedTags.map((tag) => (
                            <button key={tag} className="browse-selected-filter-chip" type="button" onClick={() => toggleTag(tag)}>
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-x-icon lucide-x">
                                    <path d="M18 6 6 18"/>
                                    <path d="m6 6 12 12"/>
                                </svg>

                                {formatCategoryLabel(tag)}
                            </button>
                        ))}

                        {selectedGameVersions.map((version) => (
                            <button key={version} className="browse-selected-filter-chip" type="button" onClick={() => toggleGameVersion(version)}>
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-x-icon lucide-x">
                                    <path d="M18 6 6 18"/>
                                    <path d="m6 6 12 12"/>
                                </svg>

                                {version}
                            </button>
                        ))}
                    </div>
                )}

                {loading ? (
                    <div className={cardView === "media" ? "browse-project-grid" : "browse-project-list"} aria-label={t("loading")} aria-busy="true">
                        {Array.from({ length: 10 }).map((_, index) => (
                            cardView === "media" ? <ProjectCardMediaSkeleton key={index} /> : <ProjectCardSkeleton key={index} />
                        ))}
                    </div>
                ) : projects.length > 0 ? (
                    <div className={cardView === "media" ? "browse-project-grid" : "browse-project-list"}>
                        {projects.map((project) => (
                            cardView === "media" ? <ProjectCardMedia key={project.id} project={project} relativeTimeBase={relativeTimeBase} /> : <ProjectCard key={project.id} project={project} relativeTimeBase={relativeTimeBase} />
                        ))}
                    </div>
                ) : (
                    <div className="subsite-empty-feed">
                        <img src="/images/kweebec.png" style={{ width: "200px" }} />

                        <p className="subsite-empty-feed__title">{t("noProjects")}</p>
                    </div>
                )}

                {renderPaginationControls()}
            </div>
        </div>
    );
}