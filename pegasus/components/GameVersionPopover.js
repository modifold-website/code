"use client";

import { useCallback, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";

function normalizeGameVersionOption(item) {
	if(typeof item === "string") {
		const version = item.trim();
		return version ? {
			version,
			label: version,
			version_type: version.includes("-pre") ? "pre-release" : "release",
		} : null;
	}

	if(item && typeof item.version === "string") {
		const version = item.version.trim();
		return version ? {
			version,
			label: item.label || version,
			version_type: item.version_type || (version.includes("-pre") ? "pre-release" : "release"),
		} : null;
	}

	return null;
}

export default function GameVersionPopover({ anchorRef, gameVersions, selectedVersions, onToggleVersion, releaseLabel, preReleaseLabel, floating = false, style }) {
	const [position, setPosition] = useState(null);

	const updatePosition = useCallback(() => {
		const anchor = anchorRef?.current;
		const modal = anchor?.closest(".version-game-versions-modal");
		if(!modal) {
			return;
		}

		const viewportPadding = 12;
		const gap = 10;
		const rect = anchor.getBoundingClientRect();
		const modalRect = modal.getBoundingClientRect();
		const width = Math.min(rect.width, window.innerWidth - viewportPadding * 2);
		const left = Math.min(Math.max(rect.left, viewportPadding), window.innerWidth - width - viewportPadding);
		const availableBelow = window.innerHeight - rect.bottom - gap - viewportPadding;
		const availableAbove = rect.top - gap - viewportPadding;
		const openAbove = availableBelow < 200 && availableAbove > availableBelow;
		const availableHeight = openAbove ? availableAbove : availableBelow;

		setPosition({
			left: left - modalRect.left,
			top: openAbove ? "auto" : rect.bottom - modalRect.top + gap,
			bottom: openAbove ? modalRect.bottom - rect.top + gap : "auto",
			"--width": `${width}px`,
			"--game-version-popover-max-height": `${Math.max(80, Math.min(200, availableHeight))}px`,
		});
	}, [anchorRef]);

	useLayoutEffect(() => {
		if(!floating) {
			return;
		}

		updatePosition();
		window.addEventListener("resize", updatePosition);
		window.addEventListener("scroll", updatePosition, true);

		return () => {
			window.removeEventListener("resize", updatePosition);
			window.removeEventListener("scroll", updatePosition, true);
		};
	}, [floating, updatePosition]);

	const options = (Array.isArray(gameVersions) ? gameVersions : []).map(normalizeGameVersionOption).filter(Boolean);
	const renderOption = (item) => (
		<button key={item.version} type="button" className={`context-list-option ${selectedVersions.includes(item.version) ? "context-list-option--selected" : ""}`} style={{ "--press-duration": "140ms" }} onClick={() => onToggleVersion(item.version)} aria-pressed={selectedVersions.includes(item.version)}>
			<span className="context-list-option__label">{item.label}</span>
		</button>
	);
	const grouped = Boolean(releaseLabel || preReleaseLabel);
	const groups = grouped ? options.reduce((acc, item) => {
		const group = item.version_type === "pre-release" ? "preReleases" : "releases";
		acc[group].push(item);
		return acc;
	}, { releases: [], preReleases: [] }) : null;
	const renderGroup = (label, versions) => versions.length > 0 ? (
		<div className="context-list-group" key={label}>
			<div className="context-list-group__title">{label}</div>
			
			{versions.map(renderOption)}
		</div>
	) : null;

	const popover = (
		<div className={`popover game-version-popover${floating ? " floating-game-version-popover" : ""}`} style={floating ? position || { visibility: "hidden" } : style}>
			<div className="context-list" data-scrollable>
				{grouped ? (
					<>
						{renderGroup(releaseLabel, groups.releases)}
						{renderGroup(preReleaseLabel, groups.preReleases)}
					</>
				) : options.map(renderOption)}
			</div>
		</div>
	);

	if(!floating) {
		return popover;
	}

	const modal = anchorRef?.current?.closest(".version-game-versions-modal");
	return modal ? createPortal(popover, modal) : null;
}