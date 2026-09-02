export const SLIDE_INTERVAL_MS = 10000;

export function getProjectImage(project) {
	return project?.custom_image_url || project?.gallery?.[0]?.url || project?.icon_url || "https://cdn.modifold.com/static/no-project-icon.svg";
}

export function getProjectIcon(project) {
	return project?.icon_url || "https://cdn.modifold.com/static/no-project-icon.svg";
}

export function getOwnerHref(project) {
	return project?.owner?.profile_url || `/user/${project?.owner?.slug || ""}`;
}

export function getBrowseHref(projectType) {
	return `/${projectType === "mod" ? "mods" : `${projectType}s`}`;
}