"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import DownloadCount from "@/components/ui/DownloadCount";
import Tooltip from "@/components/ui/Tooltip";
import UserName from "@/components/ui/UserName";
import { getCategoryLabel } from "@/utils/categoryLabels";
import { getProjectPath } from "@/utils/projectRoutes";
import { getOwnerHref, getProjectIcon, getProjectImage } from "./discoverHelpers";

const PREVIEW_EDGE_GUARD_PX = 76;

export function ProjectStatDownloads({ project, useWeekly = false }) {
	return (
		<div className="new-stat" style={{ fontWeight: "400" }}>
			<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-download-icon lucide-download">
				<path d="M12 15V3"/>
				<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
				<path d="m7 10 5 5 5-5"/>
			</svg>

			<DownloadCount value={useWeekly ? project.weekly_downloads : project.downloads} />
		</div>
	);
}

function ProjectCardContent({ project, tCategoryLabels, useWeeklyDownloads = false, imageLoading = "lazy" }) {
	const locale = useLocale();
	const tProjectCard = useTranslations("ProjectCard");
	const relativeNow = new Date();
	const updatedDate = project.updated_at || project.created_at;
	const visibleTags = (project.tags || []).slice(0, 1);
	const hiddenTagCount = Math.max(0, (project.tags || []).length - visibleTags.length);
	const projectImage = getProjectImage(project);
	const projectIcon = getProjectIcon(project);
	const ownerAvatar = project.owner?.avatar || "https://media.modifold.com/static/no-project-icon.svg";

	const formatRelativeDate = (dateString) => {
		const date = new Date(dateString);

		if(Number.isNaN(date.getTime())) {
			return "";
		}

		const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
		const diffMs = date - relativeNow;
		const seconds = Math.round(diffMs / 1000);
		const minutes = Math.round(seconds / 60);
		const hours = Math.round(minutes / 60);
		const days = Math.round(hours / 24);
		const months = Math.round(days / 30);
		const years = Math.round(days / 365);

		if(Math.abs(seconds) < 60) {
			return rtf.format(seconds, "second");
		}

		if(Math.abs(minutes) < 60) {
			return rtf.format(minutes, "minute");
		}

		if(Math.abs(hours) < 24) {
			return rtf.format(hours, "hour");
		}

		if(Math.abs(days) < 30) {
			return rtf.format(days, "day");
		}

		if(Math.abs(months) < 12) {
			return rtf.format(months, "month");
		}

		return rtf.format(years, "year");
	};

	const formatUpdatedTooltip = (dateString) => {
		const date = new Date(dateString);

		if(Number.isNaN(date.getTime())) {
			return "";
		}

		const options = {
			day: "numeric",
			month: "long",
			hour: "2-digit",
			minute: "2-digit",
		};

		if(date.getFullYear() !== relativeNow.getFullYear()) {
			options.year = "numeric";
		}

		return `${tProjectCard("updated")} ${new Intl.DateTimeFormat(locale, options).format(date)}`;
	};

	const relativeDate = formatRelativeDate(updatedDate);
	const updatedTooltip = formatUpdatedTooltip(updatedDate);

	return (
		<>
			<Link className="discover-project-card__overlay" href={getProjectPath(project)} aria-label={project.title} />

			<div className="discover-project-card__head card-head">
				<img key={`cover:${projectImage}`} className="discover-project-card__cover resource-cover" src={projectImage} alt="" loading={imageLoading} />
				
				<img key={`logo:${projectIcon}`} className="discover-project-card__logo resource-logo-lg" src={projectIcon} alt="" loading={imageLoading} />
			</div>

			<div className="discover-project-card__body">
				<Link href={getProjectPath(project)} className="discover-project-card__title">{project.title}</Link>
				
				<span className="discover-project-card__author">
					<Link href={getOwnerHref(project)}>
						<img key={`owner:${ownerAvatar}`} className="discover-author__avatar" src={ownerAvatar} alt="" loading={imageLoading} />
						
						<UserName user={project.owner} className="discover-author__name" />
					</Link>
				</span>

				{project.summary && <p className="discover-project-card__summary">{project.summary}</p>}

				<div className="new-project-bottom">
					<div className="new-stat" style={{ fontWeight: "400" }}>
						<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-download-icon lucide-download">
							<path d="M12 15V3"/>
							<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
							<path d="m7 10 5 5 5-5"/>
						</svg>

						<DownloadCount value={useWeeklyDownloads ? project.weekly_downloads : project.downloads} />
					</div>

					{relativeDate && (
						<div className="new-stat new-updated">
							<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" className="lucide lucide-heart-icon lucide-update">
								<path d="M3 3v5h5"></path>
								<path d="M3.05 13A9 9 0 1 0 6 5.3L3 8"></path>
								<path d="M12 7v5l4 2"></path>
							</svg>

							<Tooltip content={updatedTooltip}>
								<span>{relativeDate}</span>
							</Tooltip>
						</div>
					)}
				</div>

				<div className="discover-project-card__expanded">
					{visibleTags.length > 0 && (
						<div className="discover-project-card__tags">
							{visibleTags.map((tag) => (
								<span key={tag} className="discover-project-card__tag">{getCategoryLabel(tCategoryLabels, tag)}</span>
							))}

							{hiddenTagCount > 0 && <span className="discover-project-card__tag-more">+{hiddenTagCount}</span>}
						</div>
					)}
				</div>
			</div>
		</>
	);
}

function DiscoverProjectCard({ project, tCategoryLabels, useWeeklyDownloads = false, onPreviewOpen }) {
	const openPreview = (event) => {
		onPreviewOpen(project, event.currentTarget, useWeeklyDownloads);
	};

	return (
		<article className="discover-project-card" onMouseEnter={openPreview} onFocus={openPreview}>
			<ProjectCardContent project={project} tCategoryLabels={tCategoryLabels} useWeeklyDownloads={useWeeklyDownloads} />
		</article>
	);
}

function DiscoverProjectCardPreview({ preview, tCategoryLabels }) {
	if(!preview) {
		return null;
	}

	const previewKey = preview.project.id || preview.project.slug;

	return (
		<article
			key={previewKey}
			className={`discover-project-card discover-project-card--preview ${preview.isClosing ? "is-closing" : ""}`}
			style={{
				left: `${preview.left}px`,
				top: `${preview.top}px`,
				width: `${preview.width}px`,
			}}
		>
			<ProjectCardContent project={preview.project} tCategoryLabels={tCategoryLabels} useWeeklyDownloads={preview.useWeeklyDownloads} imageLoading="eager" />
		</article>
	);
}

export default function DiscoverProjectRail({ title, titleIcon = null, projects, t, tCategoryLabels, viewAllHref, useWeeklyDownloads = false }) {
	const shellRef = useRef(null);
	const scrollerRef = useRef(null);
	const hasUserInteractedRef = useRef(false);
	const closePreviewTimerRef = useRef(null);
	const [scrollState, setScrollState] = useState({ canScrollPrev: false, canScrollNext: false, hasUserMoved: false });
	const [preview, setPreview] = useState(null);

	const updateScrollState = ({ markMoved = false } = {}) => {
		const scroller = scrollerRef.current;
		if(!scroller) {
			return;
		}

		const maxScrollLeft = Math.max(0, scroller.scrollWidth - scroller.clientWidth);
		const scrollLeft = Math.max(0, scroller.scrollLeft);
		setScrollState((state) => ({
			canScrollPrev: scrollLeft > 2,
			canScrollNext: scrollLeft < maxScrollLeft - 2,
			hasUserMoved: state.hasUserMoved || (markMoved && scrollLeft > 2),
		}));
	};

	useEffect(() => {
		updateScrollState();

		const scroller = scrollerRef.current;
		if(!scroller) {
			return;
		}

		const markUserInteraction = () => {
			hasUserInteractedRef.current = true;
		};
		const handleKeyDown = (event) => {
			if(["ArrowLeft", "ArrowRight", "Home", "End", "PageUp", "PageDown"].includes(event.key)) {
				hasUserInteractedRef.current = true;
			}
		};
		const handleScroll = () => window.requestAnimationFrame(() => updateScrollState({ markMoved: hasUserInteractedRef.current }));
		const handleResize = () => {
			setPreview(null);
			updateScrollState();
		};
		window.addEventListener("resize", handleResize);
		scroller.addEventListener("wheel", markUserInteraction, { passive: true });
		scroller.addEventListener("pointerdown", markUserInteraction, { passive: true });
		scroller.addEventListener("touchstart", markUserInteraction, { passive: true });
		scroller.addEventListener("keydown", handleKeyDown);
		scroller.addEventListener("scroll", handleScroll, { passive: true });

		return () => {
			window.removeEventListener("resize", handleResize);
			scroller.removeEventListener("wheel", markUserInteraction);
			scroller.removeEventListener("pointerdown", markUserInteraction);
			scroller.removeEventListener("touchstart", markUserInteraction);
			scroller.removeEventListener("keydown", handleKeyDown);
			scroller.removeEventListener("scroll", handleScroll);
		};
	}, [projects]);

	useEffect(() => () => {
		window.clearTimeout(closePreviewTimerRef.current);
	}, []);

	const openPreview = (project, cardNode, cardUsesWeeklyDownloads) => {
		const shell = shellRef.current;
		if(!shell || !cardNode) {
			return;
		}

		window.clearTimeout(closePreviewTimerRef.current);
		const shellRect = shell.getBoundingClientRect();
		const cardRect = cardNode.getBoundingClientRect();
		const isBlockedByLeftArrow = scrollState.canScrollPrev && cardRect.left < shellRect.left + PREVIEW_EDGE_GUARD_PX;
		const isBlockedByRightArrow = scrollState.canScrollNext && cardRect.right > shellRect.right - PREVIEW_EDGE_GUARD_PX;

		if(isBlockedByLeftArrow || isBlockedByRightArrow) {
			closePreview();
			return;
		}

		setPreview({
			project,
			useWeeklyDownloads: cardUsesWeeklyDownloads,
			left: cardRect.left - shellRect.left,
			top: cardRect.top - shellRect.top,
			width: cardRect.width,
			isClosing: false,
		});
	};

	const closePreview = () => {
		setPreview((currentPreview) => {
			if(!currentPreview || currentPreview.isClosing) {
				return currentPreview;
			}

			window.clearTimeout(closePreviewTimerRef.current);
			closePreviewTimerRef.current = window.setTimeout(() => {
				setPreview(null);
			}, 220);

			return {
				...currentPreview,
				isClosing: true,
			};
		});
	};

	if(!projects?.length) {
		return null;
	}

	const scroll = (direction) => {
		const scroller = scrollerRef.current;
		if(!scroller) {
			return;
		}

		if(direction < 0 && !scrollState.canScrollPrev) {
			return;
		}

		if(direction > 0 && !scrollState.canScrollNext) {
			return;
		}

		closePreview();
		hasUserInteractedRef.current = true;
		setScrollState((state) => ({
			...state,
			hasUserMoved: true,
		}));

		const firstCard = scroller.querySelector(".discover-project-card");
		const scrollerStyles = window.getComputedStyle(scroller);
		const gap = Number.parseFloat(scrollerStyles.columnGap || scrollerStyles.gap || "16") || 16;
		const cardWidth = firstCard?.getBoundingClientRect().width || 280;

		scroller.scrollBy({
			left: direction * (cardWidth + gap),
			behavior: "smooth",
		});
	};

	return (
		<section className="discover-section">
			<div className="discover-section__header">
				<h2 className="discover-section__title">
					{titleIcon && <span className="discover-section__title-icon" aria-hidden="true">{titleIcon}</span>}
					{title}
				</h2>

				{viewAllHref && (
					<Link href={viewAllHref} className="button button--size-m button--type-secondary button--active-transform">
						{t("viewAll")}
					</Link>
				)}
			</div>

			<div ref={shellRef} className={`discover-rail-shell ${preview ? "discover-rail-shell--preview-open" : ""} ${!scrollState.hasUserMoved || !scrollState.canScrollPrev ? "discover-rail-shell--at-start" : ""} ${!scrollState.canScrollNext ? "discover-rail-shell--at-end" : ""}`} onMouseLeave={closePreview} onBlur={(event) => {
				if(!event.currentTarget.contains(event.relatedTarget)) {
					closePreview();
				}
			}}>
				<button type="button" className="discover-rail-arrow discover-rail-arrow--left" onClick={() => scroll(-1)} aria-label={t("previous")} disabled={!scrollState.canScrollPrev} aria-disabled={!scrollState.canScrollPrev}>
					<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-chevron-left-icon lucide-chevron-left">
						<path d="m15 18-6-6 6-6"/>
					</svg>
				</button>

				<div ref={scrollerRef} className="discover-project-rail">
					{projects.map((project) => (
						<DiscoverProjectCard key={project.id || project.slug} project={project} tCategoryLabels={tCategoryLabels} useWeeklyDownloads={useWeeklyDownloads} onPreviewOpen={openPreview} />
					))}
				</div>

				<DiscoverProjectCardPreview key={preview?.project?.id || preview?.project?.slug || "empty"} preview={preview} tCategoryLabels={tCategoryLabels} />

				<button type="button" className="discover-rail-arrow discover-rail-arrow--right" onClick={() => scroll(1)} aria-label={t("next")} disabled={!scrollState.canScrollNext} aria-disabled={!scrollState.canScrollNext}>
					<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-chevron-right-icon lucide-chevron-right">
						<path d="m9 18 6-6-6-6"/>
					</svg>
				</button>
			</div>
		</section>
	);
}