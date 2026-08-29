"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Checkbox from "@/components/ui/Checkbox";
import CategoryIcon from "@/utils/CategoryIcon";
import { getBrowseGameVersionGroups, normalizeGameVersionItemsPayload } from "@/utils/gameVersions";
import { apiClient } from "@/utils/api/client";

const normalizeTags = (tags) => tags.map((tag) => (typeof tag === "string" ? { name: tag } : tag)).filter((tag) => tag && typeof tag.name === "string");
const DEPENDENCY_PROJECT_SEARCH_DEBOUNCE_MS = 350;
const DEPENDENCY_TYPES = ["required", "optional", "embedded"];

function useDebouncedValue(value, delay) {
	const [debouncedValue, setDebouncedValue] = useState(value);

	useEffect(() => {
		const timeoutId = setTimeout(() => setDebouncedValue(value), delay);
		return () => clearTimeout(timeoutId);
	}, [delay, value]);

	return debouncedValue;
}

async function fetchDependencyProjectOptions({ queryKey, signal }) {
	const [, , params] = queryKey;
	const response = await apiClient.get("/projects/dependency-options", { params, signal });
	return Array.isArray(response.data?.projects) ? response.data.projects : [];
}

function DependencyFilter({ t, selectedProjectId, dependencyType, onSelectProject, onSelectDependencyType, onClear }) {
	const [searchInput, setSearchInput] = useState("");
	const [selectedProject, setSelectedProject] = useState(null);
	const [isProjectPopoverOpen, setIsProjectPopoverOpen] = useState(false);
	const [isDependencyTypePopoverOpen, setIsDependencyTypePopoverOpen] = useState(false);
	const projectFieldRef = useRef(null);
	const dependencyTypeRef = useRef(null);
	const debouncedSearchInput = useDebouncedValue(searchInput.trim(), DEPENDENCY_PROJECT_SEARCH_DEBOUNCE_MS);

	const projectOptionsQuery = useQuery({
		queryKey: ["projects", "dependency-options", { search: debouncedSearchInput, limit: 8 }],
		queryFn: fetchDependencyProjectOptions,
		enabled: isProjectPopoverOpen && !selectedProjectId && Boolean(debouncedSearchInput),
		staleTime: 30 * 1000,
	});
	const selectedProjectQuery = useQuery({
		queryKey: ["projects", "dependency-options", { id: selectedProjectId }],
		queryFn: fetchDependencyProjectOptions,
		enabled: Boolean(selectedProjectId) && selectedProject?.id !== selectedProjectId,
		staleTime: 30 * 1000,
	});
	const projectOptions = projectOptionsQuery.data || [];
	const resolvedSelectedProject = selectedProject?.id === selectedProjectId ? selectedProject : selectedProjectQuery.data?.[0] || null;

	useEffect(() => {
		if(!selectedProjectId) {
			setSelectedProject(null);
			setSearchInput("");
			setIsProjectPopoverOpen(false);
			setIsDependencyTypePopoverOpen(false);
		}
	}, [selectedProjectId]);

	useEffect(() => {
		const handleClickOutside = (event) => {
			if(projectFieldRef.current && !projectFieldRef.current.contains(event.target)) {
				setIsProjectPopoverOpen(false);
			}

			if(dependencyTypeRef.current && !dependencyTypeRef.current.contains(event.target)) {
				setIsDependencyTypePopoverOpen(false);
			}
		};

		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, []);

	const handleSelectProject = (project) => {
		setSelectedProject(project);
		setSearchInput(project.title || project.slug || project.id);
		setIsProjectPopoverOpen(false);
		onSelectProject(project.id);
	};

	const handleClear = () => {
		setSelectedProject(null);
		setSearchInput("");
		setIsDependencyTypePopoverOpen(false);
		onClear();
	};

	const selectedDependencyType = DEPENDENCY_TYPES.includes(dependencyType) ? dependencyType : "required";

	return (
		<div className="content content--padding browse-dependency-filter" style={{ padding: "14px 20px 20px 20px" }}>
			<h2 className="browse-dependency-filter__title">{t("dependencies.title")}</h2>

			{selectedProjectId ? (
				<div className="browse-dependency-filter__selected">
					<img src={resolvedSelectedProject?.icon_url || "https://media.modifold.com/static/no-project-icon.svg"} alt="" width="40" height="40" className="browse-dependency-filter__project-icon" />

					<div className="browse-dependency-filter__selected-copy">
						<strong title={resolvedSelectedProject?.title || selectedProjectId}>{resolvedSelectedProject?.title || selectedProjectId}</strong>

						<div className="browse-dependency-filter__type" ref={dependencyTypeRef}>
							<button type="button" className="browse-dependency-filter__type-button" onClick={() => setIsDependencyTypePopoverOpen((previous) => !previous)} aria-expanded={isDependencyTypePopoverOpen}>
								{t(`dependencies.types.${selectedDependencyType}`)}

								<svg className={`icon icon--chevron_down ${isDependencyTypePopoverOpen ? "rotate" : ""}`} xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
									<path d="m6 9 6 6 6-6"/>
								</svg>
							</button>

							{isDependencyTypePopoverOpen && (
								<div className="popover browse-dependency-filter__type-popover">
									<div className="context-list">
										{DEPENDENCY_TYPES.map((type) => (
											<button key={type} type="button" className={`context-list-option ${selectedDependencyType === type ? "context-list-option--selected" : ""}`} onClick={() => {
												onSelectDependencyType(type);
												setIsDependencyTypePopoverOpen(false);
											}}>
												<span className="context-list-option__label">{t(`dependencies.types.${type}`)}</span>
											</button>
										))}
									</div>
								</div>
							)}
						</div>
					</div>

					<button type="button" className="browse-dependency-filter__clear" onClick={handleClear} aria-label={t("dependencies.clear")} title={t("dependencies.clear")}>
						<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
							<path d="M18 6 6 18"/>
							<path d="m6 6 12 12"/>
						</svg>
					</button>
				</div>
			) : (
				<div className="field field--default browse-dependency-filter__field" ref={projectFieldRef}>
					<label className="field__wrapper">
						<div className="field__wrapper-body">
							<svg className="icon field__icon field__icon--left" xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
								<circle cx="11" cy="11" r="8"/>
								<path d="m21 21-4.3-4.3"/>
							</svg>

							<input type="text" className="text-input" value={searchInput} onChange={(event) => {
								setSearchInput(event.target.value);
								setIsProjectPopoverOpen(true);
							}} onFocus={() => setIsProjectPopoverOpen(true)} placeholder={t("dependencies.placeholder")} aria-label={t("dependencies.title")} autoComplete="off" />
						</div>
					</label>

					{isProjectPopoverOpen && debouncedSearchInput && (
						<div className="popover browse-dependency-filter__projects-popover">
							<div className="context-list" data-scrollable="" style={{ maxHeight: "280px" }}>
								{projectOptionsQuery.isFetching ? (
									<div className="context-list-option"><span className="context-list-option__label">{t("dependencies.searching")}</span></div>
								) : projectOptionsQuery.isError ? (
									<div className="context-list-option"><span className="context-list-option__label">{t("dependencies.error")}</span></div>
								) : projectOptions.length === 0 ? (
									<div className="context-list-option"><span className="context-list-option__label">{t("dependencies.empty")}</span></div>
								) : projectOptions.map((project) => (
									<button key={project.id} type="button" className="context-list-option context-list-option--with-art" onClick={() => handleSelectProject(project)}>
										<span className="context-list-option__art">
											<img src={project.icon_url || "https://media.modifold.com/static/no-project-icon.svg"} alt="" />
										</span>
										
										<span className="context-list-option__label">{project.title}</span>
									</button>
								))}
							</div>
						</div>
					)}
				</div>
			)}
		</div>
	);
}

export default function BrowseFiltersSidebar({ t, projectType, tags = [], selectedTags = [], onToggleTag, gameVersions = [], selectedGameVersions = [], useDefaultGameVersions = false, onToggleGameVersion, onSelectGameVersionGroup, selectedDependencyProjectId = "", dependencyType = "required", onSelectDependencyProject, onSelectDependencyType, onClearDependency, onClearFilters, getCategoryLabel = (label) => label }) {
    const normalizedTags = normalizeTags(tags);
    const normalizedGameVersions = useMemo(() => normalizeGameVersionItemsPayload({ game_versions: gameVersions }), [gameVersions]);
	const gameVersionGroups = useMemo(() => getBrowseGameVersionGroups(normalizedGameVersions), [normalizedGameVersions]);
    const [versionSearch, setVersionSearch] = useState("");
    const [showAllVersions, setShowAllVersions] = useState(false);
    const versionListRef = useRef(null);
    const hasSelectedFilters = selectedTags.length > 0 || selectedGameVersions.length > 0 || Boolean(selectedDependencyProjectId);
    const isWorldProjectType = projectType === "world";
	const selectedGameVersionSet = useMemo(() => new Set(selectedGameVersions), [selectedGameVersions]);
	const groupedVersionSet = useMemo(() => new Set(gameVersionGroups.flatMap((group) => group.versions)), [gameVersionGroups]);
	const filteredGameVersionGroups = useMemo(() => {
		const query = versionSearch.trim().toLowerCase();

		if(!query) {
			return gameVersionGroups;
		}

		return gameVersionGroups.filter((group) => (
			group.label.toLowerCase().includes(query) ||
			group.range_label.toLowerCase().includes(query) ||
			group.versions.some((version) => version.toLowerCase().includes(query))
		));
	}, [gameVersionGroups, versionSearch]);
    const filteredGameVersions = useMemo(() => {
        const query = versionSearch.trim().toLowerCase();
        const visibleVersions = normalizedGameVersions.filter((item) => (
			item.is_browse_visible !== false &&
			!groupedVersionSet.has(item.version) &&
			(showAllVersions || item.version_type === "release")
		));

        if(!query) {
            return visibleVersions;
        }

        return visibleVersions.filter((item) => item.version.toLowerCase().includes(query));
    }, [groupedVersionSet, normalizedGameVersions, showAllVersions, versionSearch]);
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
    }, [filteredGameVersionGroups, filteredGameVersions, updateVersionListFade]);

    const gameVersionsSection = normalizedGameVersions.length > 0 ? (
        <div className="content content--padding" style={{ padding: "14px 20px 20px 20px" }}>
            <h2 style={{ fontSize: "18px", marginBottom: "10px", fontWeight: "600" }}>{t("gameVersions")}</h2>

            <label className="browse-version-search">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="11" cy="11" r="8"/>
                    <path d="m21 21-4.3-4.3"/>
                </svg>

                <input type="search" value={versionSearch} onChange={(event) => setVersionSearch(event.target.value)} placeholder={t("placeholders.versionSearch")} aria-label={t("gameVersions")} />
            </label>

            <ul ref={versionListRef} className="category-list browse-version-list" role="list" onScroll={updateVersionListFade}>
				{filteredGameVersionGroups.map((group) => {
					const isExplicitlySelected = group.versions.length > 0 && group.versions.every((version) => selectedGameVersionSet.has(version));
					const isSelected = isExplicitlySelected || (useDefaultGameVersions && group.is_browse_default);

					return (
						<li key={group.key} className="category-list__item">
							<button className={`category-option browse-version-option browse-version-group ${isSelected ? "category-option--active" : ""}`} type="button" onClick={() => onSelectGameVersionGroup?.(group.versions, { isDefault: group.is_browse_default })} aria-pressed={isSelected}>
								<span className="browse-version-group__text">
									<span className="category-option__label">{group.label}</span>

									{group.range_label && (
										<span className="browse-version-group__range">({group.range_label})</span>
									)}
								</span>

								{isSelected && (
									<svg className="category-option__check" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
										<path d="M20 6 9 17l-5-5"/>
									</svg>
								)}
							</button>
						</li>
					);
				})}

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

            <Checkbox className="browse-version-checkbox" checked={showAllVersions} onChange={setShowAllVersions} ariaLabel={t("showAllVersions")}>
                {t("showAllVersions")}
            </Checkbox>
        </div>
    ) : null;

    const categoriesSection = (
        <div className="content content--padding" style={{ padding: "14px 20px 20px 20px" }}>
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

			{projectType === "mod" && (
				<DependencyFilter t={t} selectedProjectId={selectedDependencyProjectId} dependencyType={dependencyType} onSelectProject={onSelectDependencyProject} onSelectDependencyType={onSelectDependencyType} onClear={onClearDependency} />
			)}
        </div>
    );
}