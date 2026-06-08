"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

const MIN_PROJECT_SEARCH_LENGTH = 2;
const PROJECT_SEARCH_DEBOUNCE_MS = 320;

export default function VersionDependenciesEditor({ dependencies = [], dependencyDraft, dependencyTypes = [], onDraftChange, onAddDependency, onRemoveDependency, disabled = false }) {
	const t = useTranslations("SettingsProjectPage");
	const [projectQuery, setProjectQuery] = useState("");
	const [selectedProjectSlug, setSelectedProjectSlug] = useState("");
	const [isProjectPopoverOpen, setIsProjectPopoverOpen] = useState(false);
	const [isVersionPopoverOpen, setIsVersionPopoverOpen] = useState(false);
	const [isDependencyTypePopoverOpen, setIsDependencyTypePopoverOpen] = useState(false);
	const [projectOptions, setProjectOptions] = useState([]);
	const [versionOptions, setVersionOptions] = useState([]);
	const [projectSearchLoading, setProjectSearchLoading] = useState(false);
	const [versionSearchLoading, setVersionSearchLoading] = useState(false);
	const [projectSearchError, setProjectSearchError] = useState("");
	const [versionSearchError, setVersionSearchError] = useState("");

	const projectFieldRef = useRef(null);
	const versionFieldRef = useRef(null);
	const dependencyTypeFieldRef = useRef(null);
	const projectSearchAbortRef = useRef(null);
	const versionsAbortRef = useRef(null);

	const draft = dependencyDraft || {
		project_id: "",
		project_slug: "",
		project_title: "",
		version_id: "",
		version_number: "",
		dependency_type: "required",
	};
	const normalizedProjectQuery = projectQuery.trim();
	const hasSelectedProject = Boolean(selectedProjectSlug);
	const selectedVersionDisplay = draft.version_id
		? (draft.version_number || draft.version_id)
		: (hasSelectedProject ? t("versions.dependenciesEditor.popover.anyVersion") : "");
	const selectedDependencyType = draft.dependency_type || "required";
	const getDependencyTypeLabel = (type) => {
		const normalizedType = String(type || "").trim().toLowerCase();
		if(!normalizedType) {
			return "";
		}

		return t(`versions.dependenciesEditor.dependencyTypes.${normalizedType}`);
	};

	useEffect(() => {
		setProjectQuery(draft.project_title || draft.project_id || "");
		setSelectedProjectSlug(draft.project_slug || "");
	}, [draft.project_id, draft.project_slug, draft.project_title]);

	useEffect(() => {
		const handleClickOutside = (event) => {
			if(projectFieldRef.current && !projectFieldRef.current.contains(event.target)) {
				setIsProjectPopoverOpen(false);
			}

			if(versionFieldRef.current && !versionFieldRef.current.contains(event.target)) {
				setIsVersionPopoverOpen(false);
			}

			if(dependencyTypeFieldRef.current && !dependencyTypeFieldRef.current.contains(event.target)) {
				setIsDependencyTypePopoverOpen(false);
			}
		};

		document.addEventListener("mousedown", handleClickOutside);
		return () => {
			document.removeEventListener("mousedown", handleClickOutside);
		};
	}, []);

	useEffect(() => {
		if(disabled) {
			setIsProjectPopoverOpen(false);
			setIsVersionPopoverOpen(false);
			setIsDependencyTypePopoverOpen(false);
		}
	}, [disabled]);

	useEffect(() => {
		if(!isProjectPopoverOpen) {
			return;
		}

		const searchText = normalizedProjectQuery;
		if(projectSearchAbortRef.current) {
			projectSearchAbortRef.current.abort();
		}

		if(!searchText) {
			setProjectOptions([]);
			setProjectSearchError("");
			setProjectSearchLoading(false);
			return;
		}

		if(searchText.length < MIN_PROJECT_SEARCH_LENGTH) {
			setProjectOptions([]);
			setProjectSearchError("");
			setProjectSearchLoading(false);
			return;
		}

		const controller = new AbortController();
		projectSearchAbortRef.current = controller;
		setProjectSearchLoading(true);
		setProjectSearchError("");

		const timeoutId = setTimeout(async () => {
			try {
				const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE}/projects?search=${encodeURIComponent(searchText)}&page=1&limit=8&sort=downloads`, {
					signal: controller.signal,
				});

				if(!response.ok) {
					throw new Error("search_failed");
				}

				const data = await response.json();
				const nextOptions = Array.isArray(data?.projects) ? data.projects.map((project) => ({
					id: String(project.id || ""),
					title: String(project.title || project.slug || project.id || ""),
					slug: String(project.slug || ""),
					icon_url: String(project.icon_url || ""),
				})).filter((project) => project.id && project.slug) : [];

				setProjectOptions(nextOptions);
			} catch (error) {
				if(error?.name !== "AbortError") {
					setProjectOptions([]);
					setProjectSearchError(t("versions.dependenciesEditor.popover.unableToLoadProjects"));
				}
			} finally {
				setProjectSearchLoading(false);
			}
		}, PROJECT_SEARCH_DEBOUNCE_MS);

		return () => {
			clearTimeout(timeoutId);
			controller.abort();
		};
	}, [normalizedProjectQuery, isProjectPopoverOpen, t]);

	useEffect(() => {
		if(versionsAbortRef.current) {
			versionsAbortRef.current.abort();
		}

		if(!selectedProjectSlug) {
			setVersionOptions([]);
			setVersionSearchLoading(false);
			setVersionSearchError("");
			return;
		}

		const controller = new AbortController();
		versionsAbortRef.current = controller;
		setVersionSearchLoading(true);
		setVersionSearchError("");

		const timeoutId = setTimeout(async () => {
			try {
				const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE}/projects/${encodeURIComponent(selectedProjectSlug)}`, {
					signal: controller.signal,
				});

				if(!response.ok) {
					throw new Error("versions_failed");
				}

				const data = await response.json();
				const nextVersions = Array.isArray(data?.versions) ? data.versions.map((version) => ({
					id: String(version.id || ""),
					version_number: String(version.version_number || ""),
				})).filter((version) => version.id) : [];

				setVersionOptions(nextVersions);
			} catch (error) {
				if(error?.name !== "AbortError") {
					setVersionOptions([]);
					setVersionSearchError(t("versions.dependenciesEditor.popover.unableToLoadVersions"));
				}
			} finally {
				setVersionSearchLoading(false);
			}
		}, 160);

		return () => {
			clearTimeout(timeoutId);
			controller.abort();
		};
	}, [selectedProjectSlug, t]);

	const handleProjectInputChange = (value) => {
		setProjectQuery(value);
		onDraftChange("project_id", value.trim());
		onDraftChange("project_slug", "");
		onDraftChange("project_title", "");
		onDraftChange("project_icon_url", "");
		onDraftChange("version_id", "");
		onDraftChange("version_number", "");
		setSelectedProjectSlug("");
		setVersionOptions([]);
		setIsVersionPopoverOpen(false);
	};

	const handleSelectProject = (project) => {
		setProjectQuery(project.title);
		setSelectedProjectSlug(project.slug);
		onDraftChange("project_id", project.id);
		onDraftChange("project_slug", project.slug);
		onDraftChange("project_title", project.title);
		onDraftChange("project_icon_url", project.icon_url || "");
		onDraftChange("version_id", "");
		onDraftChange("version_number", "");
		setIsProjectPopoverOpen(false);
	};

	const handleSelectVersion = (version) => {
		if(!version?.id) {
			onDraftChange("version_id", "");
			onDraftChange("version_number", "");
			setIsVersionPopoverOpen(false);
			return;
		}

		onDraftChange("version_id", version.id);
		onDraftChange("version_number", version.version_number || "");
		setIsVersionPopoverOpen(false);
	};

	return (
		<div style={{ marginTop: "16px" }}>
			<p className="blog-settings__field-title">{t("versions.dependenciesEditor.title")}</p>
			<p style={{ marginBottom: "10px", color: "var(--theme-color-text-secondary)" }}>{t("versions.dependenciesEditor.description")}</p>

			<div style={{ display: "grid", gap: "12px", border: "1px solid var(--theme-color-background)", padding: "12px", borderRadius: "12px" }}>
				<div className="field field--default" ref={projectFieldRef}>
					<p className="blog-settings__field-title" style={{ marginTop: "0" }}>{t("versions.dependenciesEditor.fields.project")}</p>
					<label className="field__wrapper">
						<div className="field__wrapper-body">
							<input
								type="text"
								value={projectQuery}
								onChange={(event) => {
									handleProjectInputChange(event.target.value);
									if(!isProjectPopoverOpen) {
										setIsProjectPopoverOpen(true);
									}
								}}
								onFocus={() => {
									if(!disabled && normalizedProjectQuery) {
										setIsProjectPopoverOpen(true);
									}
								}}
								placeholder={t("versions.dependenciesEditor.placeholders.searchProject")}
								className="text-input"
								disabled={disabled}
								style={{ cursor: "pointer" }}
							/>
						</div>
					</label>

					{isProjectPopoverOpen && !disabled && normalizedProjectQuery && (
						<div className="popover" style={{ "--top": "calc(var(--height) + 50px)" }}>
							<div className="context-list" data-scrollable style={{ maxHeight: "220px", overflowY: "auto" }}>
								{normalizedProjectQuery.length < MIN_PROJECT_SEARCH_LENGTH ? (
									<div className="context-list-option">
										<div className="context-list-option__label">{t("versions.dependenciesEditor.popover.typeAtLeast", { count: MIN_PROJECT_SEARCH_LENGTH })}</div>
									</div>
								) : projectSearchLoading ? (
									<div className="context-list-option">
										<div className="context-list-option__label">{t("versions.dependenciesEditor.popover.searching")}</div>
									</div>
								) : projectSearchError ? (
									<div className="context-list-option">
										<div className="context-list-option__label">{projectSearchError}</div>
									</div>
								) : projectOptions.length === 0 ? (
									<div className="context-list-option">
										<div className="context-list-option__label">{t("versions.dependenciesEditor.popover.noProjectsFound")}</div>
									</div>
								) : (
									projectOptions.map((project) => (
										<div key={project.id} className={`context-list-option ${draft.project_id === project.id ? "context-list-option--selected" : ""}`} style={{ "--press-duration": "140ms" }} onClick={() => handleSelectProject(project)}>
											<div className="context-list-option__label" style={{ display: "flex", alignItems: "center", gap: "10px" }}>
												<img
													src={project.icon_url || "https://media.modifold.com/static/no-project-icon.svg"}
													alt=""
													width="24"
													height="24"
													style={{ width: "24px", height: "24px", borderRadius: "8px", objectFit: "cover", flexShrink: 0 }}
													loading="lazy"
												/>

												<strong>{project.title}</strong>
											</div>
										</div>
									))
								)}
							</div>
						</div>
					)}
				</div>

				{hasSelectedProject && (
					<div className="field field--default" ref={versionFieldRef}>
						<p className="blog-settings__field-title" style={{ marginTop: "0" }}>{t("versions.dependenciesEditor.fields.version")}</p>
						<label className="field__wrapper">
							<div className="field__wrapper-body">
								<input
									type="text"
									value={selectedVersionDisplay}
									onClick={() => {
										if(!disabled && selectedProjectSlug) {
											setIsVersionPopoverOpen((previous) => !previous);
										}
									}}
									placeholder={selectedProjectSlug ? t("versions.dependenciesEditor.placeholders.selectOrPasteVersionId") : t("versions.dependenciesEditor.placeholders.pasteVersionIdOptional")}
									className="text-input"
									readOnly
									disabled={disabled}
									style={{ cursor: "pointer" }}
								/>
							</div>
						</label>

						{isVersionPopoverOpen && !disabled && (
							<div className="popover" style={{ "--top": "calc(var(--height) + 50px)" }}>
								<div className="context-list" data-scrollable style={{ maxHeight: "240px", overflowY: "auto" }}>
									<div className={`context-list-option ${!draft.version_id ? "context-list-option--selected" : ""}`} style={{ "--press-duration": "140ms" }} onClick={() => handleSelectVersion(null)}>
										<div className="context-list-option__label">{t("versions.dependenciesEditor.popover.anyVersion")}</div>
									</div>

									{!selectedProjectSlug ? (
										<div className="context-list-option">
											<div className="context-list-option__label">{t("versions.dependenciesEditor.popover.selectProjectToChooseVersions")}</div>
										</div>
									) : versionSearchLoading ? (
										<div className="context-list-option">
											<div className="context-list-option__label">{t("versions.dependenciesEditor.popover.loadingVersions")}</div>
										</div>
									) : versionSearchError ? (
										<div className="context-list-option">
											<div className="context-list-option__label">{versionSearchError}</div>
										</div>
									) : versionOptions.length === 0 ? (
										<div className="context-list-option">
											<div className="context-list-option__label">{t("versions.dependenciesEditor.popover.noMatchingVersions")}</div>
										</div>
									) : (
										versionOptions.map((version) => (
											<div key={version.id} className={`context-list-option ${draft.version_id === version.id ? "context-list-option--selected" : ""}`} style={{ "--press-duration": "140ms" }} onClick={() => handleSelectVersion(version)}>
												<div className="context-list-option__label">
													{version.version_number || version.id}
													
													<div style={{ color: "var(--theme-color-text-secondary)", fontSize: "13px" }}>{version.id}</div>
												</div>
											</div>
										))
									)}
								</div>
							</div>
						)}
					</div>
				)}

				{hasSelectedProject && (
					<>
						<div className="field field--default" ref={dependencyTypeFieldRef}>
							<p className="blog-settings__field-title" style={{ marginTop: "0" }}>{t("versions.dependenciesEditor.fields.dependencyRelation")}</p>
							<label className="field__wrapper">
								<div className="field__wrapper-body">
									<input
										type="text"
										value={getDependencyTypeLabel(selectedDependencyType)}
										onClick={() => {
											if(!disabled) {
												setIsDependencyTypePopoverOpen((previous) => !previous);
											}
										}}
										className="text-input"
										readOnly
										disabled={disabled}
										style={{ cursor: "pointer" }}
									/>
								</div>
							</label>

							{isDependencyTypePopoverOpen && !disabled && (
								<div className="popover" style={{ "--top": "calc(var(--height) + 50px)" }}>
									<div className="context-list" data-scrollable style={{ maxHeight: "220px", overflowY: "auto" }}>
										{dependencyTypes.map((type) => (
											<div
												key={type}
												className={`context-list-option ${selectedDependencyType === type ? "context-list-option--selected" : ""}`}
												style={{ "--press-duration": "140ms" }}
												onClick={() => {
													onDraftChange("dependency_type", type);
													setIsDependencyTypePopoverOpen(false);
												}}
											>
												<div className="context-list-option__label">{getDependencyTypeLabel(type)}</div>
											</div>
										))}
									</div>
								</div>
							)}
						</div>

						<button type="button" className="button button--size-m button--type-primary" onClick={onAddDependency} disabled={disabled} style={{ width: "fit-content" }}>
							{t("versions.dependenciesEditor.actions.add")}
						</button>
					</>
				)}
			</div>

			{dependencies.length > 0 && (
				<div style={{ marginTop: "14px", display: "grid", gap: "8px" }}>
					<p className="blog-settings__field-title" style={{ marginBottom: "0" }}>{t("versions.dependenciesEditor.list.addedDependencies")}</p>
					{dependencies.map((dependency, index) => (
						<div key={`${dependency.project_id || "none"}:${dependency.version_id || "none"}:${dependency.dependency_type}:${index}`} style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center", background: "var(--theme-color-background)", borderRadius: "12px", padding: "12px 14px" }}>
							<div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: "0" }}>
								<img
									src={dependency.project_icon_url || "https://media.modifold.com/static/no-project-icon.svg"}
									alt=""
									width="28"
									height="28"
									style={{ width: "28px", height: "28px", borderRadius: "6px", objectFit: "cover", flexShrink: 0 }}
									loading="lazy"
								/>

								<span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
									{dependency.project_title || dependency.project_id || t("versions.dependenciesEditor.list.unknownProject")}
								</span>

								<span style={{ fontSize: "14px", lineHeight: 1, padding: "4px 8px", border: "1px solid var(--theme-sidebar-separator-color-background)", borderRadius: "99px" }}>{getDependencyTypeLabel(dependency.dependency_type || "required")}</span>
							</div>

							<button class="icon-button" type="button" onClick={() => onRemoveDependency(index)} disabled={disabled} title={t("versions.dependenciesEditor.actions.remove")}>
								<svg class="icon icon--cross" height="24" width="24">
									<path fill-rule="evenodd" clip-rule="evenodd" d="M5.293 5.293a1 1 0 0 1 1.414 0L12 10.586l5.293-5.293a1 1 0 0 1 1.414 1.414L13.414 12l5.293 5.293a1 1 0 0 1-1.414 1.414L12 13.414l-5.293 5.293a1 1 0 0 1-1.414-1.414L10.586 12 5.293 6.707a1 1 0 0 1 0-1.414Z"></path>
								</svg>
							</button>
						</div>
					))}
				</div>
			)}
		</div>
	);
}