"use client";

import { useEffect, useState } from "react";
import Modal from "react-modal";
import BrowseFiltersSidebar from "@/components/pages/browse/BrowseFiltersSidebar";

function FilterSelection({ t, filters, sidebarProps, onApply, onClose }) {
	const [draft, setDraft] = useState(filters);
	const hasFilters = draft.selectedTags.length > 0 || draft.selectedGameVersions.length > 0 || draft.useDefaultGameVersions || Boolean(draft.dependencyProjectId);

	const toggleTag = (tag) => {
		setDraft((previous) => ({
			...previous,
			selectedTags: previous.selectedTags.includes(tag) ? previous.selectedTags.filter((item) => item !== tag) : [...previous.selectedTags, tag],
		}));
	};

	const toggleGameVersion = (version) => {
		setDraft((previous) => {
			const selectedGameVersions = previous.useDefaultGameVersions ? [] : previous.selectedGameVersions;

			return {
				...previous,
				selectedGameVersions: selectedGameVersions.includes(version) ? selectedGameVersions.filter((item) => item !== version) : [...selectedGameVersions, version],
				useDefaultGameVersions: false,
			};
		});
	};

	const selectGameVersionGroup = (versions, options = {}) => {
		setDraft((previous) => {
			const groupVersions = [...new Set(versions)];
			const isSelected = (previous.useDefaultGameVersions && options.isDefault) || groupVersions.every((version) => previous.selectedGameVersions.includes(version));

			return {
				...previous,
				selectedGameVersions: isSelected ? previous.selectedGameVersions.filter((version) => !groupVersions.includes(version)) : [...new Set([...previous.selectedGameVersions, ...groupVersions])],
				useDefaultGameVersions: false,
			};
		});
	};

	const clearFilters = () => {
		setDraft({
			selectedTags: [],
			selectedGameVersions: [],
			useDefaultGameVersions: false,
			dependencyProjectId: "",
			dependencyType: "required",
		});
	};

	return (
		<div className="modal-window">
			<div className="modal-window__header">
				<h2 className="modal-window__title">{t("mobileFilters.title")}</h2>

				<button type="button" className="icon-button modal-window__close" onClick={onClose} aria-label={t("mobileFilters.close")}>
					<svg className="icon icon--cross" width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
						<path d="m6 6 12 12M18 6 6 18" fill="none" stroke="currentColor" strokeWidth="2" />
					</svg>
				</button>
			</div>

			<div className="modal-window__content browse-filters-modal__body">
				<BrowseFiltersSidebar
					{...sidebarProps}
					t={t}
					selectedTags={draft.selectedTags}
					selectedGameVersions={draft.selectedGameVersions}
					useDefaultGameVersions={draft.useDefaultGameVersions}
					selectedDependencyProjectId={draft.dependencyProjectId}
					dependencyType={draft.dependencyType}
					onToggleTag={toggleTag}
					onToggleGameVersion={toggleGameVersion}
					onSelectGameVersionGroup={selectGameVersionGroup}
					onSelectDependencyProject={(projectId) => setDraft((previous) => ({ ...previous, dependencyProjectId: projectId, dependencyType: "required" }))}
					onSelectDependencyType={(dependencyType) => setDraft((previous) => ({ ...previous, dependencyType }))}
					onClearDependency={() => setDraft((previous) => ({ ...previous, dependencyProjectId: "", dependencyType: "required" }))}
					hideClearButton
				/>
			</div>

			<div className="browse-filters-modal__actions">
				<button type="button" className="button button--size-l button--type-minimal" onClick={clearFilters} disabled={!hasFilters}>
					{t("mobileFilters.reset")}
				</button>

				<button type="button" className="button button--size-l button--type-primary" onClick={() => onApply(draft)}>
					{t("mobileFilters.apply")}
				</button>
			</div>
		</div>
	);
}

export default function BrowseFiltersModal({ isOpen, onClose, onApply, t, filters, sidebarProps }) {
	const appElement = typeof document !== "undefined" ? document.querySelector(".browse-page") : undefined;

	useEffect(() => {
		if(!isOpen) {
			return;
		}

		const siblings = [...document.body.children].filter((element) => !element.classList.contains("ReactModalPortal"));
		const previous = siblings.map((element) => element.inert);
		const desktop = window.matchMedia("(min-width: 860px)");
		const handleResize = () => {
			if(desktop.matches) {
				onClose();
			}
		};

		siblings.forEach((element) => {
			element.inert = true;
		});
		desktop.addEventListener("change", handleResize);

		return () => {
			siblings.forEach((element, index) => { element.inert = previous[index]; });
			desktop.removeEventListener("change", handleResize);
		};
	}, [isOpen, onClose]);

	return (
		<Modal isOpen={isOpen} onRequestClose={onClose} closeTimeoutMS={150} appElement={appElement} contentLabel={t("mobileFilters.title")} className="modal active browse-filters-modal" overlayClassName="modal-overlay browse-filters-overlay" bodyOpenClassName="ReactModal__Body--open browse-filters-open">
			<FilterSelection t={t} filters={filters} sidebarProps={sidebarProps} onApply={onApply} onClose={onClose} />
		</Modal>
	);
}