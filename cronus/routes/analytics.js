require("dotenv").config();

const express = require("express");
const { db } = require("../config/db");
const { clickhouse, hasClickHouseConfig } = require("../config/clickhouse");
const auth = require("../middleware/auth");
const { normalizeEmbedTheme, renderProjectAnalyticsEmbedSvg } = require("../utils/analyticsEmbedImage");

const router = express.Router();

const normalizeProjectSlug = (value) => typeof value === "string" ? value.trim() : "";
const toSafeNumber = (value) => {
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeDaysParam = (value) => {
	const parsed = Number.parseInt(String(value || 7), 10);

	if(!Number.isFinite(parsed) || parsed < 1) {
		return 7;
	}

	return Math.min(90, parsed);
};

const formatUtcDate = (date) => {
	const year = date.getUTCFullYear();
	const month = `${date.getUTCMonth() + 1}`.padStart(2, "0");
	const day = `${date.getUTCDate()}`.padStart(2, "0");
	return `${year}-${month}-${day}`;
};

const isValidAnalyticsDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));

const normalizeAnalyticsDateBounds = ({ from, to }) => {
	const endDate = isValidAnalyticsDate(to) ? new Date(`${to}T00:00:00Z`) : new Date();
	endDate.setUTCHours(0, 0, 0, 0);

	const startDate = isValidAnalyticsDate(from) ? new Date(`${from}T00:00:00Z`) : new Date(endDate);
	if(!isValidAnalyticsDate(from)) {
		startDate.setUTCDate(endDate.getUTCDate() - 29);
	}
	startDate.setUTCHours(0, 0, 0, 0);

	if(startDate > endDate) {
		return normalizeAnalyticsDateBounds({ from: formatUtcDate(endDate), to: formatUtcDate(startDate) });
	}

	const maxRangeDate = new Date(startDate);
	maxRangeDate.setUTCDate(startDate.getUTCDate() + 365);

	const boundedEndDate = endDate > maxRangeDate ? maxRangeDate : endDate;

	return {
		from: formatUtcDate(startDate),
		to: formatUtcDate(boundedEndDate),
	};
};

const buildDailySeriesBetween = (from, to) => {
	const startDate = new Date(`${from}T00:00:00Z`);
	const endDate = new Date(`${to}T00:00:00Z`);
	const points = [];

	for(const pointDate = new Date(startDate); pointDate <= endDate; pointDate.setUTCDate(pointDate.getUTCDate() + 1)) {
		points.push({
			date: formatUtcDate(pointDate),
			count: 0,
		});
	}

	return points;
};

const normalizeAnalyticsProjectIds = (value) => {
	if(Array.isArray(value)) {
		return value.flatMap((item) => normalizeAnalyticsProjectIds(item));
	}

	return String(value || "").split(",").map((item) => item.trim()).filter(Boolean);
};

const escapeClickHouseString = (value) => String(value).replace(/\\/g, "\\\\").replace(/'/g, "\\'");

const getProjectEventSeriesForSlugs = async ({ projectSlugs, eventType, from, to, splitByProject = false }) => {
	const normalizedSlugs = Array.isArray(projectSlugs) ? [...new Set(projectSlugs.map((slug) => String(slug || "").trim()).filter(Boolean))] : [];
	if(!normalizedSlugs.length) {
		return splitByProject ? {} : buildDailySeriesBetween(from, to);
	}

	const escapedSlugs = normalizedSlugs.map((slug) => `'${escapeClickHouseString(slug)}'`).join(", ");
	const rowsByDate = new Map();
	const rowsByProject = Object.fromEntries(normalizedSlugs.map((slug) => [slug, new Map()]));

	const resultSet = await clickhouse.query({
		query: `
			SELECT
			${splitByProject ? "project_slug," : ""}
			toDate(created_at) AS date,
			count() AS count
			FROM project_events
			WHERE project_slug IN (${escapedSlugs})
			AND event_type = {event_type:String}
			AND toDate(created_at) >= toDate({from:String})
			AND toDate(created_at) <= toDate({to:String})
			GROUP BY ${splitByProject ? "project_slug," : ""} date
			ORDER BY ${splitByProject ? "project_slug ASC," : ""} date ASC
		`,
		query_params: {
			event_type: eventType,
			from,
			to,
		},
		format: "JSONEachRow",
	});

	const rows = await resultSet.json();
	rows.forEach((row) => {
		const date = String(row.date);
		const count = Number(row.count) || 0;

		if(splitByProject) {
			const slug = String(row.project_slug || "");
			if(rowsByProject[slug]) {
				rowsByProject[slug].set(date, count);
			}
			return;
		}

		rowsByDate.set(date, count);
	});

	const emptySeries = buildDailySeriesBetween(from, to);
	if(!splitByProject) {
		return emptySeries.map((point) => ({
			...point,
			count: rowsByDate.get(point.date) || 0,
		}));
	}

	return Object.fromEntries(normalizedSlugs.map((slug) => [
		slug,
		emptySeries.map((point) => ({
			...point,
			count: rowsByProject[slug]?.get(point.date) || 0,
		})),
	]));
};

const getProjectDownloadCountriesForSlugs = async ({ projectSlugs, from, to }) => {
	const normalizedSlugs = Array.isArray(projectSlugs) ? [...new Set(projectSlugs.map((slug) => String(slug || "").trim()).filter(Boolean))] : [];
	if(!normalizedSlugs.length) {
		return [];
	}

	const escapedSlugs = normalizedSlugs.map((slug) => `'${escapeClickHouseString(slug)}'`).join(", ");

	const resultSet = await clickhouse.query({
		query: `
			SELECT
			lower(country_code) AS country_code,
			count() AS count
			FROM project_events
			WHERE project_slug IN (${escapedSlugs})
			AND event_type = 'download'
			AND toDate(created_at) >= toDate({from:String})
			AND toDate(created_at) <= toDate({to:String})
			AND country_code IS NOT NULL
			AND country_code != ''
			GROUP BY country_code
			ORDER BY count DESC, country_code ASC
			LIMIT 50
		`,
		query_params: {
			from,
			to,
		},
		format: "JSONEachRow",
	});

	const rows = await resultSet.json();

	return rows.map((row) => ({
		country_code: String(row.country_code || "").toLowerCase(),
		count: Number(row.count) || 0,
	})).filter((row) => /^[a-z]{2}$/.test(row.country_code));
};

const getOnlineNowForProjectSlugs = async (projectSlugs) => {
	const normalizedSlugs = Array.isArray(projectSlugs) ? [...new Set(projectSlugs.map((slug) => String(slug || "").trim()).filter(Boolean))] : [];
	if(!normalizedSlugs.length) {
		return { playersOnlineNow: 0, activeServersNow: 0 };
	}

	const escapedSlugs = normalizedSlugs.map((slug) => `'${escapeClickHouseString(slug)}'`).join(", ");
	const resultSet = await clickhouse.query({
		query: `
			SELECT
			COALESCE(SUM(latest_players), 0) AS playersOnlineNow,
			COUNT() AS activeServersNow
			FROM (
				SELECT
				server_uuid,
				argMax(players_online, event_at) AS latest_players
				FROM mod_server_updates
				WHERE project_slug IN (${escapedSlugs})
				AND event_at >= toUInt32(toUnixTimestamp(now()) - {window_seconds:UInt32})
				AND event_at <= now()
				GROUP BY server_uuid
			)
		`,
		query_params: {
			window_seconds: 90,
		},
		format: "JSONEachRow",
	});

	const rows = await resultSet.json();
	const row = rows?.[0] || {};

	return {
		playersOnlineNow: Math.max(0, toSafeNumber(row.playersOnlineNow)),
		activeServersNow: Math.max(0, toSafeNumber(row.activeServersNow)),
	};
};

const getOnlineSeriesForProjectSlugs = async ({ projectSlugs, from, to }) => {
	const normalizedSlugs = Array.isArray(projectSlugs) ? [...new Set(projectSlugs.map((slug) => String(slug || "").trim()).filter(Boolean))] : [];
	if(!normalizedSlugs.length) {
		return [];
	}

	const escapedSlugs = normalizedSlugs.map((slug) => `'${escapeClickHouseString(slug)}'`).join(", ");
	const resultSet = await clickhouse.query({
		query: `
			WITH per_hour_server AS (
				SELECT
				toStartOfHour(toDateTime(event_at)) AS hour_at,
				server_uuid,
				argMax(players_online, event_at) AS players_online
				FROM mod_server_updates
				WHERE project_slug IN (${escapedSlugs})
				AND toDate(toDateTime(event_at)) >= toDate({from:String})
				AND toDate(toDateTime(event_at)) <= toDate({to:String})
				AND event_at <= now()
				GROUP BY hour_at, server_uuid
			)
			SELECT
			hour_at AS day,
			SUM(players_online) AS players,
			COUNT() AS servers
			FROM per_hour_server
			GROUP BY day
			ORDER BY day ASC
		`,
		query_params: {
			from,
			to,
		},
		format: "JSONEachRow",
	});

	const rows = await resultSet.json();

	return rows.map((row) => ({
		date: String(row.day || "").replace(" ", "T").slice(0, 19),
		players: Math.max(0, toSafeNumber(row.players)),
		servers: Math.max(0, toSafeNumber(row.servers)),
	})).filter((row) => Boolean(row.date));
};

const toIsoDateTimeOrNull = (value) => {
	if(!value) {
		return null;
	}

	if(typeof value === "number") {
		return Number.isFinite(value) ? new Date(value * 1000).toISOString() : null;
	}

	const normalized = String(value).includes("T") ? String(value) : `${String(value).replace(" ", "T")}Z`;
	const parsed = new Date(normalized);

	if(Number.isNaN(parsed.getTime())) {
		return null;
	}

	return parsed.toISOString();
};

const getProjectEmbedMeta = async (projectSlug) => {
	const [rows] = await db.query(
		"SELECT title FROM projects WHERE slug = ? LIMIT 1",
		[projectSlug]
	);

	return rows?.[0] || null;
};

const getProjectOnlineNow = async (projectSlug) => {
	const onlineNowResultSet = await clickhouse.query({
		query: `
			SELECT
				COALESCE(SUM(latest_players), 0) AS playersOnlineNow,
				COUNT() AS activeServersNow
			FROM (
				SELECT
					server_uuid,
					argMax(players_online, event_at) AS latest_players
				FROM mod_server_updates
				WHERE project_slug = {project_slug:String}
				AND event_at >= toUInt32(toUnixTimestamp(now()) - {window_seconds:UInt32})
				AND event_at <= now()
				GROUP BY server_uuid
			)
		`,
		query_params: {
			project_slug: projectSlug,
			window_seconds: 90,
		},
		format: "JSONEachRow",
	});

	const onlineNowRows = await onlineNowResultSet.json();
	const onlineNowRow = onlineNowRows?.[0] || {};

	return {
		playersOnlineNow: Math.max(0, toSafeNumber(onlineNowRow.playersOnlineNow)),
		activeServersNow: Math.max(0, toSafeNumber(onlineNowRow.activeServersNow)),
	};
};

const getProjectOnlineSeries = async (projectSlug, days) => {
	const resultSet = await clickhouse.query({
		query: `
			WITH per_hour_server AS (
				SELECT
					toStartOfHour(toDateTime(event_at)) AS hour_at,
					server_uuid,
					argMax(players_online, event_at) AS players_online
				FROM mod_server_updates
				WHERE project_slug = {project_slug:String}
				AND event_at >= toUInt32(toUnixTimestamp(now()) - ({days:UInt32} * 86400))
				AND event_at <= now()
				GROUP BY hour_at, server_uuid
			)
			SELECT
				hour_at AS day,
				SUM(players_online) AS players,
				COUNT() AS servers
			FROM per_hour_server
			GROUP BY day
			ORDER BY day ASC
		`,
		query_params: {
			project_slug: projectSlug,
			days,
		},
		format: "JSONEachRow",
	});

	const rows = await resultSet.json();
	return rows.map((row) => ({
		day: toIsoDateTimeOrNull(row.day),
		players: Math.max(0, toSafeNumber(row.players)),
		servers: Math.max(0, toSafeNumber(row.servers)),
	})).filter((row) => Boolean(row.day));
};

const getProjectOnlineSeriesForLast30Days = async (projectSlug) => {
	const resultSet = await clickhouse.query({
		query: `
			WITH per_hour_server AS (
				SELECT
					toStartOfHour(toDateTime(event_at)) AS hour_at,
					server_uuid,
					argMax(players_online, event_at) AS players_online
				FROM mod_server_updates
				WHERE project_slug = {project_slug:String}
				AND event_at >= toUInt32(toUnixTimestamp(now()) - (30 * 86400))
				AND event_at <= now()
				GROUP BY hour_at, server_uuid
			)
			SELECT
				hour_at AS day,
				SUM(players_online) AS players,
				COUNT() AS servers
			FROM per_hour_server
			GROUP BY day
			ORDER BY day ASC
		`,
		query_params: {
			project_slug: projectSlug,
		},
		format: "JSONEachRow",
	});

	const rows = await resultSet.json();
	return rows.map((row) => ({
		day: toIsoDateTimeOrNull(row.day),
		players: Math.max(0, toSafeNumber(row.players)),
		servers: Math.max(0, toSafeNumber(row.servers)),
	})).filter((row) => Boolean(row.day));
};

router.use((req, res, next) => {
	console.log("[analytics]", req.method, req.originalUrl, "body:", req.body || null);
	next();
});

router.get("/user", auth, async (req, res) => {
	try {
		const userId = req.user.id;
		const { from, to } = normalizeAnalyticsDateBounds({
			from: Array.isArray(req.query.from) ? req.query.from[0] : req.query.from,
			to: Array.isArray(req.query.to) ? req.query.to[0] : req.query.to,
		});
		const requestedProjectIds = normalizeAnalyticsProjectIds(req.query.project_ids);

		const [projects] = await db.query(
			`
			SELECT id, slug, title, color, icon_url, project_type
			FROM projects
			WHERE user_id = ? AND status = 'approved'
			ORDER BY title ASC, id ASC
			`,
			[userId]
		);

		const requestedProjectIdSet = new Set(requestedProjectIds);
		const selectedProjects = requestedProjectIdSet.size ? projects.filter((project) => requestedProjectIdSet.has(String(project.id))) : projects;
		const selectedProjectSlugs = selectedProjects.map((project) => project.slug);
		const shouldSplitByProject = selectedProjects.length > 1;

		let downloads = [];
		let views = [];
		let countries = [];
		let downloadsByProject = {};
		let viewsByProject = {};
		let onlineSummary = { playersOnlineNow: 0, activeServersNow: 0 };
		let onlineSeries = [];

		if(selectedProjectSlugs.length && hasClickHouseConfig && clickhouse) {
			try {
				const analyticsPromises = [
					getProjectEventSeriesForSlugs({ projectSlugs: selectedProjectSlugs, eventType: "download", from, to }),
					getProjectEventSeriesForSlugs({ projectSlugs: selectedProjectSlugs, eventType: "view", from, to }),
					getProjectDownloadCountriesForSlugs({ projectSlugs: selectedProjectSlugs, from, to }),
					getOnlineNowForProjectSlugs(selectedProjectSlugs),
					getOnlineSeriesForProjectSlugs({ projectSlugs: selectedProjectSlugs, from, to }),
				];

				if(shouldSplitByProject) {
					analyticsPromises.push(
						getProjectEventSeriesForSlugs({ projectSlugs: selectedProjectSlugs, eventType: "download", from, to, splitByProject: true }),
						getProjectEventSeriesForSlugs({ projectSlugs: selectedProjectSlugs, eventType: "view", from, to, splitByProject: true })
					);
				}

				const analyticsResults = await Promise.all(analyticsPromises);
				[downloads, views, countries, onlineSummary, onlineSeries] = analyticsResults;
				if(shouldSplitByProject) {
					downloadsByProject = analyticsResults[5] || {};
					viewsByProject = analyticsResults[6] || {};
				}
			} catch (analyticsError) {
				console.warn("Failed to fetch user analytics:", analyticsError.message);
			}
		} else {
			downloads = buildDailySeriesBetween(from, to);
			views = buildDailySeriesBetween(from, to);
		}

		const mapProjectPayload = (project) => ({
			id: String(project.id),
			slug: project.slug,
			title: project.title,
			color: project.color,
			icon_url: project.icon_url || "https://media.modifold.com/static/no-project-icon.svg",
			project_type: project.project_type,
		});

		res.json({
			from,
			to,
			project_ids: selectedProjects.map((project) => String(project.id)),
			projects: projects.map(mapProjectPayload),
			selectedProjects: selectedProjects.map(mapProjectPayload),
			downloads,
			views,
			downloadsByProject,
			viewsByProject,
			countries,
			onlineSummary,
			onlineSeries,
			totals: {
				downloads: downloads.reduce((sum, point) => sum + (Number(point.count) || 0), 0),
				views: views.reduce((sum, point) => sum + (Number(point.count) || 0), 0),
				countries: countries.reduce((sum, country) => sum + (Number(country.count) || 0), 0),
			},
		});
	} catch (error) {
		console.error("Error fetching user analytics dashboard:", error);
		res.status(500).json({ message: "Error fetching user analytics", error: error.message });
	}
});

router.post("/:projectSlug/server/add-plugin", async (req, res) => {
	try {
		const projectSlug = normalizeProjectSlug(req.params?.projectSlug);
		const { server_uuid, plugin_version } = req.body || {};

		if(!projectSlug) {
			return res.status(400).json({ error: "bad_project_slug" });
		}

		if(!server_uuid || typeof server_uuid !== "string") {
			return res.status(400).json({ error: "bad_server_uuid" });
		}

		if(!clickhouse) {
			return res.status(503).json({ error: "analytics_unavailable" });
		}

		const version = typeof plugin_version === "string" ? plugin_version.trim() : null;

		await clickhouse.insert({
			table: "mod_plugin_installs",
			values: [{
				project_slug: projectSlug,
				server_uuid,
				plugin_version: version,
				event_at: Math.floor(Date.now() / 1000),
			}],
			format: "JSONEachRow",
		});

		res.json({ ok: true });
	} catch (e) {
		console.error(e);
		res.status(500).json({ error: "internal_error" });
	}
});

router.post("/:projectSlug/server/update-server", async (req, res) => {
	try {
		const projectSlug = normalizeProjectSlug(req.params?.projectSlug);
		const { server_uuid, players_online, os_name, os_version, java_version, cores } = req.body || {};

		if(!projectSlug) {
			return res.status(400).json({ error: "bad_project_slug" });
		}

		if(!server_uuid || typeof server_uuid !== "string") {
			return res.status(400).json({ error: "bad_server_uuid" });
		}

		if(!clickhouse) {
			return res.status(503).json({ error: "analytics_unavailable" });
		}

		const players = Math.max(0, toSafeNumber(players_online));
		const cpuCores = Math.max(0, toSafeNumber(cores));

		await clickhouse.insert({
			table: "mod_server_updates",
			values: [{
				project_slug: projectSlug,
				server_uuid,
				players_online: players,
				os_name: typeof os_name === "string" ? os_name : null,
				os_version: typeof os_version === "string" ? os_version : null,
				java_version: typeof java_version === "string" ? java_version : null,
				cores: cpuCores,
				event_at: Math.floor(Date.now() / 1000),
			}],
			format: "JSONEachRow",
		});

		res.json({ ok: true });
	} catch (e) {
		console.error(e);
		res.status(500).json({ error: "internal_error" });
	}
});

router.get("/:projectSlug/online-now", async (req, res) => {
	try {
		const projectSlug = normalizeProjectSlug(req.params?.projectSlug);

		if(!projectSlug) {
			return res.status(400).json({ error: "bad_project_slug" });
		}

		if(!clickhouse) {
			return res.status(503).json({ error: "analytics_unavailable" });
		}

		const { playersOnlineNow, activeServersNow } = await getProjectOnlineNow(projectSlug);

		res.json({
			projectSlug,
			onlineNow: playersOnlineNow,
			playersOnlineNow,
			activeServersNow,
		});
	} catch (e) {
		console.error(e);
		res.status(500).json({ error: "internal_error" });
	}
});

router.get("/:projectSlug/embed", async (req, res) => {
	try {
		const projectSlug = normalizeProjectSlug(req.params?.projectSlug);
		const theme = normalizeEmbedTheme(req.query?.theme);

		if(!projectSlug) {
			return res.status(400).json({ error: "bad_project_slug" });
		}

		if(!clickhouse) {
			return res.status(503).json({ error: "analytics_unavailable" });
		}

		const projectMeta = await getProjectEmbedMeta(projectSlug);
		if(!projectMeta) {
			return res.status(404).json({ error: "project_not_found" });
		}

		const [onlineNow, points] = await Promise.all([
			getProjectOnlineNow(projectSlug),
			getProjectOnlineSeriesForLast30Days(projectSlug),
		]);

		const svg = renderProjectAnalyticsEmbedSvg({
			projectTitle: projectMeta.title || projectSlug,
			theme,
			points,
			playersOnlineNow: onlineNow.playersOnlineNow,
			activeServersNow: onlineNow.activeServersNow,
		});

		res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
		res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=300");
		return res.status(200).send(svg);
	} catch (e) {
		console.error(e);
		res.status(500).json({ error: "internal_error" });
	}
});

router.get("/:projectSlug/chart/daily-joins", async (req, res) => {
	try {
		const projectSlug = normalizeProjectSlug(req.params?.projectSlug);
		const days = normalizeDaysParam(req.query?.days);

		if(!projectSlug) {
			return res.status(400).json({ error: "bad_project_slug" });
		}
        
		if(!clickhouse) {
			return res.status(503).json({ error: "analytics_unavailable" });
		}

		const points = (await getProjectOnlineSeries(projectSlug, days)).map((point) => ({
			...point,
			joins: point.players,
		}));

		res.json({
			projectSlug,
			days,
			points,
		});
	} catch (e) {
		console.error(e);
		res.status(500).json({ error: "internal_error" });
	}
});

module.exports = router;