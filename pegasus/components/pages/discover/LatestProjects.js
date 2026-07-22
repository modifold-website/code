"use client";

import Link from "next/link";
import UserName from "@/components/ui/UserName";
import { getProjectPath } from "@/utils/projectRoutes";
import { ProjectStatDownloads } from "./DiscoverProjectRail";

function LatestProjectCard({ project }) {
	const ownerAvatar = project.owner?.avatar || "https://media.modifold.com/static/no-project-icon.svg";

	return (
		<Link href={getProjectPath(project)} className="discover-latest-card">
			<img className="discover-latest-card__icon" src={project.icon_url || "https://media.modifold.com/static/no-project-icon.svg"} alt="" loading="lazy" />

			<div className="discover-latest-card__content">
				<span className="discover-latest-card__title">{project.title}</span>
				
				<span className="discover-latest-card__author">
					<img className="discover-author__avatar" src={ownerAvatar} alt="" loading="lazy" />
					
					<UserName user={project.owner} className="discover-author__name" />
				</span>

				<div className="discover-latest-card__meta">
					<ProjectStatDownloads project={project} />
				</div>
			</div>
		</Link>
	);
}

export default function LatestProjects({ projects, t, viewAllHref }) {
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

			<div className="discover-latest-grid">
				{projects.map((project) => (
					<LatestProjectCard key={project.id || project.slug} project={project} />
				))}
			</div>
		</section>
	);
}