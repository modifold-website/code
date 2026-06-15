const express = require("express");
const { db } = require("../../config/db");
const { clickhouse } = require("../../config/clickhouse");
const auth = require("../../middleware/auth");
const { sanitizePlainText } = require("../../utils/sanitize");
const { fanoutVersionReleaseNotifications, sendVersionApprovedOwnerNotification } = require("../../utils/versionNotifications");
const router = express.Router();

const isModeratorRole = (role) => role === "admin" || role === "moderator";
const toSafeNumber = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
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

const getGlobalOnlineNow = async () => {
    if(!clickhouse) {
        return {
            playersOnlineNow: 0,
            activeServersNow: 0,
        };
    }

    const resultSet = await clickhouse.query({
        query: `
            SELECT
                COALESCE(SUM(latest_players), 0) AS playersOnlineNow,
                COUNT() AS activeServersNow
            FROM (
                SELECT
                    project_slug,
                    server_uuid,
                    argMax(players_online, event_at) AS latest_players
                FROM mod_server_updates
                WHERE event_at >= toUInt32(toUnixTimestamp(now()) - {window_seconds:UInt32})
                AND event_at <= now()
                GROUP BY project_slug, server_uuid
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

const getGlobalOnlineSeriesForLast30Days = async () => {
    if(!clickhouse) {
        return [];
    }

    const resultSet = await clickhouse.query({
        query: `
            WITH per_hour_server AS (
                SELECT
                    toStartOfHour(toDateTime(event_at)) AS hour_at,
                    project_slug,
                    server_uuid,
                    argMax(players_online, event_at) AS players_online
                FROM mod_server_updates
                WHERE event_at >= toUInt32(toUnixTimestamp(now()) - (30 * 86400))
                AND event_at <= now()
                GROUP BY hour_at, project_slug, server_uuid
            )
            SELECT
                hour_at AS day,
                SUM(players_online) AS players,
                COUNT() AS servers
            FROM per_hour_server
            GROUP BY day
            ORDER BY day ASC
        `,
        format: "JSONEachRow",
    });

    const rows = await resultSet.json();
    return rows.map((row) => ({
        day: toIsoDateTimeOrNull(row.day),
        players: Math.max(0, toSafeNumber(row.players)),
        servers: Math.max(0, toSafeNumber(row.servers)),
    })).filter((row) => Boolean(row.day));
};

const ensureModerator = async (req, res) => {
    const [user] = await db.query("SELECT isRole FROM users WHERE id = ?", [req.user.id]);
    const role = user?.[0]?.isRole;

    if(!isModeratorRole(role)) {
        res.status(403).json({ message: "Unauthorized" });
        return null;
    }

    return role;
};

const ensureArgus = (req, res) => {
	const header = req.headers.authorization || "";
	const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length) : "";

	if(!process.env.ARGUS_SHARED_SECRET || token !== process.env.ARGUS_SHARED_SECRET) {
		res.status(403).json({ message: "Forbidden" });
		return false;
	}

	return true;
};

const normalizeArgusReport = (value) => {
	if(value === undefined || value === null) {
		return null;
	}

	if(typeof value === "string") {
		return value;
	}

	try {
		return JSON.stringify(value);
	} catch {
		return null;
	}
};

const getVersionForModeration = async (versionId) => {
	const [rows] = await db.query(
		`SELECT
		v.id,
		v.project_id,
		v.version_number,
		v.changelog,
		v.release_channel,
		v.file_url,
		v.file_size,
		v.downloads,
		v.created_at,
		v.game_versions,
		v.loaders,
		v.moderation_status,
		v.moderation_reason,
		v.argus_report,
		v.scan_requested_at,
		v.scanned_at,
		p.slug AS project_slug,
		p.title AS project_title,
		p.summary AS project_summary,
		p.icon_url AS project_icon_url,
		p.project_type,
		p.user_id AS project_owner_user_id,
		u.username AS owner_username,
		u.slug AS owner_slug
		FROM project_versions v
		INNER JOIN projects p ON p.id = v.project_id
		LEFT JOIN users u ON u.id = p.user_id
		WHERE v.id = ?
		LIMIT 1`,
		[versionId]
	);

	return rows[0] || null;
};

const parseMaybeJsonArray = (value) => {
	if(!value) {
		return [];
	}

	if(Array.isArray(value)) {
		return value;
	}

	try {
		const parsed = JSON.parse(value);
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
};

const parseMaybeJsonObject = (value) => {
	if(!value) {
		return null;
	}

	if(typeof value === "object") {
		return value;
	}

	try {
		return JSON.parse(value);
	} catch {
		return null;
	}
};

const mapVersionReview = (version) => ({
	id: version.id,
	project_id: version.project_id,
	project_slug: version.project_slug,
	project_title: version.project_title,
	project_summary: version.project_summary,
	project_icon_url: version.project_icon_url || "https://media.modifold.com/static/no-project-icon.svg",
	project_type: version.project_type,
	owner_username: version.owner_username,
	owner_slug: version.owner_slug,
	version_number: version.version_number,
	changelog: version.changelog,
	release_channel: version.release_channel,
	file_url: version.file_url,
	file_size: Number(version.file_size || 0),
	downloads: Number(version.downloads || 0),
	created_at: version.created_at,
	game_versions: parseMaybeJsonArray(version.game_versions),
	loaders: parseMaybeJsonArray(version.loaders),
	moderation_status: version.moderation_status,
	moderation_reason: version.moderation_reason,
	argus_report: parseMaybeJsonObject(version.argus_report),
	scan_requested_at: version.scan_requested_at,
	scanned_at: version.scanned_at,
});

const notifyVersionApproved = async ({ version, actorUserId, createdAt }) => {
	const actorId = actorUserId || version.project_owner_user_id;

	try {
		await sendVersionApprovedOwnerNotification({
			projectOwnerUserId: version.project_owner_user_id,
			actorUserId: actorId,
			versionId: version.id,
			createdAt,
		});
	} catch (error) {
		console.error("Error sending owner version approval notification:", error);
	}

	try {
		await fanoutVersionReleaseNotifications({
			projectOwnerUserId: version.project_owner_user_id,
			actorUserId: actorId,
			projectId: version.project_id,
			versionId: version.id,
			createdAt,
		});
	} catch (error) {
		console.error("Error sending project version release notifications:", error);
	}
};

router.post("/argus/versions/:versionId/report", async (req, res) => {
	if(!ensureArgus(req, res)) {
		return;
	}

	const { versionId } = req.params;
	const verdict = String(req.body?.verdict || "").trim();
	const allowedVerdicts = ["approved", "needs_review", "blocked", "error"];

	if(!allowedVerdicts.includes(verdict)) {
		return res.status(400).json({ message: "Invalid Argus verdict" });
	}

	const reason = sanitizePlainText(String(req.body?.reason || ""), { preserveNewlines: true }) || null;
	const report = normalizeArgusReport(req.body?.report || null);
	const status = verdict === "error" ? "error" : "needs_review";

	try {
		const version = await getVersionForModeration(versionId);
		if(!version) {
			return res.status(404).json({ message: "Version not found" });
		}

		await db.query(
			`UPDATE project_versions
			SET moderation_status = ?,
			moderation_reason = ?,
			argus_report = ?,
			scanned_at = NOW()
			WHERE id = ?`,
			[status, reason, report, versionId]
		);

		return res.json({ success: true });
	} catch (error) {
		console.error("Error applying Argus report:", error);
		return res.status(500).json({ message: "Error applying Argus report", error: error.message });
	}
});

router.get("/technical-review", auth, async (req, res) => {
	if(!(await ensureModerator(req, res))) {
		return;
	}

	try {
		const { search = "", status = "needs_review", sort = "oldest", page = 1, limit = 20 } = req.query;
		const allowedStatuses = ["needs_review", "pending", "scanning", "blocked", "error", "all"];
		const allowedSort = ["oldest", "newest"];

		if(!allowedStatuses.includes(String(status))) {
			return res.status(400).json({ message: "Invalid status" });
		}

		if(!allowedSort.includes(String(sort))) {
			return res.status(400).json({ message: "Invalid sort option" });
		}

		const pageNumber = Number(page);
		const limitNumber = Number(limit);

		if(!Number.isFinite(pageNumber) || pageNumber < 1) {
			return res.status(400).json({ message: "Invalid page number" });
		}

		if(!Number.isFinite(limitNumber) || limitNumber < 1 || limitNumber > 100) {
			return res.status(400).json({ message: "Invalid limit" });
		}

		const where = [];
		const params = [];
		const countParams = [];

		if(status !== "all") {
			where.push("v.moderation_status = ?");
			params.push(status);
			countParams.push(status);
		} else {
			where.push("v.moderation_status IN ('pending', 'scanning', 'needs_review', 'blocked', 'error')");
		}

		if(String(search).trim()) {
			const q = `%${String(search).trim()}%`;
			where.push("(p.title LIKE ? OR p.slug LIKE ? OR v.version_number LIKE ? OR v.id LIKE ?)");
			params.push(q, q, q, q);
			countParams.push(q, q, q, q);
		}

		const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
		const orderSql = sort === "newest" ? "ORDER BY v.created_at DESC" : "ORDER BY v.created_at ASC";
		const offset = (pageNumber - 1) * limitNumber;

		const listQuery = `
			SELECT
			v.id,
			v.project_id,
			v.version_number,
			v.changelog,
			v.release_channel,
			v.file_url,
			v.file_size,
			v.downloads,
			v.created_at,
			v.game_versions,
			v.loaders,
			v.moderation_status,
			v.moderation_reason,
			v.argus_report,
			v.scan_requested_at,
			v.scanned_at,
			p.slug AS project_slug,
			p.title AS project_title,
			p.summary AS project_summary,
			p.icon_url AS project_icon_url,
			p.project_type,
			p.user_id AS project_owner_user_id,
			u.username AS owner_username,
			u.slug AS owner_slug
			FROM project_versions v
			INNER JOIN projects p ON p.id = v.project_id
			LEFT JOIN users u ON u.id = p.user_id
			${whereSql}
			${orderSql}
			LIMIT ? OFFSET ?
		`;

		const countQuery = `
			SELECT COUNT(*) AS total
			FROM project_versions v
			INNER JOIN projects p ON p.id = v.project_id
			${whereSql}
		`;

		const [versions] = await db.query(listQuery, [...params, limitNumber, offset]);
		const [[{ total }]] = await db.query(countQuery, countParams);

		return res.json({
			versions: versions.map(mapVersionReview),
			totalPages: Math.max(1, Math.ceil(total / limitNumber)),
			currentPage: pageNumber,
			totalVersions: total,
		});
	} catch (error) {
		console.error("Error fetching Argus technical review queue:", error);
		return res.status(500).json({ message: "Error fetching technical review queue" });
	}
});

router.post("/technical-review/:versionId/decision", auth, async (req, res) => {
	if(!(await ensureModerator(req, res))) {
		return;
	}

	const { versionId } = req.params;
	const decision = String(req.body?.decision || "").trim();
	const reason = sanitizePlainText(String(req.body?.reason || ""), { preserveNewlines: true });

	if(!["approved", "blocked"].includes(decision)) {
		return res.status(400).json({ message: "Invalid decision" });
	}

	if(decision === "blocked" && !reason) {
		return res.status(400).json({ message: "Reason is required" });
	}

	const createdAt = Math.floor(Date.now() / 1000);

	try {
		const version = await getVersionForModeration(versionId);
		if(!version) {
			return res.status(404).json({ message: "Version not found" });
		}

		await db.query(
			`UPDATE project_versions
			SET moderation_status = ?,
			moderation_reason = ?,
			moderated_by = ?,
			moderated_at = NOW()
			WHERE id = ?`,
			[decision, decision === "blocked" ? reason : null, req.user.id, versionId]
		);

		await db.query(
			`INSERT INTO project_moderation_logs
			(project_id, action, moderator_id, reason, created_at)
			VALUES (?, ?, ?, ?, NOW())`,
			[version.project_id, decision === "approved" ? "approved" : "rejected", req.user.id, decision === "blocked" ? reason : "Version approved by technical review"]
		);

		if(decision === "approved") {
			await notifyVersionApproved({ version, actorUserId: req.user.id, createdAt });
		}

		return res.json({ success: true });
	} catch (error) {
		console.error("Error applying technical review decision:", error);
		return res.status(500).json({ message: "Error applying technical review decision", error: error.message });
	}
});

router.get("/", auth, async (req, res) => {
    if(!(await ensureModerator(req, res))) {
        return;
    }

    try {
        const { search = "", type, sort = "oldest", page = 1, limit = 20 } = req.query;
        const typeMap = {
            mods: "mod",
            mod: "mod",
        };

        const normalizedType = type ? typeMap[type.toLowerCase()] : undefined;

        if(type && !normalizedType) {
            return res.status(400).json({ message: "Invalid project type" });
        }

        if(sort && !["oldest", "newest"].includes(sort)) {
            return res.status(400).json({ message: "Invalid sort option" });
        }

        if(isNaN(page) || page < 1) {
            return res.status(400).json({ message: "Invalid page number" });
        }

        if(isNaN(limit) || limit < 1) {
            return res.status(400).json({ message: "Invalid limit" });
        }

        const offset = (page - 1) * limit;
        let query = `
            SELECT id, slug, title, summary, project_type, status, created_at, icon_url, tags
            FROM projects
            WHERE status IN ('queued', 'pending')
        `;

        let countQuery = `
            SELECT COUNT(*) as total
            FROM projects
            WHERE status IN ('queued', 'pending')
        `;

        const params = [];
        const countParams = [];

        if(search) {
            query += " AND title LIKE ?";
            countQuery += " AND title LIKE ?";
            params.push(`%${search}%`);
            countParams.push(`%${search}%`);
        }

        if(normalizedType) {
            query += " AND project_type = ?";
            countQuery += " AND project_type = ?";
            params.push(normalizedType);
            countParams.push(normalizedType);
        }

        query += sort === "newest" ? " ORDER BY created_at DESC" : " ORDER BY created_at ASC";

        query += " LIMIT ? OFFSET ?";
        params.push(Number(limit), Number(offset));

        const [projects] = await db.query(query, params);
        const [[{ total }]] = await db.query(countQuery, countParams);

        res.json({
            projects: projects.map((project) => ({
                ...project,
                icon_url: project.icon_url || "https://media.modifold.com/static/no-project-icon.svg",
            })),
            totalPages: Math.ceil(total / limit),
            currentPage: Number(page),
            totalProjects: total,
        });
    } catch (error) {
        console.error("Error fetching projects for moderation:", error);
        res.status(500).json({ message: "Error fetching projects", error: error.message });
    }
});

router.post("/:id/moderate", auth, async (req, res) => {
    if(!(await ensureModerator(req, res))) {
        return;
    }

    const { id } = req.params;
    const { status, reason } = req.body;
    const moderatorId = req.user.id;

    if(!["approved", "rejected"].includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
    }

    try {
        await db.query("UPDATE projects SET status = ? WHERE id = ?", [status, id]);

        await db.query(
            "INSERT INTO project_moderation_logs (project_id, action, moderator_id, reason, created_at) VALUES (?, ?, ?, ?, NOW())",
            [id, status, moderatorId, reason ? sanitizePlainText(reason, { preserveNewlines: true }) : null]
        );

        if(status === "approved") {
            try {
                const [projectRows] = await db.query(
                    `SELECT p.slug, p.title, p.summary, p.icon_url, u.username
                    FROM projects p
                    LEFT JOIN users u ON p.user_id = u.id
                    WHERE p.id = ?
                    LIMIT 1`,
                    [id]
                );

                const project = projectRows[0];

                if(!project) {
                    console.warn(`Project ${id} not found after approval, skipping published-mod notification`);
                } else {
                    await fetch("https://api.hytalemodd.ing/published-mod", {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({
                            apiKey: process.env.HYTALE_MODDING_API_KEY,
                            type: "New",
                            title: project.title,
                            description: project.summary,
                            iconLink: project.icon_url || "https://media.modifold.com/static/no-project-icon.svg",
                            modLink: `https://modifold.com/mod/${project.slug}`,
                            developerName: project.username || "Unknown",
                        }),
                    });
                }
            } catch (publishError) {
                console.error("Error sending published-mod notification:", publishError);
            }
        }

        res.json({ success: true });
    } catch (error) {
        console.error("Error moderating project:", error);
        res.status(500).json({ message: "Error moderating project", error: error.message });
    }
});

router.get("/analytics", auth, async (req, res) => {
    if(!(await ensureModerator(req, res))) {
        return;
    }

    try {
        const { time_range = "30d" } = req.query;
        let dateFilter = "";
        const params = [];

        if(time_range === "7d") {
            dateFilter = "created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)";
        } else if(time_range === "30d") {
            dateFilter = "created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)";
        } else if(time_range === "1y") {
            dateFilter = "created_at >= DATE_SUB(NOW(), INTERVAL 1 YEAR)";
        }

        const approvedWhereSql = [dateFilter, "status = 'approved'"].filter(Boolean).join(" AND ");
        const pendingWhereSql = [dateFilter, "status IN ('queued', 'pending')"].filter(Boolean).join(" AND ");
        const userDateFilter = dateFilter ? dateFilter.replaceAll("created_at", "FROM_UNIXTIME(created_at / 1000)") : "";

        const approvedProjectsQuery = `
            SELECT DATE(created_at) AS date, COUNT(*) AS count
            FROM projects
            ${approvedWhereSql ? `WHERE ${approvedWhereSql}` : ""}
            GROUP BY DATE(created_at)
            ORDER BY DATE(created_at)
        `;

        const pendingProjectsQuery = `
            SELECT DATE(created_at) AS date, COUNT(*) AS count
            FROM projects
            ${pendingWhereSql ? `WHERE ${pendingWhereSql}` : ""}
            GROUP BY DATE(created_at)
            ORDER BY DATE(created_at)
        `;

        const totalApprovedQuery = `
            SELECT COUNT(*) AS total
            FROM projects
            WHERE status = 'approved'
        `;
        
        const userRegistrationsQuery = `
            SELECT DATE(FROM_UNIXTIME(created_at / 1000)) AS date, COUNT(*) AS count
            FROM users
            ${userDateFilter ? `WHERE ${userDateFilter}` : ""}
            GROUP BY DATE(FROM_UNIXTIME(created_at / 1000))
            ORDER BY DATE(FROM_UNIXTIME(created_at / 1000))
        `;

        const totalUsersQuery = `
            SELECT COUNT(*) AS total
            FROM users
        `;

        const totalProjectVersionsQuery = `
            SELECT COUNT(*) AS total
            FROM project_versions
        `;

        const totalProjectDownloadsQuery = `
            SELECT COALESCE(SUM(downloads), 0) AS total
            FROM projects
        `;

        const totalPendingQuery = `
            SELECT COUNT(*) AS total
            FROM projects
            WHERE status IN ('queued', 'pending')
        `;
        
        const totalUnpublishedProjectsQuery = `
            SELECT COUNT(*) AS total
            FROM projects
            WHERE status <> 'approved'
        `;
        
        const [approvedProjects] = await db.query(approvedProjectsQuery, params);
        const [pendingProjects] = await db.query(pendingProjectsQuery, params);
        const [userRegistrations] = await db.query(userRegistrationsQuery, params);
        const [[{ total: totalApproved }]] = await db.query(totalApprovedQuery);
        const [[{ total: totalPending }]] = await db.query(totalPendingQuery);
        const [[{ total: totalUsers }]] = await db.query(totalUsersQuery);
        const [[{ total: totalProjectVersions }]] = await db.query(totalProjectVersionsQuery);
        const [[{ total: totalProjectDownloads }]] = await db.query(totalProjectDownloadsQuery);
        const [[{ total: totalUnpublishedProjects }]] = await db.query(totalUnpublishedProjectsQuery);
        let onlineSummary = { playersOnlineNow: 0, activeServersNow: 0 };
        let globalOnlineSeries = [];

        try {
            [onlineSummary, globalOnlineSeries] = await Promise.all([
                getGlobalOnlineNow(),
                getGlobalOnlineSeriesForLast30Days(),
            ]);
        } catch (analyticsError) {
            console.error("Error fetching global online analytics:", analyticsError);
        }

        res.json({
            approvedProjects: approvedProjects.map(row => ({
                date: row.date,
                count: row.count
            })),
            pendingProjects: pendingProjects.map(row => ({
                date: row.date,
                count: row.count
            })),
            userRegistrations: userRegistrations.map(row => ({
                date: row.date,
                count: row.count
            })),
            totalApproved,
            totalPending,
            totalUsers,
            totalProjectVersions,
            totalProjectDownloads,
            totalUnpublishedProjects,
            totalPlayersOnlineNow: onlineSummary.playersOnlineNow,
            totalActiveServersNow: onlineSummary.activeServersNow,
            onlineSummary,
            globalOnlineSeries,
        });
    } catch (error) {
        console.error("Error fetching moderation analytics:", error);
        res.status(500).json({ message: "Error fetching analytics", error: error.message });
    }
});

router.get("/reports", auth, async (req, res) => {
    if(!(await ensureModerator(req, res))) {
        return;
    }

    try {
        const { search = "", status = "open", reason = "all", sort = "newest", page = 1, limit = 20 } = req.query;

        const allowedStatuses = ["open", "resolved", "dismissed", "all"];
        const allowedSort = ["newest", "oldest"];

        if(!allowedStatuses.includes(String(status))) {
            return res.status(400).json({ message: "Invalid report status" });
        }

        if(!allowedSort.includes(String(sort))) {
            return res.status(400).json({ message: "Invalid sort option" });
        }

        const pageNumber = Number(page);
        const limitNumber = Number(limit);

        if(!Number.isFinite(pageNumber) || pageNumber < 1) {
            return res.status(400).json({ message: "Invalid page number" });
        }

        if(!Number.isFinite(limitNumber) || limitNumber < 1 || limitNumber > 100) {
            return res.status(400).json({ message: "Invalid limit" });
        }

        const where = [];
        const params = [];
        const countParams = [];

        if(status !== "all") {
            where.push("pr.status = ?");
            params.push(status);
            countParams.push(status);
        }

        if(reason !== "all") {
            where.push("pr.reason_code = ?");
            params.push(String(reason));
            countParams.push(String(reason));
        }

        if(String(search).trim()) {
            const q = `%${String(search).trim()}%`;
            where.push("(p.title LIKE ? OR p.slug LIKE ? OR reporter.username LIKE ? OR pr.comment LIKE ?)");
            params.push(q, q, q, q);
            countParams.push(q, q, q, q);
        }

        const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
        const orderSql = sort === "oldest" ? "ORDER BY pr.created_at ASC" : "ORDER BY pr.created_at DESC";
        const offset = (pageNumber - 1) * limitNumber;

        const listQuery = `
            SELECT
            pr.id,
            pr.project_id,
            pr.project_slug,
            COALESCE(p.title, pr.project_title_snapshot) AS project_title,
            p.project_type,
            pr.reason_code,
            pr.comment,
            pr.status,
            pr.created_at,
            pr.updated_at,
            pr.resolved_at,
            pr.moderator_note,
            pr.reporter_user_id,
            reporter.username AS reporter_username,
            reporter.slug AS reporter_slug,
            reporter.avatar AS reporter_avatar,
            pr.resolved_by_user_id,
            resolver.username AS resolver_username
            FROM project_reports pr
            LEFT JOIN projects p ON BINARY p.id = BINARY pr.project_id
            LEFT JOIN users reporter ON BINARY reporter.id = BINARY pr.reporter_user_id
            LEFT JOIN users resolver ON BINARY resolver.id = BINARY pr.resolved_by_user_id
            ${whereSql}
            ${orderSql}
            LIMIT ? OFFSET ?
        `;

        const countQuery = `
            SELECT COUNT(*) AS total
            FROM project_reports pr
            LEFT JOIN projects p ON BINARY p.id = BINARY pr.project_id
            LEFT JOIN users reporter ON BINARY reporter.id = BINARY pr.reporter_user_id
            ${whereSql}
        `;

        const [reports] = await db.query(listQuery, [...params, limitNumber, offset]);
        const [[{ total }]] = await db.query(countQuery, countParams);

        return res.json({
            reports,
            totalPages: Math.max(1, Math.ceil(total / limitNumber)),
            currentPage: pageNumber,
            totalReports: total,
        });
    } catch (error) {
        console.error("Error fetching reports for moderation:", error);
        return res.status(500).json({ message: "Error fetching reports" });
    }
});

router.post("/reports/:id/decision", auth, async (req, res) => {
    if(!(await ensureModerator(req, res))) {
        return;
    }

    try {
        const reportId = req.params.id;
        const status = String(req.body?.status || "").trim();
        const allowedStatuses = ["resolved", "dismissed"];

        if(!allowedStatuses.includes(status)) {
            return res.status(400).json({ message: "Invalid decision status" });
        }

        const moderatorNoteRaw = req.body?.moderator_note ?? "";
        const moderatorNote = sanitizePlainText(moderatorNoteRaw, { preserveNewlines: true }) || null;

        if(moderatorNote && moderatorNote.length > 1000) {
            return res.status(400).json({ message: "Moderator note too long" });
        }

        const [existing] = await db.query("SELECT id, status FROM project_reports WHERE id = ? LIMIT 1", [reportId]);
        if(!existing.length) {
            return res.status(404).json({ message: "Report not found" });
        }

        await db.query(
            `UPDATE project_reports
            SET status = ?, moderator_note = ?, resolved_by_user_id = ?, resolved_at = NOW(), updated_at = NOW()
            WHERE id = ?`,
            [status, moderatorNote, req.user.id, reportId]
        );

        const [rows] = await db.query(
            `SELECT id, status, moderator_note, resolved_at, resolved_by_user_id
            FROM project_reports
            WHERE id = ? LIMIT 1`,
            [reportId]
        );

        return res.json({ success: true, report: rows[0] });
    } catch (error) {
        console.error("Error updating report decision:", error);
        return res.status(500).json({ message: "Error updating report" });
    }
});

module.exports = router;