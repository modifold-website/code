"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import CategoryIcon from "@/utils/CategoryIcon";

const normalizeTags = (tags) => tags.map((tag) => (typeof tag === "string" ? { name: tag } : tag)).filter((tag) => tag && typeof tag.name === "string");
const normalizeGameVersionItems = (versions) => versions.map((item) => {
    if(typeof item === "string") {
        return { version: item, version_type: "release" };
    }

    if(item && typeof item.version === "string") {
        return { version: item.version, version_type: item.version_type || "release" };
    }

    return null;
}).filter(Boolean);

export default function BrowseFiltersSidebar({ t, projectType, tags = [], selectedTags = [], onToggleTag, gameVersions = [], selectedGameVersions = [], onToggleGameVersion, onClearFilters, getCategoryLabel = (label) => label }) {
    const normalizedTags = normalizeTags(tags);
    const normalizedGameVersions = useMemo(() => normalizeGameVersionItems(gameVersions), [gameVersions]);
    const [versionSearch, setVersionSearch] = useState("");
    const [showAllVersions, setShowAllVersions] = useState(false);
    const versionListRef = useRef(null);
    const hasSelectedFilters = selectedTags.length > 0 || selectedGameVersions.length > 0;
    const isWorldProjectType = projectType === "world";
    const filteredGameVersions = useMemo(() => {
        const query = versionSearch.trim().toLowerCase();
        const visibleVersions = normalizedGameVersions.filter((item) => showAllVersions || item.version_type === "release");

        if(!query) {
            return visibleVersions;
        }

        return visibleVersions.filter((item) => item.version.toLowerCase().includes(query));
    }, [normalizedGameVersions, showAllVersions, versionSearch]);
    const updateVersionListFade = useCallback(() => {
        const list = versionListRef.current;
        if(!list) {
            return;
        }

        const canScrollTop = list.scrollTop > 1;
        const canScrollBottom = list.scrollTop + list.clientHeight < list.scrollHeight - 1;

        list.style.setProperty("--_top-fade-height", canScrollTop ? "var(--_fade-height)" : "0px");
        list.style.setProperty("--_bottom-fade-height", canScrollBottom ? "var(--_fade-height)" : "0px");
    }, []);

    useEffect(() => {
        updateVersionListFade();
    }, [filteredGameVersions, updateVersionListFade]);

    const gameVersionsSection = normalizedGameVersions.length > 0 ? (
        <div className="content content--padding">
            <h2 style={{ fontSize: "18px", marginBottom: "10px", fontWeight: "600" }}>{t("gameVersions")}</h2>

            <label className="browse-version-search">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="11" cy="11" r="8"/>
                    <path d="m21 21-4.3-4.3"/>
                </svg>

                <input type="search" value={versionSearch} onChange={(event) => setVersionSearch(event.target.value)} placeholder={t("placeholders.versionSearch")} aria-label={t("gameVersions")} />
            </label>

            <ul ref={versionListRef} className="category-list browse-version-list" role="list" onScroll={updateVersionListFade}>
                {filteredGameVersions.map((item) => {
                    const isSelected = selectedGameVersions.includes(item.version);

                    return (
                        <li key={item.version} className="category-list__item">
                            <button className={`category-option browse-version-option ${isSelected ? "category-option--active" : ""}`} type="button" onClick={() => onToggleGameVersion(item.version)} aria-pressed={isSelected}>
                                <span className="category-option__label">{item.version}</span>

                                {isSelected && (
                                    <svg className="category-option__check" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M20 6 9 17l-5-5"/>
                                    </svg>
                                )}
                            </button>
                        </li>
                    );
                })}
            </ul>

            <button className="browse-version-checkbox" type="button" role="checkbox" aria-checked={showAllVersions} aria-label={t("showAllVersions")} onClick={() => setShowAllVersions((prev) => !prev)}>
                <span className={`browse-version-checkbox__box ${showAllVersions ? "browse-version-checkbox__box--checked" : ""}`}>
                    {showAllVersions && (
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M20 6 9 17l-5-5"/>
                        </svg>
                    )}
                </span>

                <span aria-hidden="true">{t("showAllVersions")}</span>
            </button>
        </div>
    ) : null;

    const categoriesSection = (
        <div className="content content--padding">
            <h2 style={{ fontSize: "18px", marginBottom: "6px", fontWeight: "600" }}>{t("categories")}</h2>

            <ul className="category-list" role="list">
                {normalizedTags.map((tag) => (
                    <li key={tag.name} className="category-list__item">
                        <button className={`category-option ${selectedTags.includes(tag.name) ? "category-option--active" : ""}`} onClick={() => onToggleTag(tag.name)} aria-pressed={selectedTags.includes(tag.name)}>
                            <span className="category-option__left">
                                <span className="category-option__icon">
                                    {tag.icon ? (
                                        <span aria-hidden="true" dangerouslySetInnerHTML={{ __html: tag.icon }} />
                                    ) : (
                                        <CategoryIcon category={tag.name} />
                                    )}
                                </span>

                                <span className="category-option__label">{getCategoryLabel(tag.name)}</span>
                            </span>

                            {selectedTags.includes(tag.name) && (
                                <svg className="category-option__check" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M20 6 9 17l-5-5"/>
                                </svg>
                            )}
                        </button>
                    </li>
                ))}
            </ul>

            <button className={`button button--size-m button--type-minimal button--with-icon ${!hasSelectedFilters ? "disabled" : ""}`} onClick={onClearFilters} style={{ width: "100%", marginTop: "12px", pointerEvents: "auto" }} disabled={!hasSelectedFilters}>
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ margin: "0 6px 0 0" }}>
                    <path d="M18 6 6 18"/>
                    <path d="m6 6 12 12"/>
                </svg>

                {t("clearFilters")}
            </button>
        </div>
    );

    return (
        <div className="sidebar--browse">
            {isWorldProjectType ? categoriesSection : gameVersionsSection}
            
            {isWorldProjectType ? gameVersionsSection : categoriesSection}
        </div>
    );
}