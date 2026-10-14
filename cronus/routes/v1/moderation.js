const { logger } = require("../../packages/shared/logger");

const express = require("express");
const { db } = require("../../config/db");
const { clickhouse } = require("../../config/clickhouse");
const auth = require("../../middleware/auth");
const { sanitizePlainText } = require("../../utils/sanitize");
const { fanoutVersionReleaseNotifications, sendVersionModerationOwnerNotification } = require("../../utils/versionNotifications");
const { awardFirstApprovedProjectAchievement } = require("../../utils/achievements");
const { bumpProjectCacheVersion } = require("../../utils/projectCache");
const { deleteObject, getPrivateObjectDownloadUrl, normalizeObjectKey, promotePrivateObject } = require("../../utils/fileHosting");
const { normalizeEnum, normalizeSearch, parsePagination } = require("../../utils/queryPagination");
const { normalizeGameVersionBranches } = require("../../utils/gameVersionBranches");
const router = express.Router();
const PROJECT_TYPE_PATH_SEGMENTS = {
	mod: "mod",
	modpack: "modpack",
	world: "world",
	prefab: "prefab",
};

const getProjectPathSegment = (projectType) => PROJECT_TYPE_PATH_SEGMENTS[projectType] || PROJECT_TYPE_PATH_SEGMENTS.mod;

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

const getGlobalOnlineSeriesForPeriod = async (days) => {
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
                WHERE event_at >= toUInt32(toUnixTimestamp(now()) - ({days:UInt32} * 86400))
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
        query_params: { days },
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
		v.quarantine_key,
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
	project_icon_url: version.project_icon_url || "https://modifold.com/images/no-project-icon.svg",
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
	game_versions: normalizeGameVersionBranches(parseMaybeJsonArray(version.game_versions)),
	loaders: parseMaybeJsonArray(version.loaders),
	moderation_status: version.moderation_status,
	moderation_reason: version.moderation_reason,
	argus_report: parseMaybeJsonObject(version.argus_report),
	scan_requested_at: version.scan_requested_at,
	scanned_at: version.scanned_at,
});

const mapVersionReviewWithFileAccess = async (version) => {
	const fileUrl = version.file_url || (version.quarantine_key ? await getPrivateObjectDownloadUrl(version.quarantine_key, {
		expiresInSeconds: 60 * 60,
	}) : null);

	return mapVersionReview({ ...version, file_url: fileUrl });
};

const promoteVersionFile = async (version) => {
	if(!version.quarantine_key) {
		return null;
	}

	const quarantineKey = normalizeObjectKey(version.quarantine_key);
	const expectedPrefix = `quarantine/projects/${version.project_id}/versions/${version.id}/`;
	if(!quarantineKey.startsWith(expectedPrefix)) {
		throw new Error("Invalid version quarantine key");
	}

	const destinationKey = quarantineKey.slice("quarantine/".length);
	const promoted = await promotePrivateObject({
		key: quarantineKey,
		destinationKey,
	});

	return {
		...promoted,
		quarantineKey,
	};
};

const notifyVersionApproved = async ({ version, createdAt }) => {
	const actorId = version.project_owner_user_id;

	try {
		await sendVersionModerationOwnerNotification({
			projectOwnerUserId: version.project_owner_user_id,
			actorUserId: actorId,
			versionId: version.id,
			approved: true,
			createdAt,
		});
	} catch (error) {
		logger.error("Error sending owner version approval notification:", error);
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
	const rawReport = req.body?.report || null;
	const report = normalizeArgusReport(rawReport);
	const notificationFailure = verdict === "error" && /Telegram notification failed/i.test([
		reason,
		typeof rawReport === "string" ? rawReport : null,
		rawReport && typeof rawReport === "object" ? rawReport.error : null,
	].filter(Boolean).join(" "));
	const status = verdict === "error" && !notificationFailure ? "error" : "needs_review";
	const moderationReason = notificationFailure ? "Argus notification failed after scan. Manual review is required." : reason;

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
			WHERE id = ? AND moderation_status IN ('pending', 'scanning')`,
			[status, moderationReason, report, versionId]
		);

		return res.json({ success: true });
	} catch (error) {
		logger.error("Error applying Argus report:", error);
		return res.status(500).json({ message: "Error applying Argus report", error: error.message });
	}
});

router.get("/technical-review", auth, async (req, res) => {
	if(!(await ensureModerator(req, res))) {
		return;
	}

	try {
		const search = normalizeSearch(req.query.search);
		const status = normalizeEnum(req.query.status, ["needs_review", "pending", "scanning", "blocked", "error", "all"], "needs_review", { name: "status", rejectInvalid: true });
		const sort = normalizeEnum(req.query.sort, ["oldest", "newest"], "oldest", { name: "sort option", rejectInvalid: true });
		const { page: pageNumber, limit: limitNumber, offset } = parsePagination(req.query, { defaultLimit: 20, maxLimit: 100 });
		const allowedStatuses = ["needs_review", "pending", "scanning", "blocked", "error", "all"];
		const allowedSort = ["oldest", "newest"];

		if(!allowedStatuses.includes(String(status))) {
			return res.status(400).json({ message: "Invalid status" });
		}

		if(!allowedSort.includes(String(sort))) {
			return res.status(400).json({ message: "Invalid sort option" });
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

		const listQuery = `
			SELECT
			v.id,
			v.project_id,
			v.version_number,
			v.changelog,
			v.release_channel,
			v.file_url,
			v.quarantine_key,
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
			${orderSql}, v.id ${sort === "newest" ? "DESC" : "ASC"}
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
			versions: await Promise.all(versions.map(mapVersionReviewWithFileAccess)),
			totalPages: Math.max(1, Math.ceil(total / limitNumber)),
			currentPage: pageNumber,
			totalVersions: total,
		});
	} catch (error) {
		if(!error.statusCode) {
			logger.error("Error fetching Argus technical review queue:", error);
		}
		
		return res.status(error.statusCode || 500).json({ message: error.statusCode ? error.message : "Error fetching technical review queue" });
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
	let promotion = null;
	let previousModerationStatus = null;

	try {
		const version = await getVersionForModeration(versionId);
		if(!version) {
			return res.status(404).json({ message: "Version not found" });
		}

		const connection = await db.getConnection();
		try {
			await connection.beginTransaction();
			const [lockedVersions] = await connection.query(
				`SELECT moderation_status, file_url, quarantine_key, scanned_at
				FROM project_versions
				WHERE id = ?
				FOR UPDATE`,
				[versionId]
			);
            
			const lockedVersion = lockedVersions[0];
			if(!lockedVersion) {
				const error = new Error("Version not found");
				error.statusCode = 404;
				throw error;
			}

			previousModerationStatus = lockedVersion.moderation_status;

			if(decision === "approved" && previousModerationStatus !== "approved") {
				if(!lockedVersion.file_url && !lockedVersion.quarantine_key) {
					const error = new Error("Version file is unavailable");
					error.statusCode = 409;
					throw error;
				}

				if(previousModerationStatus !== "needs_review" || !lockedVersion.scanned_at) {
					const error = new Error("Version must complete the Argus scan before approval");
					error.statusCode = 409;
					throw error;
				}

				promotion = await promoteVersionFile({ ...version, ...lockedVersion });
			}

			await connection.query(
				`UPDATE project_versions
				SET moderation_status = ?,
				moderation_reason = ?,
				moderated_by = ?,
				moderated_at = NOW(),
				file_url = COALESCE(?, file_url)
				WHERE id = ?`,
				[decision, decision === "blocked" ? reason : null, req.user.id, promotion?.url || null, versionId]
			);

			if(decision === "approved" && previousModerationStatus !== "approved") {
				await connection.query("UPDATE projects SET updated_at = NOW() WHERE id = ?", [version.project_id]);
				await fanoutVersionReleaseNotifications({
					connection,
					actorUserId: version.project_owner_user_id,
					projectId: version.project_id,
					versionId: version.id,
					createdAt,
				});
			}

			await connection.query(
				`INSERT INTO project_moderation_logs
				(project_id, action, moderator_id, reason, created_at)
				VALUES (?, ?, ?, ?, NOW())`,
				[version.project_id, decision === "approved" ? "approved" : "rejected", req.user.id, decision === "blocked" ? reason : "Version approved by technical review"]
			);

			await connection.commit();
		} catch(error) {
			if(promotion) {
				await deleteObject(promotion.key, "public").catch((cleanupError) => {
					logger.warn(`Failed to roll back uncommitted public version file: ${cleanupError.message}`);
				});
				promotion = null;
			}

			await connection.rollback();
			throw error;
		} finally {
			connection.release();
		}

		if(promotion) {
			try {
				await deleteObject(promotion.quarantineKey, "private");
				await db.query(
					"UPDATE project_versions SET quarantine_key = NULL WHERE id = ? AND quarantine_key = ?",
					[versionId, promotion.quarantineKey]
				);
			} catch (cleanupError) {
				logger.warn(`Failed to remove promoted quarantine file: ${cleanupError.message}`);
			}
		}

		if(decision === "approved" && previousModerationStatus !== "approved") {
			await bumpProjectCacheVersion(version.project_slug).catch((error) => {
				logger.warn(`Failed to bump project cache after approving version: ${error.message}`);
			});
		}

		if(decision === "approved") {
			await notifyVersionApproved({ version, createdAt });
		} else {
			await sendVersionModerationOwnerNotification({
				projectOwnerUserId: version.project_owner_user_id,
				actorUserId: version.project_owner_user_id,
				versionId: version.id,
				approved: false,
				createdAt,
			});
		}

		return res.json({ success: true });
	} catch (error) {
		logger.error("Error applying technical review decision:", error);
		return res.status(error.statusCode || 500).json({ message: error.message || "Error applying technical review decision" });
	}
});

router.get("/", auth, async (req, res) => {
    if(!(await ensureModerator(req, res))) {
        return;
    }

    try {
		const search = normalizeSearch(req.query.search);
		const type = req.query.type;
		const sort = normalizeEnum(req.query.sort, ["oldest", "newest"], "oldest", { name: "sort option", rejectInvalid: true });
		const { page, limit, offset } = parsePagination(req.query, { defaultLimit: 20, maxLimit: 50 });
        const typeMap = {
            mods: "mod",
            mod: "mod",
            modpacks: "modpack",
            modpack: "modpack",
            worlds: "world",
            world: "world",
			prefabs: "prefab",
			prefab: "prefab",
        };

        const normalizedType = type ? typeMap[type.toLowerCase()] : undefined;

        if(type && !normalizedType) {
            return res.status(400).json({ message: "Invalid project type" });
        }

        let query = `
            SELECT id, slug, title, summary, project_type, status, visibility, created_at, icon_url, tags
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

		query += sort === "newest" ? " ORDER BY created_at DESC, id DESC" : " ORDER BY created_at ASC, id ASC";

        query += " LIMIT ? OFFSET ?";
        params.push(Number(limit), Number(offset));

        const [projects] = await db.query(query, params);
        const [[{ total }]] = await db.query(countQuery, countParams);

        res.json({
            projects: projects.map((project) => ({
                ...project,
                icon_url: project.icon_url || "https://modifold.com/images/no-project-icon.svg",
            })),
            totalPages: Math.ceil(total / limit),
            currentPage: Number(page),
            totalProjects: total,
        });
    } catch (error) {
		if(!error.statusCode) {
			logger.error("Error fetching projects for moderation:", error);
		}

		res.status(error.statusCode || 500).json({ message: error.statusCode ? error.message : "Error fetching projects", error: error.statusCode ? undefined : error.message });
    }
});

router.post("/:id/moderate", auth, async (req, res) => {
    if(!(await ensureModerator(req, res))) {
        return;
    }

    const { id } = req.params;
    const { status, reason, sendDiscordNotification } = req.body;
    const moderatorId = req.user.id;

    if(!["approved", "rejected"].includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
    }

    try {
		const [[projectStatusBeforeUpdate]] = await db.query("SELECT status, visibility FROM projects WHERE id = ? LIMIT 1", [id]);
		const shouldSendPublishedModNotification = status === "approved" && sendDiscordNotification === true && projectStatusBeforeUpdate?.status !== "approved" && projectStatusBeforeUpdate?.visibility !== "unlisted";

        await db.query("UPDATE projects SET status = ? WHERE id = ?", [status, id]);

        await db.query(
            "INSERT INTO project_moderation_logs (project_id, action, moderator_id, reason, created_at) VALUES (?, ?, ?, ?, NOW())",
            [id, status, moderatorId, reason ? sanitizePlainText(reason, { preserveNewlines: true }) : null]
        );

        if(status === "approved") {
            try {
                const [projectRows] = await db.query(
					`SELECT p.id, p.user_id, p.slug, p.title, p.summary, p.icon_url, p.project_type, u.username
                    FROM projects p
                    LEFT JOIN users u ON p.user_id = u.id
                    WHERE p.id = ?
                    LIMIT 1`,
                    [id]
                );

                const project = projectRows[0];

                if(!project) {
                    logger.warn(`Project ${id} not found after approval, skipping published-mod notification`);
                } else {
					await awardFirstApprovedProjectAchievement(db, {
						projectId: project.id,
						userId: project.user_id,
						awardedByUserId: moderatorId,
					});

					if(shouldSendPublishedModNotification) {
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
								iconLink: project.icon_url || "https://modifold.com/images/no-project-icon.svg",
								modLink: `https://modifold.com/${getProjectPathSegment(project.project_type)}/${project.slug}`,
								developerName: project.username || "Unknown",
							}),
						});
					}
                }
            } catch (publishError) {
                logger.error("Error sending published-mod notification:", publishError);
            }
        }

        res.json({ success: true });
    } catch (error) {
        logger.error("Error moderating project:", error);
        res.status(500).json({ message: "Error moderating project", error: error.message });
    }
});

router.get("/analytics", auth, async (req, res) => {
    if(!(await ensureModerator(req, res))) {
        return;
    }

    try {
		const timeRange = normalizeEnum(req.query.time_range, ["7d", "30d", "90d", "1y"], "30d", { name: "time_range", rejectInvalid: true });
		const days = { "7d": 7, "30d": 30, "90d": 90, "1y": 365 }[timeRange];
		const endDate = new Date();
		endDate.setUTCHours(0, 0, 0, 0);
		endDate.setUTCDate(endDate.getUTCDate() + 1);
		const startDate = new Date(endDate);
		startDate.setUTCDate(startDate.getUTCDate() - days);
		const previousStartDate = new Date(startDate);
		previousStartDate.setUTCDate(previousStartDate.getUTCDate() - days);
		const from = startDate.toISOString().slice(0, 10);
		const previousFrom = previousStartDate.toISOString().slice(0, 10);
		const toExclusive = endDate.toISOString().slice(0, 10);
		const dateFilter = "created_at >= ? AND created_at < ?";
		const params = [from, toExclusive];
		const activityParams = [previousFrom, toExclusive];

		const buildActivity = (rows) => {
			const counts = new Map(rows.map((row) => [String(row.date), toSafeNumber(row.count)]));
			const series = [];
			let current = 0;
			let previous = 0;

			for(const date = new Date(previousStartDate); date < endDate; date.setUTCDate(date.getUTCDate() + 1)) {
				const key = date.toISOString().slice(0, 10);
				const count = counts.get(key) || 0;
				if(date < startDate) {
					previous += count;
				} else {
					current += count;
					series.push({ date: key, count });
				}
			}

			return { current, previous, series };
		};

        const approvedWhereSql = [dateFilter, "status = 'approved'"].filter(Boolean).join(" AND ");
        const pendingWhereSql = [dateFilter, "status IN ('queued', 'pending')"].filter(Boolean).join(" AND ");
        const approvedProjectsQuery = `
            SELECT DATE_FORMAT(created_at, '%Y-%m-%d') AS date, COUNT(*) AS count
            FROM projects
            ${approvedWhereSql ? `WHERE ${approvedWhereSql}` : ""}
            GROUP BY DATE_FORMAT(created_at, '%Y-%m-%d')
            ORDER BY date
        `;

        const pendingProjectsQuery = `
            SELECT DATE_FORMAT(created_at, '%Y-%m-%d') AS date, COUNT(*) AS count
            FROM projects
            ${pendingWhereSql ? `WHERE ${pendingWhereSql}` : ""}
            GROUP BY DATE_FORMAT(created_at, '%Y-%m-%d')
            ORDER BY date
        `;

        const totalApprovedQuery = `
            SELECT COUNT(*) AS total
            FROM projects
            WHERE status = 'approved'
        `;
        
        const userRegistrationsQuery = `
            SELECT DATE_FORMAT(FROM_UNIXTIME(created_at / 1000), '%Y-%m-%d') AS date, COUNT(*) AS count
            FROM users
            WHERE created_at >= ? AND created_at < ?
            GROUP BY DATE_FORMAT(FROM_UNIXTIME(created_at / 1000), '%Y-%m-%d')
            ORDER BY date
        `;

		const publishedVersionsQuery = `
			SELECT DATE_FORMAT(v.created_at, '%Y-%m-%d') AS date, COUNT(*) AS count
			FROM project_versions v
			JOIN projects p ON p.id = v.project_id
			WHERE v.created_at >= ? AND v.created_at < ?
			AND v.moderation_status = 'approved' AND p.status = 'approved'
			GROUP BY DATE_FORMAT(v.created_at, '%Y-%m-%d')
			ORDER BY date
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
        
		const [[approvedProjects], [pendingProjects], [userRegistrations], [publishedVersions]] = await Promise.all([
			db.query(approvedProjectsQuery, activityParams),
			db.query(pendingProjectsQuery, params),
			db.query(userRegistrationsQuery, [previousStartDate.getTime(), endDate.getTime()]),
			db.query(publishedVersionsQuery, activityParams),
		]);
		const projectActivity = buildActivity(approvedProjects);
		const userActivity = buildActivity(userRegistrations);
		const versionActivity = buildActivity(publishedVersions);
		let downloadActivity = null;
		let downloadCountries = null;
		let downloadProjects = null;
		let onlineAvailable = Boolean(clickhouse);

		if(clickhouse) {
			const getDownloadRows = async (selection, grouping, start) => {
				const result = await clickhouse.query({
					query: `
						SELECT ${selection},
						countIf(event_id IS NULL) + uniqExactIf(event_id, event_id IS NOT NULL) AS count
						FROM project_events
						WHERE event_type = 'download'
						AND created_at >= toDateTime({from:String}, 'UTC')
						AND created_at < toDateTime({to:String}, 'UTC')
						GROUP BY ${grouping}
					`,
					query_params: { from: start, to: toExclusive },
					format: "JSONEachRow",
				});

				return result.json();
			};
			const [dailyResult, countriesResult, projectsResult] = await Promise.allSettled([
				getDownloadRows("toDate(created_at, 'UTC') AS date", "date ORDER BY date", previousFrom),
				getDownloadRows(`
					if(match(lower(ifNull(country_code, '')), '^[a-z]{2}$') AND lower(ifNull(country_code, '')) NOT IN ('xx', 'zz'),
						lower(ifNull(country_code, '')), '') AS country
				`, "country ORDER BY count DESC, country ASC", from),
				getDownloadRows("project_slug", "project_slug ORDER BY count DESC, project_slug ASC", from),
			]);

			if(dailyResult.status === "fulfilled") {
				downloadActivity = buildActivity(dailyResult.value);
			} else {
				logger.error("Error fetching global download analytics:", dailyResult.reason);
			}

			if(countriesResult.status === "fulfilled") {
				downloadCountries = countriesResult.value.map((row) => ({
					country_code: String(row.country || ""),
					count: toSafeNumber(row.count),
				}));
			} else {
				logger.error("Error fetching global download countries:", countriesResult.reason);
			}

			if(projectsResult.status === "fulfilled") {
				try {
					const slugs = projectsResult.value.map((row) => String(row.project_slug || "")).filter(Boolean);
					const [projects] = slugs.length ? await db.query(
						"SELECT slug, title, icon_url, project_type FROM projects WHERE slug IN (?)",
						[slugs]
					) : [[]];
					const projectsBySlug = new Map(projects.map((project) => [project.slug, project]));

					downloadProjects = projectsResult.value.map((row) => {
						const slug = String(row.project_slug || "");
						const project = projectsBySlug.get(slug);

						return {
							slug,
							title: project?.title || slug,
							icon_url: project?.icon_url || null,
							project_type: project?.project_type || null,
							available: Boolean(project),
							count: toSafeNumber(row.count),
						};
					});
				} catch(error) {
					logger.error("Error resolving download analytics projects:", error);
				}
			} else {
				logger.error("Error fetching global download projects:", projectsResult.reason);
			}
		}
        const [[{ total: totalApproved }]] = await db.query(totalApprovedQuery);
        const [[{ total: totalPending }]] = await db.query(totalPendingQuery);
        const [[{ total: totalUsers }]] = await db.query(totalUsersQuery);
        const [[{ total: totalProjectVersions }]] = await db.query(totalProjectVersionsQuery);
		const [[{ total: totalPublishedVersions }]] = await db.query(`
			SELECT COUNT(*) AS total FROM project_versions v
			JOIN projects p ON p.id = v.project_id
			WHERE v.moderation_status = 'approved' AND p.status = 'approved'
		`);
        const [[{ total: totalProjectDownloads }]] = await db.query(totalProjectDownloadsQuery);
        const [[{ total: totalUnpublishedProjects }]] = await db.query(totalUnpublishedProjectsQuery);
        let onlineSummary = { playersOnlineNow: 0, activeServersNow: 0 };
        let globalOnlineSeries = [];

        try {
            [onlineSummary, globalOnlineSeries] = await Promise.all([
                getGlobalOnlineNow(),
                getGlobalOnlineSeriesForPeriod(days),
            ]);
        } catch (analyticsError) {
			onlineAvailable = false;
            logger.error("Error fetching global online analytics:", analyticsError);
        }

        res.json({
			timeRange,
			activity: {
				users: { current: userActivity.current, previous: userActivity.previous },
				projects: { current: projectActivity.current, previous: projectActivity.previous },
				versions: { current: versionActivity.current, previous: versionActivity.previous },
				downloads: downloadActivity ? { current: downloadActivity.current, previous: downloadActivity.previous } : null,
			},
			approvedProjects: projectActivity.series,
            pendingProjects: pendingProjects.map(row => ({
                date: row.date,
                count: row.count
            })),
			userRegistrations: userActivity.series,
			projectDownloads: downloadActivity?.series || [],
			downloadCountries,
			downloadProjects,
			downloadsAvailable: Boolean(downloadActivity),
            totalApproved,
            totalPending,
            totalUsers,
            totalProjectVersions,
			totalPublishedVersions,
            totalProjectDownloads,
            totalUnpublishedProjects,
            totalPlayersOnlineNow: onlineSummary.playersOnlineNow,
            totalActiveServersNow: onlineSummary.activeServersNow,
            onlineSummary,
            globalOnlineSeries,
			onlineAvailable,
        });
    } catch (error) {
        logger.error("Error fetching moderation analytics:", error);
		res.status(error.statusCode || 500).json({ message: error.statusCode ? error.message : "Error fetching analytics" });
    }
});

router.get("/reports", auth, async (req, res) => {
    if(!(await ensureModerator(req, res))) {
        return;
    }

    try {
		const search = normalizeSearch(req.query.search);
		const status = normalizeEnum(req.query.status, ["open", "resolved", "dismissed", "all"], "open", { name: "report status", rejectInvalid: true });
		const reason = normalizeSearch(req.query.reason, { maxLength: 64 }) || "all";
		const sort = normalizeEnum(req.query.sort, ["newest", "oldest"], "newest", { name: "sort option", rejectInvalid: true });
		const { page: pageNumber, limit: limitNumber, offset } = parsePagination(req.query, { defaultLimit: 20, maxLimit: 100 });

        const allowedStatuses = ["open", "resolved", "dismissed", "all"];
        const allowedSort = ["newest", "oldest"];

        if(!allowedStatuses.includes(String(status))) {
            return res.status(400).json({ message: "Invalid report status" });
        }

        if(!allowedSort.includes(String(sort))) {
            return res.status(400).json({ message: "Invalid sort option" });
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
		const orderSql = sort === "oldest" ? "ORDER BY pr.created_at ASC, pr.id ASC" : "ORDER BY pr.created_at DESC, pr.id DESC";

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
		if(!error.statusCode) {
			logger.error("Error fetching reports for moderation:", error);
		}

		return res.status(error.statusCode || 500).json({ message: error.statusCode ? error.message : "Error fetching reports" });
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
        logger.error("Error updating report decision:", error);
        return res.status(500).json({ message: "Error updating report" });
    }
});

module.exports = router;