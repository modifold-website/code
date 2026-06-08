require("dotenv").config();

const express = require("express");
const { db } = require("../config/db");
const { clickhouse } = require("../config/clickhouse");
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