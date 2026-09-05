const express = require("express");
const crypto = require("crypto");
const { db } = require("../../config/db");
const { clickhouse, hasClickHouseConfig } = require("../../config/clickhouse");
const { cacheClient } = require("../../config/cache");
const { createSingleFlightCache } = require("../../utils/singleFlightCache");

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

// discover page configuration
const DISCOVER_CACHE_TTL_SECONDS = 60 * 5;
const DISCOVER_CACHE_STALE_TTL_SECONDS = 60 * 30;
const DISCOVER_CACHE_JITTER_RATIO = 0.15;
const DISCOVER_CACHE_LOCK_TTL_MS = 60 * 1000;
const DISCOVER_CACHE_COLD_WAIT_MS = 60 * 1000;
const NEW_PROJECT_WINDOW_DAYS = 7;
const discoverCache = createSingleFlightCache({ cacheClient });

let recommendedCapabilities = {
	hasPositionColumn: false,
	hasIdColumn: false,
	hasCustomImageColumn: false,
};

const initializeDiscover = async () => {
	try {
		const [recommendedColumns] = await db.query("SHOW COLUMNS FROM recommended");
		recommendedCapabilities = {
			hasPositionColumn: recommendedColumns.some((column) => column?.Field === "position"),
			hasIdColumn: recommendedColumns.some((column) => column?.Field === "id"),
			hasCustomImageColumn: recommendedColumns.some((column) => column?.Field === "custom_image_url"),
		};
	} catch(error) {
		console.warn("[discover] failed to inspect recommended schema at startup; using legacy-compatible columns:", error.message);
	}
};

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
	cover.url AS cover_url,
	cover.featured AS cover_featured
	FROM projects p
	LEFT JOIN users u ON p.user_id = u.id
	LEFT JOIN organization_projects op ON op.project_id COLLATE utf8mb4_unicode_ci = p.id COLLATE utf8mb4_unicode_ci
	LEFT JOIN organizations o ON o.id COLLATE utf8mb4_unicode_ci = op.organization_id COLLATE utf8mb4_unicode_ci
	LEFT JOIN LATERAL (
		SELECT pg.url, pg.featured
		FROM project_gallery pg
		WHERE pg.project_id = p.id AND pg.media_type = 'image'
		ORDER BY pg.ordering ASC, pg.id ASC
		LIMIT 1
	) cover ON TRUE
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
	const { hasPositionColumn, hasIdColumn, hasCustomImageColumn } = recommendedCapabilities;
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

const getWeeklyDownloadCounts = async ({ limit = 120 } = {}) => {
	if(!hasClickHouseConfig || !clickhouse) {
		return [];
	}

	try {
		const resultSet = await clickhouse.query({
			query: `
				SELECT
				project_slug,
				countIf(event_id IS NULL) + uniqExactIf(event_id, event_id IS NOT NULL) AS count
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

		return downloadRows;
	} catch (error) {
		console.warn("Failed to fetch weekly discover downloads:", error.message);
		return [];
	}
};

const fetchProjectsBySlugs = async ({ projectType, rankedDownloads, where = "", params = [], extraSelect = "", limit = 10 }) => {
	const slugs = rankedDownloads.map((row) => row.slug).filter(Boolean);
	if(slugs.length === 0) {
		return [];
	}

	const [projects] = await db.query(`
		${getProjectSelect(extraSelect)}
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

const fetchWeeklySections = async (projectType, rankedDownloads = []) => {
	const weeklyDownloadsBySlug = new Map(rankedDownloads.map((row) => [row.slug, row.count]));
	const rankedProjects = await fetchProjectsBySlugs({
		projectType,
		rankedDownloads,
		extraSelect: `p.created_at >= DATE_SUB(NOW(), INTERVAL ${NEW_PROJECT_WINDOW_DAYS} DAY) AS is_new_project,`,
		limit: rankedDownloads.length,
	});
	let weeklyPopularProjects = rankedProjects.slice(0, 10);
	let weeklyNewProjects = rankedProjects.filter((project) => Number(project.is_new_project) === 1).slice(0, 10);
	const fallbackPromises = [];

	if(weeklyPopularProjects.length === 0) {
		fallbackPromises.push(fetchProjects({ projectType, limit: 10 }).then((projects) => {
			weeklyPopularProjects = projects;
		}));
	}

	if(weeklyNewProjects.length < 10) {
		const existingSlugs = weeklyNewProjects.map((project) => project.slug).filter(Boolean);
		const fallbackWhere = [
			`AND p.created_at >= DATE_SUB(NOW(), INTERVAL ${NEW_PROJECT_WINDOW_DAYS} DAY)`,
			existingSlugs.length > 0 ? "AND p.slug NOT IN (?)" : "",
		].filter(Boolean).join(" ");
		fallbackPromises.push(fetchProjects({
			projectType,
			where: fallbackWhere,
			params: existingSlugs.length > 0 ? [existingSlugs] : [],
			orderBy: "p.downloads DESC, p.created_at DESC, p.id DESC",
			limit: 10 - weeklyNewProjects.length,
		}).then((projects) => {
			weeklyNewProjects = weeklyNewProjects.concat(projects);
		}));
	}
	await Promise.all(fallbackPromises);

	return {
		weeklyPopularProjects,
		weeklyNewProjects,
		weeklyDownloadsBySlug,
	};
};

const fetchTagCounts = async (projectType) => {
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

	return countsByTag;
};

const getPopularTags = (countsByTag, limit = 6) => {
	return [...countsByTag.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, limit).map(([name, count]) => ({ name, count }));
};

const fetchCategorySectionProjects = async (projectType, tags) => {
	if(tags.length === 0) {
		return new Map();
	}

	const categoryTable = tags.map((tag, index) => index === 0 ? "SELECT ? AS tag" : "SELECT ?").join(" UNION ALL ");
	const [rows] = await db.query(`
		SELECT ranked.*
		FROM (
			${getProjectSelect(`
				category_tags.tag AS category_tag,
				ROW_NUMBER() OVER (PARTITION BY category_tags.tag ORDER BY p.downloads DESC, p.updated_at DESC, p.id DESC) AS category_rank,
			`)}
			INNER JOIN (${categoryTable}) category_tags ON FIND_IN_SET(category_tags.tag, p.tags)
			WHERE p.status = 'approved'
			AND p.is_archived = 0
			AND p.visibility = 'public'
			AND p.project_type = ?
		) ranked
		WHERE ranked.category_rank <= 10
		ORDER BY ranked.category_tag ASC, ranked.category_rank ASC
	`, [...tags, projectType]);
	const projectsByTag = new Map(tags.map((tag) => [tag, []]));
	for(const row of rows) {
		projectsByTag.get(row.category_tag)?.push(formatProject(row));
	}

	return projectsByTag;
};

const getDiscoverCacheKey = (scope) => {
	const cacheHash = crypto.createHash("sha1").update(JSON.stringify(scope)).digest("hex");
	return `modifold_discover_v2_${cacheHash}`;
};

const setDiscoverCacheHeaders = (res) => {
	res.set("Cache-Control", `public, max-age=${DISCOVER_CACHE_TTL_SECONDS}, s-maxage=${DISCOVER_CACHE_TTL_SECONDS}, stale-while-revalidate=${DISCOVER_CACHE_STALE_TTL_SECONDS}, stale-if-error=${DISCOVER_CACHE_STALE_TTL_SECONDS}`);
};

const buildDiscoverData = async (projectType, { includeCategorySections = true, rankedDownloadsPromise = null } = {}) => {
	const discoverTags = getDiscoverTags(projectType);
	const [featuredProjects, rankedDownloads, latestProjects, recentlyUpdatedProjects, tagCounts] = await Promise.all([
		fetchRecommendedProjects(projectType),
		rankedDownloadsPromise || getWeeklyDownloadCounts(),
		fetchProjects({ projectType, orderBy: "p.created_at DESC, p.id DESC", limit: 12 }),
		fetchRecentlyUpdatedProjects(projectType),
		fetchTagCounts(projectType),
	]);
	const [weeklySections, categoryProjects] = await Promise.all([
		fetchWeeklySections(projectType, rankedDownloads),
		includeCategorySections ? fetchCategorySectionProjects(projectType, discoverTags) : Promise.resolve(new Map()),
	]);
	const categorySections = includeCategorySections ? discoverTags.map((tag) => ({
		tag,
		count: tagCounts.get(tag) || 0,
		projects: categoryProjects.get(tag) || [],
	})) : [];

	return {
		type: projectType,
		featured: featuredProjects.map((project) => formatProject(project)),
		weeklyPopular: weeklySections.weeklyPopularProjects.map((project) => formatProject(project, weeklySections.weeklyDownloadsBySlug)),
		weeklyNewPopular: weeklySections.weeklyNewProjects.map((project) => formatProject(project, weeklySections.weeklyDownloadsBySlug)),
		recentlyUpdated: recentlyUpdatedProjects.map((project) => formatProject(project)),
		categorySections,
		popularCategories: getPopularTags(tagCounts, 6),
		latest: latestProjects.map((project) => formatProject(project)),
		generatedAt: new Date().toISOString(),
	};
};

const getCachedDiscoverResponse = async (cacheKey, build) => discoverCache.getOrRefresh({
	key: cacheKey,
	build,
	freshTtlSeconds: DISCOVER_CACHE_TTL_SECONDS,
	staleTtlSeconds: DISCOVER_CACHE_STALE_TTL_SECONDS,
	jitterRatio: DISCOVER_CACHE_JITTER_RATIO,
	lockTtlMs: DISCOVER_CACHE_LOCK_TTL_MS,
	coldWaitMs: DISCOVER_CACHE_COLD_WAIT_MS,
});

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
		const cacheKey = getDiscoverCacheKey({ types: ["mod", "world", "prefab"], version: 5 });
		const { value: responseData, cacheStatus } = await getCachedDiscoverResponse(cacheKey, async () => {
			const rankedDownloadsPromise = getWeeklyDownloadCounts();
			const [mods, worlds, prefabs] = await Promise.all([
				buildDiscoverData("mod", { includeCategorySections: false, rankedDownloadsPromise }),
				buildDiscoverData("world", { includeCategorySections: false, rankedDownloadsPromise }),
				buildDiscoverData("prefab", { includeCategorySections: false, rankedDownloadsPromise }),
			]);
			return {
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
		});

		setDiscoverCacheHeaders(res);
		res.set("X-Discover-Cache", cacheStatus);
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

		const cacheKey = getDiscoverCacheKey({ type: projectType, version: 7 });
		const { value: responseData, cacheStatus } = await getCachedDiscoverResponse(cacheKey, () => buildDiscoverData(projectType));
		setDiscoverCacheHeaders(res);
		res.set("X-Discover-Cache", cacheStatus);
		return res.json(responseData);
	} catch (error) {
		console.error("Error fetching discover page:", error);
		return res.status(500).json({ message: "Error fetching discover page", error: error.message });
	}
});

module.exports = router;
module.exports.initializeDiscover = initializeDiscover;