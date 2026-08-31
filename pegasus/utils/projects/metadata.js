import { getProjectBasePath } from "@/utils/projectRoutes";
import { getProjectTypeTitle } from "@/utils/projects/server";

const getDescription = (summary) => {
	const value = typeof summary === "string" ? summary.trim() : "";

	return value.length > 160 ? `${value.substring(0, 160 - 3)}...` : value;
};

export const getProjectMetadata = (project, path = "", { title: titleOverride, titleSuffix = "" } = {}) => {
	const basePath = getProjectBasePath(project.project_type);
	const projectTypeTitle = getProjectTypeTitle(project.project_type);
	const projectPath = path || `${basePath}/${project.slug}`;
	const url = `https://modifold.com${projectPath}`;
	const description = getDescription(project.summary);
	const title = titleOverride || `${project.title}${titleSuffix ? ` ${titleSuffix}` : ""} — ${projectTypeTitle} — Modifold`;
	const iconImage = project.icon_url || "https://media.modifold.com/static/no-project-icon.svg";

	return {
		title,
		description,
		keywords: `${project.title}, Hytale, mods, shaders, resource packs, modpacks, worlds, prefabs, maps, download Hytale prefabs, Modifold`,
		author: project.owner?.username,
		robots: "index, follow",
		alternates: {
			canonical: url,
			"x-default": url,
		},
		openGraph: {
			title,
			description,
			images: [
				{
					url: iconImage,
					alt: `${project.title} ${projectTypeTitle}`,
				},
			],
			url,
			type: "website",
			locale: "en_US",
		},
		twitter: {
			card: "summary",
			title,
			description,
			images: [iconImage],
		},
	};
};