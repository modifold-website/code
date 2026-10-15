const express = require("express");
const { db } = require("../../config/db");
const { clickhouse } = require("../../config/clickhouse");
const auth = require("../../middleware/auth");
const { logger } = require("../../packages/shared/logger");
const { getAnalyticsPeriod, daySeries, shiftDay } = require("../../utils/moderationAnalyticsDates");

const router = express.Router();
const countEvents = "countIf(event_id IS NULL OR event_type != 'download') + uniqExactIf(event_id, event_id IS NOT NULL AND event_type = 'download')";
const number = (value) => Math.max(0, Number(value) || 0);
const date = (value) => value instanceof Date ? value.toISOString() : value ? String(value).replace(" ", "T").replace(/Z?$/, "Z") : null;
const handle = (callback) => (req, res, next) => Promise.resolve(callback(req, res, next)).catch(next);

router.use(
	auth,
	handle(async (req, res, next) => {
		const [[actor]] = await db.query("SELECT isRole FROM users WHERE id = ?", [req.user.id]);
		if(actor?.isRole !== "admin" && actor?.isRole !== "moderator") {
			return res.status(403).json({ message: "forbidden" });
		}

		res.set("Cache-Control", "private, no-store");
		next();
	})
);

const queryEvents = async (query, params) => {
	if(!clickhouse) {
		throw new Error("analytics_unavailable");
	}

	const result = await clickhouse.query({
		query,
		query_params: params,
		format: "JSONEachRow",
		clickhouse_settings: { max_execution_time: 20 },
	});

	return result.json();
};

const makeSeries = (rows, coverage, from, to) => {
	const counts = new Map(rows.map((row) => [`${row.date}:${row.event_type}`, number(row.count)]));
	
	return daySeries(from, to).map((day) => ({
		date: day,
		download: coverage.download && day >= coverage.download ? counts.get(`${day}:download`) || 0 : null,
		view: coverage.view && day >= coverage.view ? counts.get(`${day}:view`) || 0 : null,
	}));
};

router.get("/projects/:project/report", handle(async (req, res) => {
		const period = getAnalyticsPeriod(req.query);
		const [[projectRow]] = await db.query(
			`SELECT p.id, p.slug, p.title, p.icon_url, p.project_type, p.status, p.visibility,
			p.is_archived, p.created_at, p.updated_at,
			u.username AS owner_name, u.slug AS owner_slug
			FROM projects p LEFT JOIN users u ON u.id = p.user_id
			WHERE BINARY p.id = BINARY ? OR p.slug = ?
			ORDER BY (BINARY p.id = BINARY ?) DESC LIMIT 1`,
			[req.params.project, req.params.project, req.params.project]
		);

		if(!projectRow) {
			return res.status(404).json({ message: "project_not_found" });
		}

		const project = {
			...projectRow,
			created_at: date(projectRow.created_at),
			updated_at: date(projectRow.updated_at),
		};

		const [versions] = await db.query(
			`SELECT id, version_number, created_at FROM project_versions
			WHERE project_id = ? AND moderation_status = 'approved' ORDER BY created_at DESC, id DESC`,
			[project.id]
		);

		const params = {
			slug: project.slug,
			start: `${period.previousFrom} 00:00:00`,
			from: `${period.from} 00:00:00`,
			end: `${shiftDay(period.to, 1)} 00:00:00`,
		};

		const results = await Promise.allSettled([
			queryEvents(
				`SELECT toDate(created_at, 'UTC') AS date, event_type, ${countEvents} AS count
			FROM project_events WHERE project_slug = {slug:String}
			AND created_at >= toDateTime({start:String}, 'UTC') AND created_at < toDateTime({end:String}, 'UTC')
			AND event_type IN ('view', 'download') GROUP BY date, event_type ORDER BY date`,
				params
			),
			queryEvents(
				`SELECT if(match(lower(ifNull(country_code, '')), '^[a-z]{2}$')
			AND lower(ifNull(country_code, '')) NOT IN ('xx', 'zz'), lower(ifNull(country_code, '')), '') AS country,
			ifNull(version_id, '') AS version_id, ${countEvents} AS count
			FROM project_events WHERE project_slug = {slug:String} AND event_type = 'download'
			AND created_at >= toDateTime({from:String}, 'UTC') AND created_at < toDateTime({end:String}, 'UTC')
			GROUP BY country, version_id`,
				params
			),
			queryEvents(
				`SELECT event_type, toDate(min(created_at), 'UTC') AS first_day FROM project_events
			WHERE event_type IN ('view', 'download') GROUP BY event_type`,
				{}
			),
		]);

		for(const result of results) {
			if(result.status === "rejected") {
				logger.error("Project analytics unavailable", result.reason);
			}
		}

		const available = results[0].status === "fulfilled" && results[2].status === "fulfilled";
		const breakdownAvailable = results[1].status === "fulfilled";
		const coverage = Object.fromEntries(
			results[2].status === "fulfilled" ? results[2].value.map((row) => [row.event_type, row.first_day]) : []
		);

		const series = available ? makeSeries(results[0].value, coverage, period.from, period.to) : [];
		const previousSeries = available ? makeSeries(results[0].value, coverage, period.previousFrom, period.previousTo) : [];
		const countries = new Map();
		const versionCounts = new Map();
		for(const row of breakdownAvailable ? results[1].value : []) {
			countries.set(row.country, (countries.get(row.country) || 0) + number(row.count));
			versionCounts.set(row.version_id, (versionCounts.get(row.version_id) || 0) + number(row.count));
		}

		const totals = Object.fromEntries(
			["view", "download"].map((type) => [
				type,
				series.some((point) => point[type] !== null) ? series.reduce((sum, point) => sum + number(point[type]), 0) : null,
			])
		);

		const versionRows = versions.map((version) => ({
			id: version.id,
			version_number: version.version_number,
			uploaded_at: date(version.created_at),
			downloads: breakdownAvailable && coverage.download <= period.to ? versionCounts.get(version.id) || 0 : null,
		}));

		res.json({
			project,
			available,
			breakdownAvailable,
			series,
			previousSeries,
			totals,
			newVersions: versionRows.filter(
				(version) => version.uploaded_at.slice(0, 10) >= period.from && version.uploaded_at.slice(0, 10) <= period.to
			).length,
			versions: versionRows,
			countries: [...countries].map(([country_code, count]) => ({ country_code, count })).sort((a, b) => b.count - a.count),
		});
	})
);

router.use((error, req, res, next) => {
	if(!error.statusCode || error.statusCode >= 500) {
		logger.error("Project analytics failed", error);
	}

	res.status(error.statusCode || 500).json({ message: error.statusCode ? error.message : "analytics_failed" });
});

module.exports = router;