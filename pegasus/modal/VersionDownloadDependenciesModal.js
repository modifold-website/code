"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Modal from "react-modal";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { getProjectPath } from "@/utils/projectRoutes";
import showOverTheTopDownloadAnimation from "@/components/ui/showOverTheTopDownloadAnimation";
import { getVersionDownloadUrl } from "@/utils/projects/downloads";
import { getVersionDownloadEndpoint } from "@/utils/projects/downloadTracking";

Modal.setAppElement("body");

function getDependencyProjectPath(dependency) {
	if(!dependency?.project_slug) {
		return null;
	}

	return getProjectPath({
		slug: dependency.project_slug,
		project_type: dependency.project_type,
	});
}

function getDependencyVersionPath(dependency) {
	const projectPath = getDependencyProjectPath(dependency);
	if(!projectPath) {
		return null;
	}

	return dependency.version_id ? `${projectPath}/version/${dependency.version_id}` : projectPath;
}

function getDependencyDownloadHref(dependency) {
	return getVersionDownloadEndpoint({
		project: { slug: dependency?.project_slug },
		version: { id: dependency?.version_id },
	}) || getVersionDownloadUrl(dependency);
}

function getRequiredDependencies(version) {
	if(!Array.isArray(version?.dependencies)) {
		return [];
	}

	return version.dependencies.filter((dependency) => {
		const dependencyType = String(dependency?.dependency_type || dependency?.type || "required").trim().toLowerCase();
		return dependencyType === "required";
	});
}

export default function VersionDownloadDependenciesModal({ isOpen, project, version, dependencies = [], quickDownloadOptions, isLoading = false, loadError = false, onRetry, onRequestClose }) {
	const t = useTranslations("ProjectPage.versions.downloadModal");
	const tProject = useTranslations("ProjectPage");
	const [selectedGameVersion, setSelectedGameVersion] = useState("");
	const [isVersionPopoverOpen, setIsVersionPopoverOpen] = useState(false);
	const [versionPopoverStyle, setVersionPopoverStyle] = useState(null);
	const versionSelectorRef = useRef(null);
	const versionTriggerRef = useRef(null);
	const versionPopoverRef = useRef(null);
	const selectedVersionRef = useRef(null);
	const selectedDependenciesRef = useRef(null);
	const projectIconUrl = project?.icon_url || "/images/no-project-icon.svg";
	const isQuickDownload = quickDownloadOptions !== undefined;
	const selectedOption = isQuickDownload ? quickDownloadOptions.find((option) => option.gameVersion === selectedGameVersion) : null;
	const selectedVersion = selectedOption?.version || version;
	const selectedDependencies = isQuickDownload ? getRequiredDependencies(selectedVersion) : dependencies;
	const selectedDownloadHref = selectedVersion ? getVersionDownloadEndpoint({ project, version: selectedVersion }) || getVersionDownloadUrl(selectedVersion) : null;
	const selectedVersionHref = selectedVersion?.id ? getProjectPath(project, `/version/${selectedVersion.id}`) : null;
	const hasSelectedOption = Boolean(selectedOption);

	useEffect(() => {
		if(!isOpen) {
			setSelectedGameVersion("");
			setIsVersionPopoverOpen(false);
		}
	}, [isOpen]);

	useEffect(() => {
		if(selectedGameVersion && !quickDownloadOptions?.some((option) => option.gameVersion === selectedGameVersion)) {
			setSelectedGameVersion("");
		}
	}, [quickDownloadOptions, selectedGameVersion]);

	useEffect(() => {
		if(!isVersionPopoverOpen) {
			return;
		}

		const handlePointerDown = (event) => {
			const isInsideSelector = versionSelectorRef.current?.contains(event.target);
			const isInsidePopover = versionPopoverRef.current?.contains(event.target);

			if(!isInsideSelector && !isInsidePopover) {
				setIsVersionPopoverOpen(false);
			}
		};

		document.addEventListener("mousedown", handlePointerDown);
		return () => document.removeEventListener("mousedown", handlePointerDown);
	}, [isVersionPopoverOpen]);

	const updateVersionPopoverPosition = useCallback(() => {
		const trigger = versionTriggerRef.current;
		if(!trigger) {
			return;
		}

		const viewportPadding = 12;
		const gap = 8;
		const triggerRect = trigger.getBoundingClientRect();
		const width = Math.min(triggerRect.width, window.innerWidth - viewportPadding * 2);
		const left = Math.min(Math.max(triggerRect.left, viewportPadding), window.innerWidth - width - viewportPadding);
		const availableBelow = window.innerHeight - triggerRect.bottom - gap - viewportPadding;
		const availableAbove = triggerRect.top - gap - viewportPadding;
		const openAbove = availableBelow < 160 && availableAbove > availableBelow;
		const availableHeight = Math.max(96, Math.min(280, openAbove ? availableAbove : availableBelow));

		setVersionPopoverStyle({
			left,
			width,
			top: openAbove ? "auto" : triggerRect.bottom + gap,
			bottom: openAbove ? window.innerHeight - triggerRect.top + gap : "auto",
			"--version-popover-max-height": `${availableHeight}px`,
		});
	}, []);

	useLayoutEffect(() => {
		if(!isVersionPopoverOpen) {
			setVersionPopoverStyle(null);
			return;
		}

		updateVersionPopoverPosition();
		const frameId = requestAnimationFrame(updateVersionPopoverPosition);
		const handleViewportChange = () => updateVersionPopoverPosition();

		window.addEventListener("resize", handleViewportChange);
		window.addEventListener("scroll", handleViewportChange, true);

		return () => {
			cancelAnimationFrame(frameId);
			window.removeEventListener("resize", handleViewportChange);
			window.removeEventListener("scroll", handleViewportChange, true);
		};
	}, [isVersionPopoverOpen, updateVersionPopoverPosition]);

	useLayoutEffect(() => {
		const elements = [selectedVersionRef.current, selectedDependenciesRef.current].filter(Boolean);
		if(!isOpen || !hasSelectedOption || elements.length === 0) {
			return undefined;
		}

		const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
		const animations = elements.map((element) => {
			element.getAnimations().forEach((animation) => animation.cancel());
			return element.animate(
				reduceMotion
					? [{ opacity: 0 }, { opacity: 1 }]
					: [
						{ opacity: 0, transform: "translateY(8px)" },
						{ opacity: 1, transform: "translateY(0)" },
					],
				{
					duration: reduceMotion ? 120 : 220,
					easing: "cubic-bezier(0.23, 1, 0.32, 1)",
				}
			);
		});

		return () => animations.forEach((animation) => animation.cancel());
	}, [hasSelectedOption, isOpen]);

	const handleVersionSelectorKeyDown = (event) => {
		if(event.key !== "Escape" || !isVersionPopoverOpen) {
			return;
		}

		event.preventDefault();
		event.stopPropagation();
		setIsVersionPopoverOpen(false);
		versionTriggerRef.current?.focus();
	};

	const handleDependencyDownloadClick = () => {
		showOverTheTopDownloadAnimation();
	};

	const handleVersionDownloadClick = () => {
		showOverTheTopDownloadAnimation();
	};

	const versionPopover = isVersionPopoverOpen && typeof document !== "undefined" ? createPortal(
		<div ref={versionPopoverRef} id="quick-download-game-version-options" className="popover version-download-modal__version-popover" style={versionPopoverStyle || undefined}>
			<div className="context-list" data-scrollable>
				{quickDownloadOptions.map((option) => (
					<button key={option.gameVersion} type="button" className={`context-list-option version-download-modal__version-option ${selectedGameVersion === option.gameVersion ? "context-list-option--selected" : ""}`} onClick={() => { setSelectedGameVersion(option.gameVersion); setIsVersionPopoverOpen(false); }} aria-label={tProject("quickDownload.optionAria", { gameVersion: option.gameVersion })}>
						<span className="context-list-option__label">{option.gameVersion}</span>
					</button>
				))}
			</div>
		</div>,
		document.body
	) : null;

	return (
		<Modal closeTimeoutMS={150} isOpen={isOpen} onRequestClose={onRequestClose} className="modal active version-download-modal" overlayClassName="modal-overlay">
			<div className="modal-window">
				<div className="modal-window__header version-download-modal__header">
					<div className="version-download-modal__project">
						<img src={projectIconUrl} alt="" width="32" height="32" className="version-download-modal__project-icon" />

						<div className="version-download-modal__project-text">
							<h2 className="modal-window__title">{project?.title || tProject("projectNotFound")}</h2>
						</div>
					</div>

					<button className="icon-button modal-window__close" type="button" onClick={onRequestClose} aria-label={tProject("close")}>
						<svg className="icon icon--cross" height="24" width="24">
							<path fillRule="evenodd" clipRule="evenodd" d="M5.293 5.293a1 1 0 0 1 1.414 0L12 10.586l5.293-5.293a1 1 0 0 1 1.414 1.414L13.414 12l5.293 5.293a1 1 0 0 1-1.414 1.414L12 13.414l-5.293 5.293a1 1 0 0 1-1.414-1.414L10.586 12 5.293 6.707a1 1 0 0 1 0-1.414Z" />
						</svg>
					</button>
				</div>

				<div className="modal-window__content version-download-modal__content">
					<p className="version-download-modal__intro">{isQuickDownload ? tProject("quickDownload.description") : t("description")}</p>

					{isQuickDownload ? (
						<div className="version-download-modal__selection">
							{isLoading ? <div className="version-download-modal__message" role="status">{tProject("quickDownload.loading")}</div> : null}

							{loadError ? <button type="button" className="button button--size-l button--type-minimal" onClick={onRetry}>{tProject("quickDownload.error")}</button> : null}

							{!isLoading && !loadError && quickDownloadOptions.length === 0 ? <div className="version-download-modal__message">{tProject("quickDownload.empty")}</div> : null}

							{!isLoading && !loadError && quickDownloadOptions.length > 0 ? (
								<div className="field field--default version-download-modal__version-selector" ref={versionSelectorRef} onKeyDown={handleVersionSelectorKeyDown}>
									<label id="quick-download-game-version-label">{tProject("quickDownload.title")}</label>

									<button ref={versionTriggerRef} type="button" className="button button--size-l button--type-minimal version-download-modal__version-trigger" onClick={() => setIsVersionPopoverOpen((current) => !current)} aria-expanded={isVersionPopoverOpen} aria-controls="quick-download-game-version-options" aria-labelledby="quick-download-game-version-label quick-download-game-version-value">
										<span id="quick-download-game-version-value">{selectedGameVersion || tProject("quickDownload.placeholder")}</span>

										<svg className={`icon icon--chevron_down ${isVersionPopoverOpen ? "rotate" : ""}`} width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
											<path fillRule="evenodd" clipRule="evenodd" d="M17.707 8.793a1 1 0 0 1 0 1.414l-5 5a1 1 0 0 1-1.414 0l-5-5a1 1 0 1 1 1.414-1.414L12 13.086l4.293-4.293a1 1 0 0 1 1.414 0Z" fill="currentColor" />
										</svg>
									</button>

									{versionPopover}
								</div>
							) : null}
						</div>
					) : null}

					{isQuickDownload && selectedOption ? (
						<div ref={selectedVersionRef} className="version-download-modal__selected-version">
							<div className="version-download-modal__selected-version-copy">
								<strong>
									{selectedVersionHref ? <Link href={selectedVersionHref} className="version-download-modal__selected-version-link" onClick={onRequestClose}>{selectedVersion.version_number}</Link> : selectedVersion.version_number}
								</strong>

								<span className="version-download-modal__selected-game-version">
									<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
										<line x1="6" x2="10" y1="11" y2="11" />
										<line x1="8" x2="8" y1="9" y2="13" />
										<line x1="15" x2="15.01" y1="12" y2="12" />
										<line x1="18" x2="18.01" y1="10" y2="10" />
										<path d="M17.32 5H6.68a4 4 0 0 0-3.978 3.59c-.006.052-.01.101-.017.152C2.604 9.416 2 14.456 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.414-1.414A2 2 0 0 1 9.828 16h4.344a2 2 0 0 1 1.414.586L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.545-.604-6.584-.685-7.258-.007-.05-.011-.1-.017-.151A4 4 0 0 0 17.32 5z" />
									</svg>

									{selectedGameVersion}
								</span>
							</div>

							{selectedDownloadHref ? (
								<a className="button button--size-m button--type-download button--with-icon button--active-transform" href={selectedDownloadHref} download onClick={handleVersionDownloadClick} aria-label={tProject("downloadVersionAria", { version: selectedVersion.version_number })}>
									<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
										<path d="M12 15V3" />
										<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
										<path d="m7 10 5 5 5-5" />
									</svg>

									{tProject("download")}
								</a>
							) : null}
						</div>
					) : null}

					{(!isQuickDownload || selectedOption) && selectedDependencies.length > 0 ? (
						<div ref={isQuickDownload ? selectedDependenciesRef : null} className="version-download-modal__dependency-section">
							{isQuickDownload ? <h3>{tProject("quickDownload.dependenciesTitle")}</h3> : null}

							<div className="version-download-modal__dependencies">
								{selectedDependencies.map((dependency, index) => {
									const dependencyName = dependency.project_title || dependency.project_slug || dependency.project_id || tProject("versions.dependencies.unknownDependency");
									const dependencyVersion = dependency.version_number || dependency.version_name || dependency.version_id || t("anyVersion");
									const dependencyIconUrl = dependency.project_icon_url || "/images/no-project-icon.svg";
									const dependencyHref = getDependencyVersionPath(dependency);
									const dependencyDownloadHref = getDependencyDownloadHref(dependency);

									return (
										<div key={`${dependency.project_id || dependency.project_slug || "dependency"}:${dependency.version_id || "any"}:${index}`} className="version-download-modal__dependency">
											{dependencyHref ? (
												<Link href={dependencyHref} target="_blank" rel="noopener noreferrer" className="version-download-modal__dependency-icon-link" aria-label={t("openDependency", { dependency: dependencyName })}>
													<img src={dependencyIconUrl} alt="" width="44" height="44" loading="lazy" className="version-download-modal__dependency-icon" />
												</Link>
											) : <img src={dependencyIconUrl} alt="" width="44" height="44" loading="lazy" className="version-download-modal__dependency-icon" />}

											<div className="version-download-modal__dependency-main">
												{dependencyHref ? (
													<Link href={dependencyHref} target="_blank" rel="noopener noreferrer" className="version-download-modal__dependency-name">{dependencyName}</Link>
												) : <p className="version-download-modal__dependency-name">{dependencyName}</p>}

												<span>{dependencyVersion}</span>
											</div>

											<div className="version-download-modal__dependency-actions">
												{dependencyDownloadHref && (
													<a className="button button--size-m button--type-download button-with-icon button--active-transform" href={dependencyDownloadHref} download onClick={() => handleDependencyDownloadClick(dependency)}>
														<svg className="masthead-stats__icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
															<path d="M12 15V3" />
															<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
															<path d="m7 10 5 5 5-5" />
														</svg>

														{tProject("download")}
													</a>
												)}

												{dependencyHref && (
													<Link href={dependencyHref} className="icon-button button--active-transform" onClick={onRequestClose} aria-label={t("openDependency", { dependency: dependencyName })}>
														<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
															<path d="M15 3h6v6"/>
															<path d="M10 14 21 3"/>
															<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
														</svg>
													</Link>
												)}
											</div>
										</div>
									);
								})}
							</div>
						</div>
					) : null}
				</div>
			</div>
		</Modal>
	);
}