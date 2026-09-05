const PROJECT_DETAILS_DEFAULT_VERSION_LIMIT = 100;
const PROJECT_DETAILS_MAX_VERSION_LIMIT = 100;

const getProjectVersionPage = (query = {}) => {
	const requestedLimit = Number.parseInt(query.versions_limit, 10);
	const requestedOffset = Number.parseInt(query.versions_offset, 10);
	const limit = Number.isFinite(requestedLimit) ? Math.max(0, Math.min(PROJECT_DETAILS_MAX_VERSION_LIMIT, requestedLimit)) : PROJECT_DETAILS_DEFAULT_VERSION_LIMIT;
	const offset = Number.isFinite(requestedOffset) ? Math.max(0, requestedOffset) : 0;

	return { limit, offset };
};

const buildVersionsPagination = ({ limit, offset, returned, hasMore }) => ({
	limit,
	offset,
	returned,
	has_more: hasMore,
	next_offset: hasMore ? offset + limit : null,
});

const buildProjectOwnerDto = (project, aggregates, normalizeOwnerRole) => {
	if(project.organization_id) {
		return {
			id: project.organization_id,
			username: project.organization_name,
			slug: project.organization_slug,
			avatar: project.organization_icon_url || "https://cdn.modifold.com/static/no-project-icon.svg",
			summary: project.organization_summary || "",
			isVerified: 0,
			type: "organization",
			profile_url: `/organization/${project.organization_slug}`,
			totalProjects: aggregates.totalProjects,
			totalDownloads: aggregates.totalDownloads,
		};
	}

	return {
		id: project.user_id,
		user_id: project.user_id,
		username: project.username,
		slug: project.user_slug,
		avatar: project.avatar,
		isVerified: project.isVerified,
		activeProfileBadge: project.activeProfileBadge,
		role: normalizeOwnerRole(project.owner_role),
		type: "user",
		profile_url: `/user/${project.user_slug}`,
		subscribers: aggregates.subscribers,
		totalProjects: aggregates.totalProjects,
		totalDownloads: aggregates.totalDownloads,
		isSubscribed: aggregates.isSubscribed,
		subscriptionId: aggregates.subscriptionId,
	};
};

module.exports = {
	PROJECT_DETAILS_DEFAULT_VERSION_LIMIT,
	PROJECT_DETAILS_MAX_VERSION_LIMIT,
	buildProjectOwnerDto,
	buildVersionsPagination,
	getProjectVersionPage,
};