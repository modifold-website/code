"use client";

import { useEffect, useRef, useState } from "react";

export default function BrowseToolbar({ t, searchInput, onSearchChange, onClearSearch, cardView, onToggleCardView, sort, onSortSelect, paginationControls = null, onOpenFilters, filterCount = 0, isFiltersOpen = false }) {
    const [isSortOpen, setIsSortOpen] = useState(false);
    const sortRef = useRef(null);
    const sortOptions = [
        { value: "downloads", label: t("sort.downloads") },
        { value: "recent", label: t("sort.recent") },
        { value: "updated", label: t("sort.updated") },
    ];

    useEffect(() => {
        const handleClickOutside = (event) => {
            if(sortRef.current && !sortRef.current.contains(event.target)) {
                setIsSortOpen(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleSortOptionClick = (nextSort) => {
        onSortSelect(nextSort);
        setIsSortOpen(false);
    };

    return (
        <div className="sort-controls">
            <div className="field field--large" style={{ width: "100%" }}>
                <label className="field__wrapper" style={{ background: "var(--theme-color-background-content)" }}>
                    <div className="field__wrapper-body">
                        <svg className="icon icon--search field__icon field__icon--left" xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="m21 21-4.34-4.34" />
                            <circle cx="11" cy="11" r="8" />
                        </svg>

                        <input type="text" placeholder={t("placeholders.search")} aria-label={t("placeholders.search")} value={searchInput} onChange={onSearchChange} className="text-input" />

                        {searchInput && (
                            <button className="field__clear-button" type="button" aria-label={t("clearSearch")} onMouseDown={(event) => event.preventDefault()} onClick={onClearSearch}>
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon field__icon">
                                    <path d="M18 6 6 18" />
                                    <path d="m6 6 12 12" />
                                </svg>
                            </button>
                        )}
                    </div>
                </label>
            </div>

            <div className="sort-controls__actions">
				<button type="button" className="button button--size-m button--type-secondary browse-mobile-filters" onClick={onOpenFilters} aria-haspopup="dialog" aria-expanded={isFiltersOpen}>
					<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
						<path d="M4 7h16M4 17h16M9 4v6M15 14v6" />
					</svg>

					{t("mobileFilters.title")}

					{filterCount > 0 && <span className="browse-mobile-filters__count">{filterCount}</span>}
				</button>

                <div className="sort-wrapper button button--size-m button--type-secondary" ref={sortRef}>
                    <div className="dropdown">
                        <button className="dropdown__label" type="button" onClick={() => setIsSortOpen((prev) => !prev)} aria-expanded={isSortOpen} onKeyDown={(event) => {
							if(event.key === "Escape") {
								setIsSortOpen(false);
							}
						}}>
                            {sortOptions.find((option) => option.value === sort)?.label || t("sort.downloads")}

                            <svg style={{ fill: "none" }} xmlns="http://www.w3.org/2000/svg" className={`icon icon--chevron_up ${isSortOpen ? "open" : ""}`} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="m6 9 6 6 6-6"/>
                            </svg>
                        </button>
                    </div>

                    {isSortOpen && (
                        <div className="popover popover--sort" onKeyDown={(event) => {
							if(event.key === "Escape") {
								setIsSortOpen(false);
								sortRef.current?.querySelector("button")?.focus();
							}
						}}>
                            <div className="context-list" data-scrollable="" style={{ maxHeight: "none" }}>
                                {sortOptions.map((option) => (
                                    <button key={option.value} type="button" className={`context-list-option ${sort === option.value ? "context-list-option--selected" : ""}`} aria-pressed={sort === option.value} onClick={() => handleSortOptionClick(option.value)}>
                                        <div className="context-list-option__label">{option.label}</div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <div className="browse-view-toggle">
                    <button className={`browse-view-toggle__item ${cardView === "list" ? "is-active" : ""}`} onClick={() => cardView !== "list" && onToggleCardView()} aria-pressed={cardView === "list"} type="button">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
                            <path d="M3 14h7v7H3zM3 3h7v7H3zM14 4h7M14 9h7M14 15h7M14 20h7"></path>
                        </svg>
                        
                        <span>{t("view.list")}</span>
                    </button>
                    
                    <button className={`browse-view-toggle__item ${cardView === "media" ? "is-active" : ""}`} onClick={() => cardView !== "media" && onToggleCardView()} aria-pressed={cardView === "media"} type="button">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
                            <rect width="18" height="18" x="3" y="3" rx="2" ry="2"></rect>
                            <circle cx="9" cy="9" r="2"></circle>
                            <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"></path>
                        </svg>

                        <span>{t("view.grid")}</span>
                    </button>
                </div>

                {paginationControls}
            </div>
        </div>
    );
}