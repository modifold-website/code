"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import UserName from "@/components/ui/UserName";
import { getCategoryLabel } from "@/utils/categoryLabels";
import { getProjectPath } from "@/utils/projectRoutes";
import { ProjectStatDownloads } from "./DiscoverProjectRail";

function LatestProjectCardContent({ project, tCategoryLabels, imageLoading = "lazy" }) {
	const projectIcon = project.icon_url || "https://media.modifold.com/static/no-project-icon.svg";
	const ownerAvatar = project.owner?.avatar || "https://media.modifold.com/static/no-project-icon.svg";
	const visibleTags = (project.tags || []).slice(0, 1);
	const hiddenTagCount = Math.max(0, (project.tags || []).length - visibleTags.length);

	return (
		<>
			<div className="discover-latest-card__icon">
				<img key={projectIcon} src={projectIcon} alt="" loading={imageLoading} />
			</div>

			<div className="discover-latest-card__content">
				<span className="discover-latest-card__title">{project.title}</span>
				
				<span className="discover-latest-card__author">
					<img key={ownerAvatar} className="discover-author__avatar" src={ownerAvatar} alt="" loading={imageLoading} />
					
					<UserName user={project.owner} className="discover-author__name" />
				</span>

				{project.summary && <p className="discover-latest-card__summary">{project.summary}</p>}

				<div className="discover-latest-card__meta">
					<ProjectStatDownloads project={project} />
				</div>

				<div className="discover-latest-card__expanded">
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

function LatestProjectCard({ project, tCategoryLabels, onPreviewOpen }) {
	const openPreview = (event) => {
		onPreviewOpen(project, event.currentTarget);
	};

	return (
		<Link href={getProjectPath(project)} className="discover-latest-card" onMouseEnter={openPreview} onFocus={openPreview}>
			<LatestProjectCardContent project={project} tCategoryLabels={tCategoryLabels} />
		</Link>
	);
}

function LatestProjectCardPreview({ preview, tCategoryLabels }) {
	if(!preview) {
		return null;
	}

	const previewKey = preview.project.id || preview.project.slug;

	return (
		<Link
			key={previewKey}
			href={getProjectPath(preview.project)}
			className={`discover-latest-card discover-latest-card--preview ${preview.isClosing ? "is-closing" : ""}`}
			style={{
				left: `${preview.left}px`,
				top: `${preview.top}px`,
				width: `${preview.width}px`,
			}}
		>
			<LatestProjectCardContent project={preview.project} tCategoryLabels={tCategoryLabels} imageLoading="eager" />
		</Link>
	);
}

export default function LatestProjects({ projects, t, viewAllHref }) {
	const tCategoryLabels = useTranslations("CategoryLabels");
	const shellRef = useRef(null);
	const closePreviewTimerRef = useRef(null);
	const [preview, setPreview] = useState(null);

	useEffect(() => () => {
		window.clearTimeout(closePreviewTimerRef.current);
	}, []);

	const openPreview = (project, cardNode) => {
		const shell = shellRef.current;
		if(!shell || !cardNode) {
			return;
		}

		window.clearTimeout(closePreviewTimerRef.current);
		const shellRect = shell.getBoundingClientRect();
		const cardRect = cardNode.getBoundingClientRect();

		setPreview({
			project,
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

	return (
		<section className="discover-section">
			<div className="discover-section__header">
				<h2>{t("latest")}</h2>
				
				<Link href={viewAllHref} className="button button--size-m button--type-secondary button--active-transform">
					{t("viewAll")}
				</Link>
			</div>

			<div ref={shellRef} className={`discover-latest-shell ${preview ? "discover-latest-shell--preview-open" : ""}`} onMouseLeave={closePreview} onBlur={(event) => {
				if(!event.currentTarget.contains(event.relatedTarget)) {
					closePreview();
				}
			}}>
				<div className="discover-latest-grid">
					{projects.map((project) => (
						<LatestProjectCard key={project.id || project.slug} project={project} tCategoryLabels={tCategoryLabels} onPreviewOpen={openPreview} />
					))}
				</div>

				<LatestProjectCardPreview key={preview?.project?.id || preview?.project?.slug || "empty"} preview={preview} tCategoryLabels={tCategoryLabels} />
			</div>
		</section>
	);
}