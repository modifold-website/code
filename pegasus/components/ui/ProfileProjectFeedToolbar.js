"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

export default function ProfileProjectFeedToolbar({ username, currentPage = 1, totalPages = 1, currentSort = "downloads" }) {
    const t = useTranslations("ProfilePage");
    const tBrowse = useTranslations("BrowsePage");
    const router = useRouter();
    const sortRef = useRef(null);
    const [isSortOpen, setIsSortOpen] = useState(false);
    const normalizedSort = currentSort === "recent" || currentSort === "updated" || currentSort === "downloads" ? currentSort : "downloads";

    useEffect(() => {
        const handleClickOutside = (event) => {
            if(sortRef.current && !sortRef.current.contains(event.target)) {
                setIsSortOpen(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const getProjectsHref = (page = 1, sort = normalizedSort) => {
        const params = new URLSearchParams();

        if(sort !== "downloads") {
            params.set("sort", sort);
        }

        if(page > 1) {
            params.set("page", String(page));
        }

        const queryString = params.toString();
        return `/user/${username}${queryString ? `?${queryString}` : ""}`;
    };

    const handleSortSelect = (nextSort) => {
        setIsSortOpen(false);
        router.push(getProjectsHref(1, nextSort));
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
                <Link key={i} href={getProjectsHref(i)} className={`button button--size-m pagination-button ${currentPage === i ? "button--type-primary" : "button--type-secondary"}`} aria-current={currentPage === i ? "page" : undefined}>
                    {i}
                </Link>
            );
        }

        return buttons;
    };

    return (
        <div className="sort-controls profile-project-feed__controls">
            <div className="sort-controls__actions">
                <div className="sort-wrapper button button--size-m button--type-secondary" ref={sortRef}>
                    <div className="dropdown">
                        <button className="dropdown__label" onClick={() => setIsSortOpen((prev) => !prev)} aria-expanded={isSortOpen} type="button">
                            {normalizedSort === "recent" ? tBrowse("sort.recent") : normalizedSort === "updated" ? tBrowse("sort.updated") : tBrowse("sort.downloads")}

                            <svg style={{ fill: "none" }} xmlns="http://www.w3.org/2000/svg" className={`icon icon--chevron_up ${isSortOpen ? "open" : ""}`} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="m6 9 6 6 6-6"></path>
                            </svg>
                        </button>
                    </div>

                    {isSortOpen && (
                        <div className="popover popover--sort">
                            <div className="context-list" data-scrollable="" style={{ maxHeight: "none" }}>
                                <div className={`context-list-option ${normalizedSort === "downloads" ? "context-list-option--selected" : ""}`} onClick={() => handleSortSelect("downloads")}>
                                    <div className="context-list-option__label">{tBrowse("sort.downloads")}</div>
                                </div>

                                <div className={`context-list-option ${normalizedSort === "recent" ? "context-list-option--selected" : ""}`} onClick={() => handleSortSelect("recent")}>
                                    <div className="context-list-option__label">{tBrowse("sort.recent")}</div>
                                </div>

                                <div className={`context-list-option ${normalizedSort === "updated" ? "context-list-option--selected" : ""}`} onClick={() => handleSortSelect("updated")}>
                                    <div className="context-list-option__label">{tBrowse("sort.updated")}</div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {totalPages > 1 && (
                    <div className="pagination-controls profile-project-feed__pagination">
                        {currentPage === 1 ? (
                            <button className="button button--size-m button--type-secondary button--icon-only" disabled aria-disabled="true" aria-label={t("previous")}>
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="m15 18-6-6 6-6"></path>
                                </svg>
                            </button>
                        ) : (
                            <Link className="button button--size-m button--type-secondary button--icon-only" href={getProjectsHref(currentPage - 1)} aria-label={t("previous")}>
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="m15 18-6-6 6-6"></path>
                                </svg>
                            </Link>
                        )}

                        {getPageButtons()}

                        {currentPage === totalPages ? (
                            <button className="button button--size-m button--type-secondary button--icon-only" disabled aria-disabled="true" aria-label={t("next")}>
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="m9 18 6-6-6-6"></path>
                                </svg>
                            </button>
                        ) : (
                            <Link className="button button--size-m button--type-secondary button--icon-only" href={getProjectsHref(currentPage + 1)} aria-label={t("next")}>
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="m9 18 6-6-6-6"></path>
                                </svg>
                            </Link>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}