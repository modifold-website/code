const PROJECT_DETAILS_DEFAULT_VERSION_LIMIT = 100;
const PROJECT_DETAILS_MAX_VERSION_LIMIT = 100;
const PROJECT_DETAILS_MAX_VERSION_OFFSET = 1000;

const parseVersionInteger = (value, { name, fallback, maximum }) => {
	if(value === undefined || value === null || value === "") {
		return fallback;
	}
	
	if(!/^\d+$/.test(String(value).trim())) {
		const error = new Error(`Invalid ${name}`);
		error.statusCode = 400;
		throw error;
	}

	const parsed = Number(value);
	if(!Number.isSafeInteger(parsed) || parsed < 0 || parsed > maximum) {
		const error = new Error(`${name} is too large or invalid`);
		error.statusCode = 400;
		throw error;
	}
	
	return parsed;
};

const getProjectVersionPage = (query = {}) => {
	const requestedLimit = parseVersionInteger(query.versions_limit, {
		name: "versions_limit",
		fallback: PROJECT_DETAILS_DEFAULT_VERSION_LIMIT,
		maximum: Number.MAX_SAFE_INTEGER,
	});
	const limit = Math.min(PROJECT_DETAILS_MAX_VERSION_LIMIT, requestedLimit);
	const offset = parseVersionInteger(query.versions_offset, {
		name: "versions_offset",
		fallback: 0,
		maximum: PROJECT_DETAILS_MAX_VERSION_OFFSET,
	});

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
			avatar: project.organization_icon_url || "https://modifold.com/images/no-project-icon.svg",
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
	PROJECT_DETAILS_MAX_VERSION_OFFSET,
	buildProjectOwnerDto,
	buildVersionsPagination,
	getProjectVersionPage,
};