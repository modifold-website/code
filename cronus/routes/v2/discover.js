const express = require("express");
const crypto = require("crypto");
const { db } = require("../../config/db");
const { clickhouse, hasClickHouseConfig } = require("../../config/clickhouse");
const { getCacheJson, setCacheJson } = require("../../utils/cache");

const router = express.Router();

const PROJECT_TYPE_ALIASES = {
	mod: "mod",
	mods: "mod",
	modpack: "modpack",
	modpacks: "modpack",
	world: "world",
	worlds: "world",
	prefab: "prefab",
	prefabs: "prefab",
};

const DISCOVER_CACHE_TTL_SECONDS = 60 * 5;
const NEW_PROJECT_WINDOW_DAYS = 7;

const DISCOVER_CATEGORY_TAGS = {
	mod: ["Decoration", "Adventure", "Game Mechanics", "Minigame"],
	modpack: ["Adventure", "Multiplayer", "Magic", "Optimization"],
	world: ["Adventure", "Survival", "Parkour", "Puzzle"],
	prefab: ["Decoration", "Landscapes", "Buildings", "Dungeons"],
};

const normalizeProjectType = (projectType) => PROJECT_TYPE_ALIASES[String(projectType || "").toLowerCase()] || null;

const getDiscoverTags = (projectType) => DISCOVER_CATEGORY_TAGS[projectType] || [];

const parseTags = (value) => {
	if(typeof value !== "string") {
		return [];
	}

	return value.split(",").map((tag) => tag.trim()).filter(Boolean);
};

const formatProject = (project, weeklyDownloadsBySlug = new Map()) => ({
	id: project.id,
	slug: project.slug,
	title: project.title,
	summary: project.summary || "",
	icon_url: project.icon_url || "https://cdn.modifold.com/static/no-project-icon.svg",
	color: project.color,
	downloads: Number(project.downloads) || 0,
	weekly_downloads: weeklyDownloadsBySlug.get(project.slug) || Number(project.weekly_downloads) || 0,
	followers: Number(project.followers) || 0,
	created_at: project.created_at,
	updated_at: project.updated_at,
	project_type: project.project_type,
	tags: parseTags(project.tags),
	custom_image_url: project.custom_image_url || null,
	gallery: project.cover_url ? [{ url: project.cover_url, featured: Number(project.cover_featured) || 0 }] : [],
	owner: project.organization_slug ? {
		id: project.organization_id,
		username: project.organization_name,
		slug: project.organization_slug,
		avatar: project.organization_icon_url || "https://cdn.modifold.com/static/no-project-icon.svg",
		summary: project.organization_summary || "",
		isVerified: 0,
		type: "organization",
		profile_url: `/organization/${project.organization_slug}`,
	} : {
		id: project.user_id,
		username: project.username,
		slug: project.user_slug,
		avatar: project.user_avatar || "https://cdn.modifold.com/static/no-project-icon.svg",
		isVerified: project.isVerified,
		activeProfileBadge: project.activeProfileBadge,
		type: "user",
		profile_url: `/user/${project.user_slug}`,
	},
});

const getProjectSelect = (extraSelect = "", updatedAtExpression = "p.updated_at") => `
	SELECT
	p.id,
	p.slug,
	p.title,
	p.summary,
	p.icon_url,
	p.color,
	p.downloads,
	p.followers,
	p.created_at,
	${updatedAtExpression} AS updated_at,
	p.project_type,
	p.tags,
	${extraSelect}
	u.id AS user_id,
	u.username,
	u.slug AS user_slug,
	u.avatar AS user_avatar,
	u.isVerified,
	u.active_profile_badge AS activeProfileBadge,
	o.id AS organization_id,
	o.slug AS organization_slug,
	o.name AS organization_name,
	o.icon_url AS organization_icon_url,
	o.summary AS organization_summary,
	(
		SELECT pg.url
		FROM project_gallery pg
		WHERE pg.project_id = p.id AND pg.media_type = 'image'
		ORDER BY pg.ordering ASC, pg.id ASC
		LIMIT 1
	) AS cover_url,
	(
		SELECT pg.featured
		FROM project_gallery pg
		WHERE pg.project_id = p.id AND pg.media_type = 'image'
		ORDER BY pg.ordering ASC, pg.id ASC
		LIMIT 1
	) AS cover_featured
	FROM projects p
	LEFT JOIN users u ON p.user_id = u.id
	LEFT JOIN organization_projects op ON op.project_id COLLATE utf8mb4_unicode_ci = p.id COLLATE utf8mb4_unicode_ci
	LEFT JOIN organizations o ON o.id COLLATE utf8mb4_unicode_ci = op.organization_id COLLATE utf8mb4_unicode_ci
`;

const fetchProjects = async ({ projectType, where = "", params = [], orderBy = "p.downloads DESC, p.updated_at DESC", limit = 10 }) => {
	const [projects] = await db.query(`
		${getProjectSelect()}
		WHERE p.status = 'approved'
		AND p.is_archived = 0
		AND p.visibility = 'public'
		AND p.project_type = ?
		${where}
		ORDER BY ${orderBy}
		LIMIT ?
	`, [projectType, ...params, limit]);

	return projects;
};

const fetchRecommendedProjects = async (projectType) => {
	const [recommendedColumns] = await db.query("SHOW COLUMNS FROM recommended");
	const hasPositionColumn = recommendedColumns.some((column) => column?.Field === "position");
	const hasIdColumn = recommendedColumns.some((column) => column?.Field === "id");
	const hasCustomImageColumn = recommendedColumns.some((column) => column?.Field === "custom_image_url");
	const customImageSelect = hasCustomImageColumn ? "r.custom_image_url AS custom_image_url," : "NULL AS custom_image_url,";
	let orderClause = "r.slug ASC";

	if(hasPositionColumn && hasIdColumn) {
		orderClause = "r.position ASC, r.id ASC";
	} else if(hasPositionColumn) {
		orderClause = "r.position ASC, r.slug ASC";
	} else if(hasIdColumn) {
		orderClause = "r.id ASC";
	}

	const [projects] = await db.query(`
		${getProjectSelect(customImageSelect)}
		INNER JOIN recommended r ON p.slug COLLATE utf8mb4_unicode_ci = r.slug COLLATE utf8mb4_unicode_ci
		WHERE p.status = 'approved'
		AND p.is_archived = 0
		AND p.visibility = 'public'
		AND p.project_type = ?
		ORDER BY ${orderClause}
		LIMIT 8
	`, [projectType]);

	return projects;
};

const fetchRecentlyUpdatedProjects = async (projectType, limit = 10) => {
	const [projects] = await db.query(`
		${getProjectSelect("", "latest_approved_version.updated_at")}
		INNER JOIN (
			SELECT
				project_id,
				MAX(COALESCE(moderated_at, created_at)) AS updated_at
			FROM project_versions
			WHERE moderation_status = 'approved'
			GROUP BY project_id
			HAVING COUNT(*) > 1
		) latest_approved_version ON latest_approved_version.project_id = p.id
		WHERE p.status = 'approved'
		AND p.is_archived = 0
		AND p.visibility = 'public'
		AND p.project_type = ?
		ORDER BY latest_approved_version.updated_at DESC, p.id DESC
		LIMIT ?
	`, [projectType, limit]);

	return projects;
};

const getWeeklyDownloadCounts = async ({ projectType, limit = 40 }) => {
	if(!hasClickHouseConfig || !clickhouse) {
		return [];
	}

	try {
		const resultSet = await clickhouse.query({
			query: `
				SELECT
				project_slug,
				count() AS count
				FROM project_events
				WHERE event_type = 'download'
				AND created_at >= now() - toIntervalDay(7)
				GROUP BY project_slug
				ORDER BY count DESC, project_slug ASC
				LIMIT {limit:UInt32}
			`,
			query_params: {
				limit,
			},
			format: "JSONEachRow",
		});
		const rows = await resultSet.json();
		const downloadRows = rows.map((row) => ({
			slug: String(row.project_slug || "").trim(),
			count: Math.max(0, Number(row.count) || 0),
		})).filter((row) => row.slug);

		if(downloadRows.length === 0) {
			return [];
		}

		const slugs = downloadRows.map((row) => row.slug);
		const [approvedRows] = await db.query(
			"SELECT p.slug FROM projects p WHERE p.status = 'approved' AND p.is_archived = 0 AND p.visibility = 'public' AND p.project_type = ? AND p.slug IN (?)",
			[projectType, slugs]
		);
		const approvedSlugs = new Set(approvedRows.map((row) => row.slug));

		return downloadRows.filter((row) => approvedSlugs.has(row.slug));
	} catch (error) {
		console.warn("Failed to fetch weekly discover downloads:", error.message);
		return [];
	}
};

const fetchProjectsBySlugs = async ({ projectType, rankedDownloads, where = "", params = [], limit = 10 }) => {
	const slugs = rankedDownloads.map((row) => row.slug).filter(Boolean);
	if(slugs.length === 0) {
		return [];
	}

	const [projects] = await db.query(`
		${getProjectSelect()}
		WHERE p.status = 'approved'
		AND p.is_archived = 0
		AND p.visibility = 'public'
		AND p.project_type = ?
		AND p.slug IN (?)
		${where}
	`, [projectType, slugs, ...params]);
	const orderBySlug = new Map(rankedDownloads.map((row, index) => [row.slug, index]));

	return projects.sort((a, b) => (orderBySlug.get(a.slug) ?? 9999) - (orderBySlug.get(b.slug) ?? 9999)).slice(0, limit);
};

const fetchWeeklyPopularProjects = async (projectType, rankedDownloads = null) => {
	rankedDownloads = rankedDownloads || await getWeeklyDownloadCounts({ projectType, limit: 60 });
	const weeklyDownloadsBySlug = new Map(rankedDownloads.map((row) => [row.slug, row.count]));
	const projects = await fetchProjectsBySlugs({ projectType, rankedDownloads, limit: 10 });

	if(projects.length > 0) {
		return {
			projects,
			weeklyDownloadsBySlug,
		};
	}

	return {
		projects: await fetchProjects({ projectType, limit: 10 }),
		weeklyDownloadsBySlug,
	};
};

const fetchWeeklyNewPopularProjects = async (projectType, rankedDownloads = null) => {
	rankedDownloads = rankedDownloads || await getWeeklyDownloadCounts({ projectType, limit: 120 });
	const weeklyDownloadsBySlug = new Map(rankedDownloads.map((row) => [row.slug, row.count]));
	let projects = await fetchProjectsBySlugs({
		projectType,
		rankedDownloads,
		where: `AND p.created_at >= DATE_SUB(NOW(), INTERVAL ${NEW_PROJECT_WINDOW_DAYS} DAY)`,
		limit: 10,
	});

	if(projects.length < 10) {
		const existingSlugs = projects.map((project) => project.slug).filter(Boolean);
		const fallbackWhere = [
			`AND p.created_at >= DATE_SUB(NOW(), INTERVAL ${NEW_PROJECT_WINDOW_DAYS} DAY)`,
			existingSlugs.length > 0 ? "AND p.slug NOT IN (?)" : "",
		].filter(Boolean).join(" ");
		const fallbackProjects = await fetchProjects({
			projectType,
			where: fallbackWhere,
			params: existingSlugs.length > 0 ? [existingSlugs] : [],
			orderBy: "p.downloads DESC, p.created_at DESC, p.id DESC",
			limit: 10 - projects.length,
		});

		projects = projects.concat(fallbackProjects);
	}

	return {
		projects,
		weeklyDownloadsBySlug,
	};
};

const fetchDiscoverTags = async (projectType) => {
	const discoverTags = getDiscoverTags(projectType);

	if(discoverTags.length === 0) {
		return [];
	}

	const [rows] = await db.query(
		"SELECT p.tags FROM projects p WHERE p.status = 'approved' AND p.is_archived = 0 AND p.visibility = 'public' AND p.project_type = ? AND p.tags IS NOT NULL AND p.tags != ''",
		[projectType]
	);
	const countsByTag = new Map(discoverTags.map((tag) => [tag, 0]));

	for(const row of rows) {
		for(const tag of parseTags(row.tags)) {
			if(countsByTag.has(tag)) {
				countsByTag.set(tag, countsByTag.get(tag) + 1);
			}
		}
	}

	return discoverTags.map((name) => ({ name, count: countsByTag.get(name) || 0 }));
};

const fetchPopularTags = async (projectType, limit = 6) => {
	const [rows] = await db.query(
		"SELECT p.tags FROM projects p WHERE p.status = 'approved' AND p.is_archived = 0 AND p.visibility = 'public' AND p.project_type = ? AND p.tags IS NOT NULL AND p.tags != ''",
		[projectType]
	);
	const countsByTag = new Map();

	for(const row of rows) {
		for(const tag of parseTags(row.tags)) {
			countsByTag.set(tag, (countsByTag.get(tag) || 0) + 1);
		}
	}

	return [...countsByTag.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, limit).map(([name, count]) => ({ name, count }));
};

const getDiscoverCacheKey = (scope) => {
	const cacheHash = crypto.createHash("sha1").update(JSON.stringify(scope)).digest("hex");
	return `modifold_discover_v2_${cacheHash}`;
};

const setDiscoverCacheHeaders = (res) => {
	res.set("Cache-Control", "public, max-age=300, s-maxage=300, stale-while-revalidate=120");
};

const buildDiscoverData = async (projectType, { includeCategorySections = true } = {}) => {
	const weeklyDownloadsPromise = getWeeklyDownloadCounts({ projectType, limit: 120 });
	const discoverTagsPromise = includeCategorySections ? fetchDiscoverTags(projectType) : Promise.resolve([]);
	const [featuredProjects, rankedDownloads, latestProjects, recentlyUpdatedProjects, discoverTags, popularTags] = await Promise.all([
		fetchRecommendedProjects(projectType),
		weeklyDownloadsPromise,
		fetchProjects({ projectType, orderBy: "p.created_at DESC, p.id DESC", limit: 12 }),
		fetchRecentlyUpdatedProjects(projectType),
		discoverTagsPromise,
		fetchPopularTags(projectType, 6),
	]);
	const [weeklyPopularResult, weeklyNewPopularResult] = await Promise.all([
		fetchWeeklyPopularProjects(projectType, rankedDownloads.slice(0, 60)),
		fetchWeeklyNewPopularProjects(projectType, rankedDownloads),
	]);
	const categorySections = includeCategorySections ? await Promise.all(discoverTags.map(async (tag) => ({
		tag: tag.name,
		count: tag.count,
		projects: (await fetchProjects({
			projectType,
			where: "AND FIND_IN_SET(?, p.tags)",
			params: [tag.name],
			orderBy: "p.downloads DESC, p.updated_at DESC",
			limit: 10,
		})).map((project) => formatProject(project)),
	}))) : [];

	return {
		type: projectType,
		featured: featuredProjects.map((project) => formatProject(project)),
		weeklyPopular: weeklyPopularResult.projects.map((project) => formatProject(project, weeklyPopularResult.weeklyDownloadsBySlug)),
		weeklyNewPopular: weeklyNewPopularResult.projects.map((project) => formatProject(project, weeklyNewPopularResult.weeklyDownloadsBySlug)),
		recentlyUpdated: recentlyUpdatedProjects.map((project) => formatProject(project)),
		categorySections,
		popularCategories: popularTags,
		latest: latestProjects.map((project) => formatProject(project)),
		generatedAt: new Date().toISOString(),
	};
};

const combineProjects = (projectGroups = [], limit = 10) => {
	const projects = [];
	const seenProjects = new Set();
	const maxLength = Math.max(0, ...projectGroups.map((projectGroup) => projectGroup.length));

	for(let index = 0; index < maxLength && projects.length < limit; index += 1) {
		for(const projectGroup of projectGroups) {
			const project = projectGroup[index];
			if(!project) {
				continue;
			}

			const projectKey = project.id || `${project.project_type || "project"}:${project.slug}`;
			if(seenProjects.has(projectKey)) {
				continue;
			}

			seenProjects.add(projectKey);
			projects.push(project);
			if(projects.length === limit) {
				break;
			}
		}
	}

	return projects;
};

const combinePopularCategories = (categoryGroups = [], limit = 6) => {
	const categoriesByName = new Map();

	for(const [categories, projectType] of categoryGroups) {
		for(const category of categories) {
			const currentCategory = categoriesByName.get(category.name);
			if(currentCategory && Number(currentCategory.count || 0) >= Number(category.count || 0)) {
				continue;
			}

			categoriesByName.set(category.name, {
				...category,
				project_type: projectType,
			});
		}
	}

	return [...categoriesByName.values()]
		.sort((firstCategory, secondCategory) => Number(secondCategory.count || 0) - Number(firstCategory.count || 0))
		.slice(0, limit);
};

router.get("/", async (req, res) => {
	try {
		const cacheKey = getDiscoverCacheKey({ types: ["mod", "world", "prefab"], version: 4 });
		const cachedResponse = await getCacheJson(cacheKey);

		if(cachedResponse) {
			setDiscoverCacheHeaders(res);
			return res.json(cachedResponse);
		}

		const [mods, worlds, prefabs] = await Promise.all([
			buildDiscoverData("mod", { includeCategorySections: false }),
			buildDiscoverData("world", { includeCategorySections: false }),
			buildDiscoverData("prefab", { includeCategorySections: false }),
		]);
		const responseData = {
			types: ["mod", "world", "prefab"],
			featured: combineProjects([mods.featured, worlds.featured, prefabs.featured], 5),
			weeklyPopular: combineProjects([mods.weeklyPopular, worlds.weeklyPopular, prefabs.weeklyPopular]),
			weeklyNewPopular: combineProjects([mods.weeklyNewPopular, worlds.weeklyNewPopular, prefabs.weeklyNewPopular]),
			recentlyUpdated: combineProjects([mods.recentlyUpdated, worlds.recentlyUpdated, prefabs.recentlyUpdated]),
			popularCategories: combinePopularCategories([
				[mods.popularCategories, "mod"],
				[worlds.popularCategories, "world"],
				[prefabs.popularCategories, "prefab"],
			]),
			latest: combineProjects([mods.latest, worlds.latest, prefabs.latest], 6),
			generatedAt: new Date().toISOString(),
		};

		await setCacheJson(cacheKey, responseData, DISCOVER_CACHE_TTL_SECONDS);
		setDiscoverCacheHeaders(res);
		return res.json(responseData);
	} catch (error) {
		console.error("Error fetching unified discover page:", error);
		return res.status(500).json({ message: "Error fetching discover page", error: error.message });
	}
});

router.get("/:type", async (req, res) => {
	try {
		const projectType = normalizeProjectType(req.params.type);

		if(!projectType) {
			return res.status(400).json({ message: "Invalid project type" });
		}

		const cacheKey = getDiscoverCacheKey({ type: projectType, version: 6 });
		const cachedResponse = await getCacheJson(cacheKey);

		if(cachedResponse) {
			setDiscoverCacheHeaders(res);
			return res.json(cachedResponse);
		}

		const responseData = await buildDiscoverData(projectType);
		await setCacheJson(cacheKey, responseData, DISCOVER_CACHE_TTL_SECONDS);
		setDiscoverCacheHeaders(res);
		return res.json(responseData);
	} catch (error) {
		console.error("Error fetching discover page:", error);
		return res.status(500).json({ message: "Error fetching discover page", error: error.message });
	}
});

module.exports = router;