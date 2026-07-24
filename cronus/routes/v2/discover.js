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
};

const DISCOVER_CACHE_TTL_SECONDS = 60 * 5;

const DISCOVER_CATEGORY_TAGS = {
	mod: ["Decoration", "Adventure", "Game Mechanics", "Minigame"],
	modpack: ["Adventure", "Multiplayer", "Magic", "Optimization"],
	world: ["Adventure", "Survival", "Parkour", "Puzzle"],
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
	icon_url: project.icon_url || "https://media.modifold.com/static/no-project-icon.svg",
	color: project.color,
	downloads: Number(project.downloads) || 0,
	weekly_downloads: weeklyDownloadsBySlug.get(project.slug) || Number(project.weekly_downloads) || 0,
	followers: Number(project.followers) || 0,
	created_at: project.created_at,
	updated_at: project.updated_at,
	project_type: project.project_type,
	tags: parseTags(project.tags),
	gallery: project.cover_url ? [{ url: project.cover_url, featured: Number(project.cover_featured) || 0 }] : [],
	owner: project.organization_slug ? {
		id: project.organization_id,
		username: project.organization_name,
		slug: project.organization_slug,
		avatar: project.organization_icon_url || "https://media.modifold.com/static/no-project-icon.svg",
		summary: project.organization_summary || "",
		isVerified: 0,
		type: "organization",
		profile_url: `/organization/${project.organization_slug}`,
	} : {
		id: project.user_id,
		username: project.username,
		slug: project.user_slug,
		avatar: project.user_avatar || "https://media.modifold.com/static/no-project-icon.svg",
		isVerified: project.isVerified,
		activeProfileBadge: project.activeProfileBadge,
		type: "user",
		profile_url: `/user/${project.user_slug}`,
	},
});

const getProjectSelect = () => `
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
	p.updated_at,
	p.project_type,
	p.tags,
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
		WHERE pg.project_id = p.id
		ORDER BY pg.ordering ASC, pg.id ASC
		LIMIT 1
	) AS cover_url,
	(
		SELECT pg.featured
		FROM project_gallery pg
		WHERE pg.project_id = p.id
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
	let orderClause = "r.slug ASC";

	if(hasPositionColumn && hasIdColumn) {
		orderClause = "r.position ASC, r.id ASC";
	} else if(hasPositionColumn) {
		orderClause = "r.position ASC, r.slug ASC";
	} else if(hasIdColumn) {
		orderClause = "r.id ASC";
	}

	const [projects] = await db.query(`
		${getProjectSelect()}
		INNER JOIN recommended r ON p.slug COLLATE utf8mb4_unicode_ci = r.slug COLLATE utf8mb4_unicode_ci
		WHERE p.status = 'approved'
		AND p.project_type = ?
		ORDER BY ${orderClause}
		LIMIT 8
	`, [projectType]);

	if(projects.length > 0) {
		return projects;
	}

	return fetchProjects({ projectType, limit: 8 });
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
			"SELECT slug FROM projects WHERE status = 'approved' AND project_type = ? AND slug IN (?)",
			[projectType, slugs]
		);
		const approvedSlugs = new Set(approvedRows.map((row) => row.slug));

		return downloadRows.filter((row) => approvedSlugs.has(row.slug));
	} catch (error) {
		console.warn("Failed to fetch weekly discover downloads:", error.message);
		return [];
	}
};

const fetchProjectsBySlugs = async ({ projectType, rankedDownloads, limit = 10 }) => {
	const slugs = rankedDownloads.map((row) => row.slug).filter(Boolean);
	if(slugs.length === 0) {
		return [];
	}

	const [projects] = await db.query(`
		${getProjectSelect()}
		WHERE p.status = 'approved'
		AND p.project_type = ?
		AND p.slug IN (?)
	`, [projectType, slugs]);
	const orderBySlug = new Map(rankedDownloads.map((row, index) => [row.slug, index]));

	return projects.sort((a, b) => (orderBySlug.get(a.slug) ?? 9999) - (orderBySlug.get(b.slug) ?? 9999)).slice(0, limit);
};

const fetchWeeklyPopularProjects = async (projectType) => {
	const rankedDownloads = await getWeeklyDownloadCounts({ projectType, limit: 60 });
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

const fetchDiscoverTags = async (projectType) => {
	const discoverTags = getDiscoverTags(projectType);

	if(discoverTags.length === 0) {
		return [];
	}

	const [rows] = await db.query(
		"SELECT tags FROM projects WHERE status = 'approved' AND project_type = ? AND tags IS NOT NULL AND tags != ''",
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

router.get("/:type", async (req, res) => {
	try {
		const projectType = normalizeProjectType(req.params.type);

		if(!projectType) {
			return res.status(400).json({ message: "Invalid project type" });
		}

		const cacheSeed = JSON.stringify({ type: projectType, version: 2 });
		const cacheHash = crypto.createHash("sha1").update(cacheSeed).digest("hex");
		const cacheKey = `modifold_discover_v2_${cacheHash}`;
		const cachedResponse = await getCacheJson(cacheKey);

		if(cachedResponse) {
			res.set("Cache-Control", "public, max-age=300, s-maxage=300, stale-while-revalidate=120");
			return res.json(cachedResponse);
		}

		const [featuredProjects, weeklyPopularResult, latestProjects, discoverTags] = await Promise.all([
			fetchRecommendedProjects(projectType),
			fetchWeeklyPopularProjects(projectType),
			fetchProjects({ projectType, orderBy: "p.created_at DESC, p.id DESC", limit: 12 }),
			fetchDiscoverTags(projectType),
		]);

		const categorySections = await Promise.all(discoverTags.map(async (tag) => ({
			tag: tag.name,
			count: tag.count,
			projects: (await fetchProjects({
				projectType,
				where: "AND FIND_IN_SET(?, p.tags)",
				params: [tag.name],
				orderBy: "p.downloads DESC, p.updated_at DESC",
				limit: 10,
			})).map((project) => formatProject(project)),
		})));

		const responseData = {
			type: projectType,
			featured: featuredProjects.map((project) => formatProject(project)),
			weeklyPopular: weeklyPopularResult.projects.map((project) => formatProject(project, weeklyPopularResult.weeklyDownloadsBySlug)),
			categorySections,
			popularCategories: discoverTags,
			latest: latestProjects.map((project) => formatProject(project)),
			generatedAt: new Date().toISOString(),
		};

		await setCacheJson(cacheKey, responseData, DISCOVER_CACHE_TTL_SECONDS);

		res.set("Cache-Control", "public, max-age=300, s-maxage=300, stale-while-revalidate=120");
		return res.json(responseData);
	} catch (error) {
		console.error("Error fetching discover page:", error);
		return res.status(500).json({ message: "Error fetching discover page", error: error.message });
	}
});

module.exports = router;