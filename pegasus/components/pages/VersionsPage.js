"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import Link from "next/link";
import { getProjectPath } from "@/utils/projectRoutes";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import VersionDisplay from "../VersionDisplay";
import { useTranslations, useLocale } from "next-intl";
import ProjectSidebar from "../project/ProjectSidebar";
import VersionDownloadButton from "../project/VersionDownloadButton";
import { DEFAULT_GAME_VERSIONS, sortByKnownGameVersions } from "@/utils/gameVersions";

const releaseChannels = ["release", "beta", "alpha"];
const VERSION_MODERATION_BADGE_TYPES = {
    pending: "pending",
    scanning: "pending",
    needs_review: "pending",
    blocked: "blocked",
    error: "error",
};
const VERSION_MODERATION_STATUS_KEYS = new Set(Object.keys(VERSION_MODERATION_BADGE_TYPES));

export default function VersionsPage({ project, authToken, gameVersions = DEFAULT_GAME_VERSIONS }) {
    const t = useTranslations("ProjectPage");
    const locale = useLocale();
    const router = useRouter();
    const searchParams = useSearchParams();
    const pathname = usePathname();

    const [isFilterGameVersionsPopoverOpen, setIsFilterGameVersionsPopoverOpen] = useState(false);
    const [isFilterChannelsPopoverOpen, setIsFilterChannelsPopoverOpen] = useState(false);
    const [filterGameVersions, setFilterGameVersions] = useState([]);
    const [filterChannels, setFilterChannels] = useState([]);
    const [filterLoaders, setFilterLoaders] = useState([]);
    const [isFilterLoadersPopoverOpen, setIsFilterLoadersPopoverOpen] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const versionsPerPage = 15;

    const filterGameVersionsRef = useRef(null);
    const filterChannelsRef = useRef(null);
    const filterLoadersRef = useRef(null);

    const availableGameVersions = sortByKnownGameVersions([...new Set(project.versions.flatMap((version) => (version.game_versions ? version.game_versions.split(",").map((v) => v.trim()) : [])))], gameVersions);
    const availableChannels = [...new Set(project.versions.map((version) => version.release_channel))].filter((channel) => releaseChannels.includes(channel));

    const filteredVersions = useMemo(() => {
        return project.versions.filter((version) => {
            const gameVersionsMatch = filterGameVersions.length === 0 || (version.game_versions && filterGameVersions.some((filterVersion) => version.game_versions.split(",").map((v) => v.trim()).includes(filterVersion)));
            const channelMatch = filterChannels.length === 0 || filterChannels.includes(version.release_channel);
            const loadersMatch = filterLoaders.length === 0 || (version.loaders && filterLoaders.some(filterLoader => version.loaders.toLowerCase().split(",").map(l => l.trim()).includes(filterLoader)));

            return gameVersionsMatch && channelMatch && loadersMatch;
        });
    }, [project.versions, filterGameVersions, filterChannels, filterLoaders]);

    const totalVersions = filteredVersions.length;
    const totalPages = Math.ceil(totalVersions / versionsPerPage);
    const indexOfLastVersion = currentPage * versionsPerPage;
    const indexOfFirstVersion = indexOfLastVersion - versionsPerPage;
    const currentVersions = filteredVersions.slice(indexOfFirstVersion, indexOfLastVersion);

    useEffect(() => {
        const params = new URLSearchParams(searchParams);
        const urlVersions = params.getAll("v");
        const urlChannels = params.getAll("channel");
        const urlLoaders = params.getAll("loader").map(l => l.toLowerCase());
        const urlPage = parseInt(params.get("page")) || 1;

        const sameGameVersions = urlVersions.length === filterGameVersions.length && urlVersions.every((v, i) => v === filterGameVersions[i]);
        const sameChannels = urlChannels.length === filterChannels.length && urlChannels.every((v, i) => v === filterChannels[i]);
        const sameLoaders = urlLoaders.length === filterLoaders.length && urlLoaders.every((v, i) => v === filterLoaders[i]);
        const samePage = urlPage === currentPage;

        if(sameGameVersions && sameChannels && sameLoaders && samePage) {
            return;
        }

        setFilterGameVersions(urlVersions);
        setFilterChannels(urlChannels);
        setFilterLoaders(urlLoaders);
        setCurrentPage(urlPage);
    }, [searchParams]);

    const updateUrl = () => {
        const params = new URLSearchParams();

        filterGameVersions.forEach(v => params.append("v", v));
        filterChannels.forEach(ch => params.append("channel", ch));
        filterLoaders.forEach(loader => params.append("loader", loader.toLowerCase()));
        if(currentPage > 1) {
            params.set("page", currentPage);
        }

        const query = params.toString();
        const currentQuery = searchParams.toString();
        if(query === currentQuery) {
            return;
        }

        router.replace(`${pathname}${query ? `?${query}` : ""}`, { scroll: false });
    };

    useEffect(() => {
        updateUrl();
    }, [filterGameVersions, filterChannels, filterLoaders, currentPage, searchParams, pathname, router]);

    useEffect(() => {
        setCurrentPage(1);
    }, [filterGameVersions, filterChannels, filterLoaders])

    useEffect(() => {
        const handleClickOutside = (event) => {
            if(filterGameVersionsRef.current && !filterGameVersionsRef.current.contains(event.target)) {
                setIsFilterGameVersionsPopoverOpen(false);
            }

            if(filterChannelsRef.current && !filterChannelsRef.current.contains(event.target)) {
                setIsFilterChannelsPopoverOpen(false);
            }

            if(filterLoadersRef.current && !filterLoadersRef.current.contains(event.target)) {
                setIsFilterLoadersPopoverOpen(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const toggleFilterGameVersionsPopover = () => {
        setIsFilterGameVersionsPopoverOpen((prev) => !prev);
    };

    const toggleFilterChannelsPopover = () => {
        setIsFilterChannelsPopoverOpen((prev) => !prev);
    };

    const handleToggleFilterGameVersion = (version) => {
        setFilterGameVersions((prev) => (prev.includes(version) ? prev.filter((v) => v !== version) : [...prev, version]));
    };

    const handleToggleFilterChannel = (channel) => {
        setFilterChannels((prev) => (prev.includes(channel) ? prev.filter((c) => c !== channel) : [...prev, channel]));
    };

    const handleToggleFilterLoader = (loader) => {
        const normalized = loader.toLowerCase();
        setFilterLoaders((prev) => prev.includes(normalized) ? prev.filter((l) => l !== normalized) : [...prev, normalized]);
    };

    const toggleFilterLoadersPopover = () => {
        setIsFilterLoadersPopoverOpen((prev) => !prev);
    };

    const availableLoaders = useMemo(() => {
        const loaders = project.versions.flatMap((version) => version.loaders && version.loaders.trim() && version.loaders !== "null" ? version.loaders.split(",").map(l => l.trim().toLowerCase()) : []);
        return [...new Set(loaders)].sort();
    }, [project.versions]);

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString(locale, { day: "numeric", month: "short" });
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
                <button key={i} className={`button button--size-m pagination-button ${currentPage === i ? "button--type-primary" : "button--type-secondary"}`} onClick={() => setCurrentPage(i)} aria-current={currentPage === i ? "page" : undefined}>
                    {i}
                </button>
            );
        }

        return buttons;
    };

    const getVersionModerationBadge = (status) => {
        const statusKey = String(status || "").trim();
        if(!VERSION_MODERATION_STATUS_KEYS.has(statusKey)) {
            return null;
        }

        return {
            type: VERSION_MODERATION_BADGE_TYPES[statusKey],
            label: t(`versions.statuses.${statusKey}`),
        };
    };

    return (
        <>
            <div className="project__general">
                <div>
                    <div className="version-filters" style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
                        <div className="field field--default" ref={filterGameVersionsRef}>
                            <button style={{ display: "flex", gap: "4px" }} type="button" className="button button--size-m button--type-secondary" onClick={toggleFilterGameVersionsPopover} aria-label={t("filters.gameVersionsAria")}>
                                {t("tabs.gameVersion")}

                                <svg className="icon icon--chevron_down " width="20" height="20" viewBox="0 0 24 24"><path fillRule="evenodd" clipRule="evenodd" d="M17.707 8.793a1 1 0 0 1 0 1.414l-5 5a1 1 0 0 1-1.414 0l-5-5a1 1 0 1 1 1.414-1.414L12 13.086l4.293-4.293a1 1 0 0 1 1.414 0Z" fill="currentColor"></path></svg>
                            </button>

                            {isFilterGameVersionsPopoverOpen && (
                                <div className="popover">
                                    <div className="context-list" style={{ maxHeight: "200px" }}>
                                        {availableGameVersions.map((version) => (
                                            <div key={version} className={`context-list-option ${filterGameVersions.includes(version) ? "context-list-option--selected" : ""}`} onClick={() => handleToggleFilterGameVersion(version)}>
                                                <div className="context-list-option__label">{version}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="field field--default" ref={filterChannelsRef}>
                            <button style={{ display: "flex", gap: "4px" }} type="button" className="button button--size-m button--type-secondary" onClick={toggleFilterChannelsPopover} aria-label={t("filters.channelsAria")}>
                                {t("tabs.gameChannel")}

                                <svg className="icon icon--chevron_down " width="20" height="20" viewBox="0 0 24 24"><path fillRule="evenodd" clipRule="evenodd" d="M17.707 8.793a1 1 0 0 1 0 1.414l-5 5a1 1 0 0 1-1.414 0l-5-5a1 1 0 1 1 1.414-1.414L12 13.086l4.293-4.293a1 1 0 0 1 1.414 0Z" fill="currentColor"></path></svg>
                            </button>

                            {isFilterChannelsPopoverOpen && (
                                <div className="popover">
                                    <div className="context-list" style={{ maxHeight: "200px" }}>
                                        {availableChannels.map((channel) => (
                                            <div key={channel} className={`context-list-option ${filterChannels.includes(channel) ? "context-list-option--selected" : ""}`} onClick={() => handleToggleFilterChannel(channel)}>
                                                <div className="context-list-option__label">{channel.charAt(0).toUpperCase() + channel.slice(1)}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="field field--default" ref={filterLoadersRef}>
                            <button style={{ display: "flex", gap: "4px" }} type="button" className="button button--size-m button--type-secondary" onClick={toggleFilterLoadersPopover} aria-label={t("filters.loadersAria")}>
                                {t("tabs.loader") || "Loader"}

                                <svg className="icon icon--chevron_down " width="20" height="20" viewBox="0 0 24 24"><path fillRule="evenodd" clipRule="evenodd" d="M17.707 8.793a1 1 0 0 1 0 1.414l-5 5a1 1 0 0 1-1.414 0l-5-5a1 1 0 1 1 1.414-1.414L12 13.086l4.293-4.293a1 1 0 0 1 1.414 0Z" fill="currentColor"></path></svg>
                            </button>

                            {isFilterLoadersPopoverOpen && (
                                <div className="popover">
                                    <div className="context-list" style={{ maxHeight: "200px" }}>
                                        {availableLoaders.map((loader) => (
                                            <div key={loader} className={`context-list-option ${filterLoaders.includes(loader) ? "context-list-option--selected" : ""}`} onClick={() => handleToggleFilterLoader(loader)}>
                                                <div className="context-list-option__label">
                                                    {loader.charAt(0).toUpperCase() + loader.slice(1)}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="all-versions">
                        <div className="card-header">
                            <div></div>
                            <div>{t("versions.headers.version")}</div>
                            <div>{t("versions.headers.statistics")}</div>
                        </div>

                        {currentVersions.map((version) => {
                            const moderationBadge = getVersionModerationBadge(version.moderation_status);

                            return (
                                <div key={version.id} className="version-button">
                                    <VersionDownloadButton project={project} version={version} className="download-button" href={`${process.env.NEXT_PUBLIC_API_BASE}/projects/${project.slug}/versions/${version.id}/download`}>
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-1m-4-4-4 4m0 0-4-4m4 4V4"></path>
                                        </svg>
                                    </VersionDownloadButton>

                                    <Link href={`${getProjectPath(project)}/version/${version.id}`}>
                                        <span className="version__title">
                                            {version.version_number}

                                            {version.loaders && version.loaders.trim() && version.loaders !== "null" ? (
                                                version.loaders.split(",").map((loader, index) => (
                                                    <span key={index} className="version__game-platform">
                                                        {loader.trim()}
                                                    </span>
                                                ))
                                            ) : (
                                                <span className="version__game-platform">{t("versions.notSpecified")}</span>
                                            )}
                                            
                                            <VersionDisplay gameVersions={version.game_versions ? version.game_versions.split(",").map((v) => v.trim()) : []} allGameVersions={gameVersions} />
                                        </span>

                                        <div className="version__metadata">
                                            {moderationBadge && (
                                                <span className={`version__badge type--${moderationBadge.type}`} style={{ marginRight: "8px" }}>
                                                    <span className="circle"></span>
                                                    {moderationBadge.label}
                                                </span>
                                            )}

                                            <span className={`version__badge type--${version.release_channel}`}>
                                                <span className="circle"></span>
                                                {t("versions.published")}
                                            </span>
                                            <span className="divider"></span>
                                            <span className="version_number">{formatDate(version.created_at)}</span>
                                        </div>
                                    </Link>

                                    <div className="version__stats">
                                        <strong>{version.downloads}</strong>
                                        <span>{t("versions.downloads")}</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {totalPages > 1 && (
                        <div className="pagination-controls">
                            <button className="button button--size-m button--type-secondary" onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))} disabled={currentPage === 1} aria-disabled={currentPage === 1}>
                                {t("previous")}
                            </button>

                            {getPageButtons()}

                            <button className="button button--size-m button--type-secondary" onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))} disabled={currentPage === totalPages} aria-disabled={currentPage === totalPages}>
                                {t("next")}
                            </button>
                        </div>
                    )}
                </div>

                <ProjectSidebar project={project} />
            </div>
        </>
    );
}