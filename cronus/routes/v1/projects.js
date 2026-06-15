require("dotenv").config();

const express = require('express');
const { db } = require('../../config/db');
const { clickhouse, hasClickHouseConfig } = require('../../config/clickhouse');
const auth = require('../../middleware/auth');
const multer = require('multer');
const fs = require('fs').promises;
const path = require('path');
const slugify = require('slugify');
const crypto = require('crypto');
const sharp = require('sharp');
const { sanitizeExternalUrl, sanitizeMarkdownText, sanitizePlainText } = require('../../utils/sanitize');
const { validateSlug } = require("../../utils/slug");
const { ORG_PERMISSIONS, ORG_PROJECT_PERMISSIONS, parsePermissions, resolveProjectAccess, getOrganizationMemberAccess, hasProjectPermission, hasOrganizationPermission, logOrganizationAudit } = require('../../utils/organizations');
const optionalAuth = require('../../middleware/optionalAuth');
const { getCacheJson, setCacheJson, deleteCacheByPattern } = require("../../utils/cache");
const { getProjectCacheVersion, bumpProjectCacheVersion, bumpProjectCacheVersionById, shouldSkipProjectCacheBump } = require("../../utils/projectCache");
const { fanoutVersionReleaseNotifications } = require("../../utils/versionNotifications");
const { notifyArgusAboutVersion } = require("../../utils/argus");
const router = express.Router();

const parseJsonArrayField = (value) => {
    if(Array.isArray(value)) {
        return value;
    }

    if(typeof value !== "string") {
        return [];
    }

    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
};

const normalizeVersionArray = (value) => {
    return [...new Set(parseJsonArrayField(value).map((item) => String(item || "").trim()).filter(Boolean))];
};

const getYouTubeVideoId = (value) => {
    if(typeof value !== "string") {
        return null;
    }

    const trimmedValue = value.trim();
    if(!trimmedValue) {
        return null;
    }

    if(/^[a-zA-Z0-9_-]{11}$/.test(trimmedValue)) {
        return trimmedValue;
    }

    let parsedUrl;
    try {
        parsedUrl = new URL(trimmedValue);
    } catch {
        return null;
    }

    const hostname = parsedUrl.hostname.replace(/^www\./i, "").toLowerCase();
    if(hostname === "youtu.be") {
        const videoId = parsedUrl.pathname.split("/").filter(Boolean)[0] || "";
        return /^[a-zA-Z0-9_-]{11}$/.test(videoId) ? videoId : null;
    }

    if(hostname === "youtube.com" || hostname === "m.youtube.com" || hostname === "music.youtube.com") {
        if(parsedUrl.pathname === "/watch") {
            const videoId = parsedUrl.searchParams.get("v") || "";
            return /^[a-zA-Z0-9_-]{11}$/.test(videoId) ? videoId : null;
        }

        const pathParts = parsedUrl.pathname.split("/").filter(Boolean);
        if(["embed", "shorts", "live"].includes(pathParts[0])) {
            const videoId = pathParts[1] || "";
            return /^[a-zA-Z0-9_-]{11}$/.test(videoId) ? videoId : null;
        }
    }

    return null;
};

const normalizeYouTubeTrailer = (value) => {
    const videoId = getYouTubeVideoId(value);
    if(!videoId) {
        return null;
    }

    return {
        videoId,
        url: `https://www.youtube.com/watch?v=${videoId}`,
    };
};

const validateGameVersions = async (versions) => {
    if(!Array.isArray(versions) || versions.length === 0) {
        return false;
    }

    const [rows] = await db.query(
        "SELECT version FROM game_versions WHERE is_active = 1 AND version IN (?)",
        [versions]
    );

    const validVersions = new Set(rows.map((row) => row.version));
    return versions.every((version) => validVersions.has(version));
};

const extractIpAddress = (value) => {
    if(Array.isArray(value)) {
        for(const entry of value) {
            const extracted = extractIpAddress(entry);
            if(extracted) {
                return extracted;
            }
        }

        return null;
    }

    if(typeof value !== "string") {
        return null;
    }

    const firstValue = value.split(",")[0]?.trim();
    if(!firstValue || firstValue.toLowerCase() === "unknown") {
        return null;
    }

    const withoutMappedIpv4Prefix = firstValue.replace(/^::ffff:/i, "");
    return withoutMappedIpv4Prefix || null;
};

const getRequestIpAddress = (req) => {
    const ipCandidates = [
        req.headers["cf-connecting-ip"],
        req.headers["true-client-ip"],
        req.headers["x-real-ip"],
        req.headers["x-client-ip"],
        req.headers["fastly-client-ip"],
        req.headers["x-forwarded-for"],
        req.ip,
        req.socket?.remoteAddress,
    ];

    for(const candidate of ipCandidates) {
        const ipAddress = extractIpAddress(candidate);
        if(ipAddress) {
            return ipAddress;
        }
    }

    return null;
};

const getRequestCountryCode = (req) => {
    const geoHeaders = [
        req.headers["cf-ipcountry"],
        req.headers["cloudfront-viewer-country"],
        req.headers["x-vercel-ip-country"],
        req.headers["x-country-code"],
        req.headers["x-geo-country"],
    ];

    for(const headerValue of geoHeaders) {
        const countryCode = Array.isArray(headerValue) ? headerValue[0] : headerValue;
        if(typeof countryCode !== "string") {
            continue;
        }

        const normalizedCountryCode = countryCode.trim().toLowerCase();
        if(/^[a-z]{2}$/.test(normalizedCountryCode)) {
            return normalizedCountryCode;
        }
    }

    const acceptLanguage = req.headers["accept-language"];
    if(typeof acceptLanguage !== "string" || !acceptLanguage.trim()) {
        return null;
    }

    const primaryTag = acceptLanguage.split(",")[0]?.split(";")[0]?.trim();
    if(!primaryTag) {
        return null;
    }

    const normalizedPrimaryTag = primaryTag.replace(/_/g, "-").toLowerCase();
    const region = normalizedPrimaryTag.split("-")[1]?.trim();
    if(/^[a-z]{2}$/.test(region || "")) {
        return region;
    }

    const language = normalizedPrimaryTag.split("-")[0]?.trim();
    return /^[a-z]{2}$/.test(language || "") ? language : null;
};

const assertClickHouseConfigured = () => {
    if(!hasClickHouseConfig || !clickhouse) {
        throw new Error("ClickHouse is not configured");
    }
};

const insertProjectEvent = async ({ projectSlug, versionId = null, eventType, ipAddress = null, countryCode = null }) => {
    assertClickHouseConfigured();

    await clickhouse.insert({
        table: "project_events",
        values: [{
            project_slug: projectSlug,
            version_id: versionId,
            event_type: eventType,
            ip_address: ipAddress,
            country_code: countryCode,
        }],
        format: "JSONEachRow",
    });
};

const hasRecentProjectEvent = async ({ projectSlug, eventType, ipAddress, windowMinutes }) => {
    assertClickHouseConfigured();

    const resultSet = await clickhouse.query({
        query: `
            SELECT 1 AS has_recent
            FROM project_events
            WHERE project_slug = {project_slug:String}
            AND event_type = {event_type:String}
            AND ip_address = {ip_address:String}
            AND created_at >= now() - toIntervalMinute({window_minutes:UInt32})
            LIMIT 1
        `,
        query_params: {
            project_slug: projectSlug,
            event_type: eventType,
            ip_address: ipAddress,
            window_minutes: windowMinutes,
        },
        format: "JSONEachRow",
    });

    const rows = await resultSet.json();
    return rows.length > 0;
};

const getProjectEventRows = async ({ projectSlugs, timeRange }) => {
    assertClickHouseConfigured();

    if(!projectSlugs.length) {
        return [];
    }

    const escapedSlugs = projectSlugs.map((slug) => `'${String(slug).replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`).join(", ");

    let intervalClause = "INTERVAL 30 DAY";
    if(timeRange === "3d") {
        intervalClause = "INTERVAL 3 DAY";
    } else if(timeRange === "7d") {
        intervalClause = "INTERVAL 7 DAY";
    } else if(timeRange === "1y") {
        intervalClause = "INTERVAL 1 YEAR";
    }

    const resultSet = await clickhouse.query({
        query: `
            SELECT
            project_slug,
            toDate(created_at) AS date,
            event_type,
            count() AS count
            FROM project_events
            WHERE project_slug IN (${escapedSlugs})
            AND created_at >= now() - ${intervalClause}
            GROUP BY project_slug, event_type, date
            ORDER BY project_slug ASC, date ASC
        `,
        format: "JSONEachRow",
    });

    return await resultSet.json();
};

const PROJECT_ANALYTICS_TIME_RANGES = {
    "3d": { days: 3 },
    "7d": { days: 7 },
    "30d": { days: 30 },
    "90d": { days: 90 },
};

const getProjectAnalyticsTimeRange = (timeRange) => PROJECT_ANALYTICS_TIME_RANGES[timeRange] ? timeRange : "7d";

const formatUtcDate = (date) => {
    const year = date.getUTCFullYear();
    const month = `${date.getUTCMonth() + 1}`.padStart(2, "0");
    const day = `${date.getUTCDate()}`.padStart(2, "0");
    return `${year}-${month}-${day}`;
};

const buildEmptyDailySeries = (days) => {
    const endDate = new Date();
    endDate.setUTCHours(0, 0, 0, 0);

    const points = [];
    for(let index = days - 1; index >= 0; index -= 1) {
        const pointDate = new Date(endDate);
        pointDate.setUTCDate(endDate.getUTCDate() - index);
        points.push({
            date: formatUtcDate(pointDate),
            count: 0,
        });
    }

    return points;
};

const getProjectEventSeries = async ({ projectSlug, eventType, days }) => {
    assertClickHouseConfigured();

    const resultSet = await clickhouse.query({
        query: `
            SELECT
            toDate(created_at) AS date,
            count() AS count
            FROM project_events
            WHERE project_slug = {project_slug:String}
            AND event_type = {event_type:String}
            AND created_at >= now() - toIntervalDay({interval_days:UInt32})
            GROUP BY date
            ORDER BY date ASC
        `,
        query_params: {
            project_slug: projectSlug,
            event_type: eventType,
            interval_days: days,
        },
        format: "JSONEachRow",
    });

    const rows = await resultSet.json();
    const countsByDate = new Map(rows.map((row) => [String(row.date), Number(row.count) || 0]));

    return buildEmptyDailySeries(days).map((point) => ({
        ...point,
        count: countsByDate.get(point.date) || 0,
    }));
};

const getProjectDownloadCountries = async ({ projectSlug, days }) => {
    assertClickHouseConfigured();

    const resultSet = await clickhouse.query({
        query: `
            SELECT
            lower(country_code) AS country_code,
            count() AS count
            FROM project_events
            WHERE project_slug = {project_slug:String}
            AND event_type = 'download'
            AND created_at >= now() - toIntervalDay({interval_days:UInt32})
            AND country_code IS NOT NULL
            AND country_code != ''
            GROUP BY country_code
            ORDER BY count DESC, country_code ASC
            LIMIT 50
        `,
        query_params: {
            project_slug: projectSlug,
            interval_days: days,
        },
        format: "JSONEachRow",
    });

    const rows = await resultSet.json();

    return rows.map((row) => ({
        country_code: String(row.country_code || "").toLowerCase(),
        count: Number(row.count) || 0,
    })).filter((row) => /^[a-z]{2}$/.test(row.country_code));
};

const getProjectPlayersInLastDaysBySlug = async ({ projectSlugs, days }) => {
    const normalizedProjectSlugs = Array.isArray(projectSlugs) ? [...new Set(projectSlugs.map((slug) => String(slug || "").trim()).filter(Boolean))].sort() : [];
    const safeDays = Math.max(1, Number.parseInt(String(days || 14), 10) || 14);
    const countsBySlug = new Map(normalizedProjectSlugs.map((slug) => [slug, 0]));

    if(!normalizedProjectSlugs.length || !hasClickHouseConfig || !clickhouse) {
        return countsBySlug;
    }

    const playersCacheKeySeed = `v3_unique_server:${safeDays}:${normalizedProjectSlugs.join(",")}`;
    const playersCacheHash = crypto.createHash("sha1").update(playersCacheKeySeed).digest("hex");
    const playersCacheKey = `modifold_project_players_period_${playersCacheHash}`;
    const cachedPlayersBySlug = await getCacheJson(playersCacheKey);
    if(cachedPlayersBySlug && typeof cachedPlayersBySlug === "object") {
        for(const slug of normalizedProjectSlugs) {
            countsBySlug.set(slug, Math.max(0, Number(cachedPlayersBySlug[slug]) || 0));
        }

        return countsBySlug;
    }

    const escapedSlugs = normalizedProjectSlugs.map((slug) => `'${slug.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`).join(", ");

    try {
        const resultSet = await clickhouse.query({
            query: `
                SELECT
                project_slug,
                count() AS count
                FROM (
                    SELECT
                    project_slug,
                    server_uuid,
                    max(players_online) AS max_players
                    FROM mod_server_updates
                    WHERE project_slug IN (${escapedSlugs})
                    AND event_at >= toUInt32(toUnixTimestamp(now()) - ({interval_days:UInt32} * 86400))
                    AND event_at <= now()
                    GROUP BY project_slug, server_uuid
                    HAVING max_players > 0
                )
                GROUP BY project_slug
            `,
            query_params: {
                interval_days: safeDays,
            },
            format: "JSONEachRow",
        });

        const rows = await resultSet.json();
        for(const row of rows) {
            const slug = String(row.project_slug || "").trim();
            if(!slug) {
                continue;
            }

            countsBySlug.set(slug, Math.max(0, Number(row.count) || 0));
        }

        await setCacheJson(playersCacheKey, Object.fromEntries(countsBySlug.entries()), 60 * 5);
    } catch (error) {
        console.warn("Failed to fetch project players for period:", error.message);
    }

    return countsBySlug;
};

router.param("slug", async (req, res, next, identifier) => {
	try {
		const [projects] = await db.query(
			`SELECT id, slug
			FROM projects
			WHERE BINARY id = BINARY ? OR slug = ?
			ORDER BY (BINARY id = BINARY ?) DESC
			LIMIT 1`,
			[identifier, identifier, identifier]
		);

		if(projects.length) {
			req.params.slug = projects[0].slug;
			req.projectIdentifier = {
				id: projects[0].id,
				slug: projects[0].slug,
				requested: identifier,
			};
		}

		next();
	} catch(error) {
		console.error("Error resolving project identifier:", error);
		res.status(500).json({ message: "Error resolving project identifier", error: error.message });
	}
});

router.use("/:slug*", (req, res, next) => {
    const { slug } = req.params || {};
    const method = (req.method || "").toUpperCase();
    const isMutation = method && !["GET", "HEAD", "OPTIONS"].includes(method);

    if(!isMutation || !slug) {
        return next();
    }

    if(shouldSkipProjectCacheBump(req)) {
        return next();
    }

    res.on("finish", () => {
        if(res.statusCode < 400) {
            bumpProjectCacheVersion(slug).catch((error) => {
                console.warn("Failed to bump project cache version:", slug, error.message);
            });
        }
    });

    next();
});

const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
        let destination;

        try {
            if(req.params.slug) {
                const [project] = await db.query("SELECT id FROM projects WHERE slug = ?", [req.params.slug]);
                if(!project.length) {
                    return cb(new Error("Project not found"));
                }

                destination = path.join(process.env.MEDIA_ROOT, "projects", project[0].id);
            } else if(req.params.id) {
                const [project] = await db.query("SELECT id FROM projects WHERE id = ?", [req.params.id]);
                if(!project.length) {
                    return cb(new Error("Project not found"));
                }

                destination = path.join(process.env.MEDIA_ROOT, "projects", project[0].id);
            } else {
                destination = path.join(process.env.MEDIA_ROOT, "temp");
            }

            await fs.mkdir(destination, { recursive: true });
            cb(null, destination);
        } catch (error) {
            cb(error);
        }
    },
    filename: (req, file, cb) => {
        cb(null, buildSafeUploadFilename(file.originalname));
    },
});

const sanitizeUploadFilenameStem = (value) => {
    const normalized = String(value || "").replace(/[\u0000-\u001f\u007f]/g, "").replace(/%[0-9a-f]{2}/gi, "").replace(/\.+/g, ".").replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/^[_\-.]+|[_\-.]+$/g, "");

    return normalized || "file";
};

const buildSafeUploadFilename = (originalname) => {
    const parsed = path.parse(path.basename(String(originalname || "")));
    const safeBaseName = sanitizeUploadFilenameStem(parsed.name);
    const safeExtension = sanitizeUploadFilenameStem(parsed.ext.replace(/^\./, "")).toLowerCase();
    const uniqueSuffix = crypto.randomBytes(4).toString("hex");

    return safeExtension ? `${safeBaseName}_${uniqueSuffix}.${safeExtension}` : `${safeBaseName}_${uniqueSuffix}`;
};

const fileFilter = (req, file, cb) => {
    const allowedTypes = [
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
        'application/java-archive',
        'application/x-java-archive',
        'application/zip',
        'application/x-zip-compressed',
        'application/x-rar-compressed',
        'application/x-modrinth-modpack+zip'
    ].map(type => type.toLowerCase());

    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.jar', '.zip', '.rar'];

    const ext = path.extname(path.basename(String(file.originalname || ""))).toLowerCase();

    if(allowedTypes.includes(file.mimetype.toLowerCase()) || (file.mimetype.toLowerCase() === 'application/octet-stream' && allowedExtensions.includes(ext))) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type. Allowed: JPEG, PNG, GIF, WebP, JAR.'), false);
    }
};

const upload = multer({
    storage,
    limits: { fileSize: 100 * 1024 * 1024 },
    fileFilter,
});

const convertImageToWebp = async (file) => {
    if(!file) {
        return file;
    }

    const mimeType = (file.mimetype || '').toLowerCase();
    const ext = path.extname(path.basename(String(file.originalname || file.filename || ""))).toLowerCase();
    const isOctetStream = mimeType === "application/octet-stream";
    const isImageByMime = mimeType.startsWith("image/");
    const isImageByExt = [".jpg", ".jpeg", ".png", ".webp"].includes(ext);

    if(isImageByMime && mimeType === "image/gif") {
        return file;
    }

    if(!isImageByMime && !(isOctetStream && isImageByExt)) {
        return file;
    }

    if(mimeType === "image/webp" || (isOctetStream && ext === ".webp")) {
        return {
            ...file,
            mimetype: "image/webp",
        };
    }

    const fileNameWithoutExt = path.parse(file.filename).name;
    const webpFilename = `${fileNameWithoutExt}.webp`;
    const webpPath = path.join(path.dirname(file.path), webpFilename);

    await sharp(file.path).rotate().webp({ quality: 82, effort: 4 }).toFile(webpPath);
    if(webpPath !== file.path) {
        await fs.unlink(file.path);
    }

    return {
        ...file,
        filename: webpFilename,
        path: webpPath,
        mimetype: 'image/webp',
    };
};

const rgbToInt = (r, g, b) => ((r & 255) << 16) + ((g & 255) << 8) + (b & 255);

const extractDominantColorInt = async (filePath) => {
    const { data, info } = await sharp(filePath).rotate().resize(1, 1, { fit: "cover" }).removeAlpha().raw().toBuffer({ resolveWithObject: true });

    if(!data || data.length < 3 || !info || info.channels < 3) {
        return null;
    }

    return rgbToInt(data[0], data[1], data[2]);
};

const generateId = () => crypto.randomBytes(4).toString('base64url');

const normalizeComment = (text) => text.trim().replace(/\s+/g, " ").toLowerCase();

const getUserRole = async (userId) => {
    if(!userId) {
        return null;
    }

    const [users] = await db.query("SELECT isRole FROM users WHERE id = ? LIMIT 1", [userId]);
    return users[0]?.isRole || null;
};

const getProjectBySlug = async (slug) => {
    const [rows] = await db.query("SELECT id, user_id, slug FROM projects WHERE slug = ? LIMIT 1", [slug]);
    return rows[0] || null;
};

const getProjectById = async (projectId) => {
    const [rows] = await db.query("SELECT id, user_id, slug FROM projects WHERE id = ? LIMIT 1", [projectId]);
    return rows[0] || null;
};

const VISIBLE_VERSION_STATUSES = ["approved"];
const PRIVATE_VERSION_STATUSES = ["pending", "scanning", "needs_review", "blocked", "error"];

const canViewPrivateProjectVersions = async (project, userId) => {
	if(!project || !userId) {
		return false;
	}

	const role = await getUserRole(userId);
	if(role === "admin" || role === "moderator") {
		return true;
	}

	const access = await resolveProjectAccess(db, project.id, userId);
	return Boolean(access?.isOwner || hasProjectPermission(access, ORG_PROJECT_PERMISSIONS.MANAGE_VERSIONS));
};

const buildVisibleVersionWhereClause = async (project, userId) => {
	if(await canViewPrivateProjectVersions(project, userId)) {
		return {
			sql: "v.moderation_status IN (?, ?, ?, ?, ?, ?)",
			params: [...VISIBLE_VERSION_STATUSES, ...PRIVATE_VERSION_STATUSES],
		};
	}

	return {
		sql: "v.moderation_status = ?",
		params: VISIBLE_VERSION_STATUSES,
	};
};

const sanitizeVersionForPublicResponse = (version, { includeModeration = false } = {}) => {
	const { argus_report, moderated_by, moderated_at, scan_requested_at, scanned_at, moderation_status, moderation_reason, ...safeVersion } = version || {};

	if(includeModeration) {
		return {
			...safeVersion,
			moderation_status,
			moderation_reason,
		};
	}

	return safeVersion;
};

const queueArgusScan = ({ versionId, project, fileUrl, fileName, fileSize }) => {
	notifyArgusAboutVersion({
		versionId,
		projectId: project.id,
		projectSlug: project.slug,
		fileUrl,
		fileName,
		fileSize,
	}).then(async (result) => {
		if(result.queued) {
			await db.query("UPDATE project_versions SET moderation_status = 'scanning', scan_requested_at = NOW() WHERE id = ? AND moderation_status = 'pending'", [versionId]);
			return;
		}

		if(result.mockClean) {
			await db.query(
				`UPDATE project_versions
				SET moderation_status = 'needs_review',
				moderation_reason = ?,
				argus_report = ?,
				scan_requested_at = NOW(),
				scanned_at = NOW()
				WHERE id = ? AND moderation_status IN ('pending', 'scanning')`,
				[result.result.reason, JSON.stringify(result.result.report), versionId]
			);
		}
	}).catch(async (error) => {
		console.error("Error queuing Argus scan:", error);
		try {
			await db.query(
				"UPDATE project_versions SET moderation_status = 'needs_review', moderation_reason = ?, argus_report = JSON_OBJECT('error', ?, 'source', 'cronus_argus_dispatch') WHERE id = ? AND moderation_status IN ('pending', 'scanning')",
				["Argus scan could not be started. Manual review is required.", error.message, versionId]
			);
		} catch (updateError) {
			console.error("Error marking version for manual Argus review:", updateError);
		}
	});
};

const VERSION_DEPENDENCY_TYPES = new Set(["required", "optional", "incompatible", "embedded"]);

const parseDependenciesInput = (dependenciesRaw) => {
    if(dependenciesRaw === undefined || dependenciesRaw === null || dependenciesRaw === "") {
        return [];
    }

    if(Array.isArray(dependenciesRaw)) {
        return dependenciesRaw;
    }

    if(typeof dependenciesRaw === "string") {
        try {
            const parsed = JSON.parse(dependenciesRaw);
            return Array.isArray(parsed) ? parsed : null;
        } catch {
            return null;
        }
    }

    return null;
};

const getModJamLifecycleFromDates = (jam) => {
    const now = Date.now();
    const startsAt = new Date(jam.starts_at).getTime();
    const submissionsStartAt = new Date(jam.submissions_start_at || jam.starts_at).getTime();
    const submissionsEndAt = new Date(jam.submissions_end_at).getTime();
    const votingStartsAt = new Date(jam.voting_starts_at || jam.submissions_end_at).getTime();
    const votingEndAt = new Date(jam.voting_end_at).getTime();

    if(!Number.isFinite(startsAt) || !Number.isFinite(submissionsStartAt) || !Number.isFinite(submissionsEndAt) || !Number.isFinite(votingStartsAt) || !Number.isFinite(votingEndAt)) {
        return "draft";
    }

    if(now < startsAt) {
        return "upcoming";
    }

    if(now < submissionsStartAt) {
        return "running";
    }

    if(now <= submissionsEndAt) {
        return "submissions_open";
    }

    if(now < votingStartsAt) {
        return "voting_pending";
    }

    if(now <= votingEndAt) {
        return "voting_open";
    }

    return "completed";
};

const normalizeDependencyInput = (dependency) => {
    if(!dependency || typeof dependency !== "object") {
        return null;
    }

    const projectId = String(dependency.project_id || dependency.projectId || "").trim();
    const projectSlug = String(dependency.slug || dependency.project_slug || dependency.projectSlug || "").trim().toLowerCase();
    const versionId = String(dependency.version_id || "").trim();
    const dependencyType = String(dependency.type || dependency.dependency_type || dependency.dependencyType || "required").trim().toLowerCase();

    if(!projectId && !projectSlug && !versionId) {
        return null;
    }

    if(!VERSION_DEPENDENCY_TYPES.has(dependencyType)) {
        return null;
    }

    return {
        project_id: projectId,
        project_slug: projectSlug,
        version_id: versionId,
        dependency_type: dependencyType,
    };
};

const resolveVersionDependencies = async ({ connection, dependenciesRaw }) => {
    const parsedDependencies = parseDependenciesInput(dependenciesRaw);
    if(parsedDependencies === null) {
        throw Object.assign(new Error("Invalid dependencies payload"), { statusCode: 400 });
    }

    const normalizedDependencies = parsedDependencies.map((dependency) => normalizeDependencyInput(dependency));
    if(normalizedDependencies.some((dependency) => !dependency)) {
        throw Object.assign(new Error("Dependencies must include valid fields"), { statusCode: 400 });
    }

    const resolvedDependencies = [];
    const uniqueKeys = new Set();

    for(const dependency of normalizedDependencies) {
        let resolvedProjectId = dependency.project_id || "";
        let resolvedProjectSlug = dependency.project_slug || "";
        const resolvedVersionId = dependency.version_id || null;

        if(!resolvedProjectId && resolvedProjectSlug) {
            const [projectRowsBySlug] = await connection.query("SELECT id, slug FROM projects WHERE slug = ? LIMIT 1", [resolvedProjectSlug]);
            if(!projectRowsBySlug.length) {
                throw Object.assign(new Error(`Dependency project not found: ${resolvedProjectSlug}`), { statusCode: 400 });
            }

            resolvedProjectId = projectRowsBySlug[0].id;
            resolvedProjectSlug = projectRowsBySlug[0].slug || resolvedProjectSlug;
        }

        if(resolvedVersionId) {
            const [versionRows] = await connection.query("SELECT id, project_id, version_number FROM project_versions WHERE id = ? LIMIT 1", [resolvedVersionId]);
            if(!versionRows.length) {
                throw Object.assign(new Error(`Dependency version not found: ${resolvedVersionId}`), { statusCode: 400 });
            }

            const versionRow = versionRows[0];
            if(resolvedProjectId && resolvedProjectId !== versionRow.project_id) {
                throw Object.assign(new Error(`Dependency project does not match version_id: ${resolvedVersionId}`), { statusCode: 400 });
            }

            resolvedProjectId = versionRow.project_id;
        }

        if(!resolvedProjectId) {
            throw Object.assign(new Error("Each dependency must include slug, project_id, or version_id"), { statusCode: 400 });
        }

        const [projectRows] = await connection.query("SELECT id, slug, title, icon_url, project_type FROM projects WHERE id = ? LIMIT 1", [resolvedProjectId]);
        if(!projectRows.length) {
            throw Object.assign(new Error(`Dependency project not found: ${resolvedProjectId}`), { statusCode: 400 });
        }

        const uniqueKey = `${resolvedProjectId}:${resolvedVersionId || "__project_only__"}`;
        if(uniqueKeys.has(uniqueKey)) {
            throw Object.assign(new Error("Duplicate dependencies are not allowed"), { statusCode: 400 });
        }

        uniqueKeys.add(uniqueKey);
        resolvedDependencies.push({
            project_id: resolvedProjectId,
            version_id: resolvedVersionId,
            dependency_type: dependency.dependency_type,
        });
    }

    return resolvedDependencies;
};

const replaceVersionDependencies = async ({ connection, sourceVersionId, dependencies }) => {
    try {
        await connection.query("DELETE FROM dependencies WHERE version_id = ?", [sourceVersionId]);
    } catch (error) {
        const message = String(error?.sqlMessage || error?.message || "").toLowerCase();
        if(error?.code === "ER_NO_SUCH_TABLE" && message.includes("dependencies")) {
            if(!dependencies.length) {
                return;
            }

            throw Object.assign(new Error("Dependencies table is missing. Please apply SQL migration first."), { statusCode: 400 });
        }

        throw error;
    }

    if(!dependencies.length) {
        return;
    }

    const values = dependencies.map((dependency) => [sourceVersionId, dependency.project_id, dependency.version_id, dependency.dependency_type]);
    try {
        await connection.query("INSERT INTO dependencies (version_id, project_id, dependency_version_id, dependency_type) VALUES ?", [values]);
    } catch (error) {
        const message = String(error?.sqlMessage || error?.message || "").toLowerCase();
        if(error?.code === "ER_NO_SUCH_TABLE" && message.includes("dependencies")) {
            throw Object.assign(new Error("Dependencies table is missing. Please apply SQL migration first."), { statusCode: 400 });
        }

        throw error;
    }
};

const getVersionDependencies = async (connection, versionId) => {
    let dependencyRows = [];
    try {
        const [rows] = await connection.query(`
            SELECT
                d.project_id,
                d.dependency_version_id AS version_id,
                d.dependency_type,
                p.slug AS project_slug,
                p.title AS project_title,
                p.icon_url AS project_icon_url,
                p.project_type AS project_type,
                pv.version_number
            FROM dependencies d
            LEFT JOIN projects p ON p.id = d.project_id
            LEFT JOIN project_versions pv ON pv.id = d.dependency_version_id
            WHERE d.version_id = ?
            ORDER BY d.project_id ASC, d.dependency_version_id ASC
        `, [versionId]);
        dependencyRows = rows;
    } catch (error) {
        const message = String(error?.sqlMessage || error?.message || "").toLowerCase();
        if(error?.code === "ER_NO_SUCH_TABLE" && message.includes("dependencies")) {
            return [];
        }

        throw error;
    }

    return dependencyRows.map((dependency) => ({
        project_id: dependency.project_id,
        version_id: dependency.version_id,
        dependency_type: dependency.dependency_type,
        project_slug: dependency.project_slug,
        project_title: dependency.project_title,
        project_icon_url: dependency.project_icon_url,
        project_type: dependency.project_type,
        version_number: dependency.version_number,
    }));
};

const getIssueAccess = async (projectId, userId) => {
    if(!projectId || !userId) {
        return {
            canManage: false,
            isModerator: false,
            access: null,
        };
    }

    const access = await resolveProjectAccess(db, projectId, userId);
    const role = await getUserRole(userId);
    const isModerator = role === "admin" || role === "moderator";

    const canManage = isModerator || access.isOwner || hasProjectPermission(access, ORG_PROJECT_PERMISSIONS.EDIT_DETAILS) || hasProjectPermission(access, ORG_PROJECT_PERMISSIONS.EDIT_BODY) || hasProjectPermission(access, ORG_PROJECT_PERMISSIONS.MANAGE_VERSIONS);

    return {
        canManage,
        isModerator,
        access,
    };
};

const extractHytaleWikiSlug = (urlValue) => {
    if(!urlValue || typeof urlValue !== "string") {
        return null;
    }

    try {
        const parsedUrl = new URL(urlValue);
        const normalizedHost = parsedUrl.hostname.toLowerCase();
        if(normalizedHost !== "wiki.hytalemodding.dev") {
            return null;
        }

        const pathParts = parsedUrl.pathname.split("/").filter(Boolean);
        const modIndex = pathParts.findIndex((part) => part.toLowerCase() === "mod");
        if(modIndex === -1 || !pathParts[modIndex + 1]) {
            return null;
        }

        const slug = pathParts[modIndex + 1].trim().toLowerCase();
        if(!/^[a-z0-9-]+$/.test(slug)) {
            return null;
        }

        return slug;
    } catch {
        return null;
    }
};

const sanitizeOptionalProjectLink = (value) => {
    if(value === undefined) {
        return { provided: false, value: null, invalid: false };
    }

    const raw = typeof value === "string" ? value.trim() : "";
    if(!raw) {
        return { provided: true, value: null, invalid: false };
    }

    const safeUrl = sanitizeExternalUrl(raw);
    if(!safeUrl) {
        return { provided: true, value: null, invalid: true };
    }

    return { provided: true, value: safeUrl, invalid: false };
};

const fetchHytaleWikiApi = async (pathname) => {
    const cacheKey = `modifold_hytale_wiki_api_${Buffer.from(pathname).toString("base64url")}`;
    const cachedJson = await getCacheJson(cacheKey);
    if(cachedJson) {
        return cachedJson;
    }

    const url = `https://wiki.hytalemodding.dev/api${pathname}`;
    const response = await fetch(url, {
        headers: {
            Accept: "application/json",
            Authorization: `Bearer ${process.env.HYTALE_WIKI_API_TOKEN}`,
        },
    });

    if(!response.ok) {
        const error = new Error(`Hytale wiki request failed (${response.status})`);
        error.statusCode = response.status;
        throw error;
    }

    const json = await response.json();
    await setCacheJson(cacheKey, json, 60);
    return json;
};

const flattenWikiPages = (pages = []) => {
    const flat = [];
    const walk = (nodes = []) => {
        for(const node of nodes) {
            flat.push(node);
            if(node?.children?.length) {
                walk(node.children);
            }
        }
    };

    walk(pages);
    return flat;
};

const getProjectWikiData = async ({ projectSlug, pageSlug }) => {
    const [rows] = await db.query(
        "SELECT id, slug, title, summary, hytale_wiki_slug FROM projects WHERE slug = ? LIMIT 1",
        [projectSlug]
    );
    const project = rows[0];

    if(!project) {
        return { error: "project_not_found", statusCode: 404 };
    }

    if(!project.hytale_wiki_slug) {
        return { error: "wiki_not_configured", statusCode: 404 };
    }

    const slug = project.hytale_wiki_slug.toString().trim();
    const details = await fetchHytaleWikiApi(`/mods/${encodeURIComponent(slug)}`);
    const targetMod = details?.mod || null;

    if(!targetMod?.id) {
        return { error: "wiki_mod_not_found", statusCode: 404 };
    }
    const pages = Array.isArray(details?.pages) ? details.pages : [];
    const allPages = flattenWikiPages(pages);
    const fallbackSlug = targetMod?.index?.slug || allPages?.[0]?.slug || targetMod?.slug || null;
    const selectedPageSlug = (pageSlug || fallbackSlug || "").toString().trim().toLowerCase();
    const selectedPageMeta = allPages.find((node) => (node?.slug || "").toLowerCase() === selectedPageSlug) || null;

    if(!selectedPageSlug) {
        return {
            project,
            mod: details?.mod || targetMod,
            pages,
            page: null,
            selectedPageSlug: null,
        };
    }

    const pageData = await fetchHytaleWikiApi(`/mods/${targetMod.id}/${encodeURIComponent(selectedPageSlug)}`);

    return {
        project,
        mod: details?.mod || targetMod,
        pages,
        page: pageData,
        selectedPageMeta,
        selectedPageSlug,
    };
};

const getOrganizationOwnerForProject = async (projectId) => {
    const [rows] = await db.query(
        `SELECT o.id, o.slug, o.name, o.summary, o.icon_url
        FROM organization_projects op
        INNER JOIN organizations o ON o.id COLLATE utf8mb4_unicode_ci = op.organization_id COLLATE utf8mb4_unicode_ci
        WHERE op.project_id = ?
        LIMIT 1`,
        [projectId]
    );

    return rows[0] || null;
};

const getProjectAccess = async ({ project, userId }) => {
    if(!project || !userId) {
        return null;
    }

    return resolveProjectAccess(db, project.id, userId);
};

const requireProjectPermission = async (res, { project, userId, permission }) => {
    const access = await getProjectAccess({ project, userId });
    const allowed = hasProjectPermission(access, permission);

    if(!allowed) {
        res.status(403).json({ message: "Unauthorized or project not found" });
        return null;
    }

    return access;
};

router.get("/", async (req, res) => {
    try {
        const { type, sort = "downloads", search = "", tags, game_versions, loaders, page = 1, limit = 20 } = req.query;
        const allowedTypes = ["mod", "modpack"];

        if(type && !allowedTypes.includes(type)) {
            return res.status(400).json({ message: "Invalid project type" });
        }

        if(isNaN(page) || page < 1) {
            return res.status(400).json({ message: "Invalid page number" });
        }

        if(isNaN(limit) || limit < 1) {
            return res.status(400).json({ message: "Invalid limit" });
        }

        const offset = (page - 1) * limit;

        const cacheKey = `modifold_projects_${Buffer.from(JSON.stringify(req.query)).toString('base64')}`;
        
        const cachedResponse = await getCacheJson(cacheKey);
        if(cachedResponse) {
            res.set("Cache-Control", "public, max-age=60, s-maxage=60, stale-while-revalidate=30");
            return res.json(cachedResponse);
        }

        let query = `
            SELECT p.id, p.slug, p.title, p.summary, p.icon_url, p.color, p.downloads, p.followers, p.created_at, p.updated_at, p.project_type, p.tags, p.license_id, p.license_name, p.show_players_last_14d,
            ANY_VALUE(u.username) AS username, ANY_VALUE(u.slug) AS user_slug, ANY_VALUE(u.avatar) AS avatar, ANY_VALUE(u.id) AS user_id, ANY_VALUE(u.isVerified) AS isVerified,
            ANY_VALUE(o.id) AS organization_id, ANY_VALUE(o.slug) AS organization_slug, ANY_VALUE(o.name) AS organization_name, ANY_VALUE(o.icon_url) AS organization_icon_url, ANY_VALUE(o.summary) AS organization_summary,
            ANY_VALUE(pv.game_versions) AS game_versions, ANY_VALUE(pv.loaders) AS loaders,
            (SELECT url FROM project_gallery WHERE project_id = p.id AND featured = 1 LIMIT 1) AS featured_image
            FROM projects p
            LEFT JOIN users u ON p.user_id = u.id
            LEFT JOIN organization_projects op ON op.project_id COLLATE utf8mb4_unicode_ci = p.id COLLATE utf8mb4_unicode_ci
            LEFT JOIN organizations o ON o.id COLLATE utf8mb4_unicode_ci = op.organization_id COLLATE utf8mb4_unicode_ci
            LEFT JOIN project_versions pv ON p.id = pv.project_id AND pv.moderation_status = 'approved'
        `;

        let countQuery = `
            SELECT COUNT(DISTINCT p.id) as total
            FROM projects p
            LEFT JOIN project_versions pv ON p.id = pv.project_id AND pv.moderation_status = 'approved'
        `;

        let whereClause = " WHERE p.status = 'approved'";
        const params = [];
        const countParams = [];

        if(type) {
            whereClause += " AND p.project_type = ?";
            params.push(type);
            countParams.push(type);
        }

        if(search) {
            whereClause += " AND p.title LIKE ?";
            params.push(`%${search}%`);
            countParams.push(`%${search}%`);
        }

        if(tags) {
            const tagArray = tags.split(",").map((tag) => tag.trim());
            whereClause += " AND (";
            tagArray.forEach((tag, index) => {
                whereClause += `p.tags LIKE ?${index < tagArray.length - 1 ? " OR " : ""}`;
                params.push(`%${tag}%`);
                countParams.push(`%${tag}%`);
            });
            whereClause += ")";
        }

        if(game_versions) {
            const versionArray = game_versions.split(",").map((v) => v.trim());
            whereClause += " AND (";
            versionArray.forEach((version, index) => {
                whereClause += `JSON_CONTAINS(pv.game_versions, ?)${index < versionArray.length - 1 ? " OR " : ""}`;
                params.push(JSON.stringify(version));
                countParams.push(JSON.stringify(version));
            });
            whereClause += ")";
        }

        if(loaders) {
            const loaderArray = loaders.split(",").map((l) => l.trim());
            whereClause += " AND (";
            loaderArray.forEach((loader, index) => {
                whereClause += `JSON_CONTAINS(pv.loaders, ?)${index < loaderArray.length - 1 ? " OR " : ""}`;
                params.push(JSON.stringify(loader));
                countParams.push(JSON.stringify(loader));
            });
            whereClause += ")";
        }

        query += whereClause;
        countQuery += whereClause;

        query += " GROUP BY p.id";

        if(sort === "recent") {
            query += " ORDER BY p.created_at DESC";
        } else if(sort === "updated") {
            query += " ORDER BY p.updated_at DESC";
        } else {
            query += " ORDER BY p.downloads DESC";
        }

        query += " LIMIT ? OFFSET ?";
        params.push(Number(limit), Number(offset));

        const [projects] = await db.query(query, params);
        const [[{ total }]] = await db.query(countQuery, countParams);

        const projectSlugs = projects.filter((project) => Number(project.show_players_last_14d) === 1).map((project) => project.slug).filter(Boolean);
        const playersLast14DaysBySlug = await getProjectPlayersInLastDaysBySlug({
            projectSlugs,
            days: 14,
        });

        const responseData = {
            projects: projects.map((project) => ({
                id: project.id,
                slug: project.slug,
                title: project.title,
                summary: project.summary,
                icon_url: project.icon_url || "https://media.modifold.com/static/no-project-icon.svg",
                color: project.color,
                downloads: project.downloads,
                show_players_last_14d: Number(project.show_players_last_14d) === 1,
                players_last_14d: playersLast14DaysBySlug.get(project.slug) || 0,
                followers: project.followers,
                user_id: project.user_id,
                created_at: project.created_at,
                updated_at: project.updated_at,
                project_type: project.project_type,
                license: { id: project.license_id, name: project.license_name },
                tags: project.tags ? project.tags.split(",").map((tag) => tag.trim()) : [],
                game_versions: project.game_versions ? JSON.parse(project.game_versions) : [],
                loaders: project.loaders ? JSON.parse(project.loaders) : [],
                gallery: project.featured_image ? [{ url: project.featured_image, featured: 1 }] : [],
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
                    username: project.username,
                    slug: project.user_slug,
                    avatar: project.avatar,
                    isVerified: project.isVerified,
                    type: "user",
                    profile_url: `/user/${project.user_slug}`,
                },
            })),
            totalPages: Math.ceil(total / limit),
            currentPage: Number(page),
        };

        await setCacheJson(cacheKey, responseData, 60);

        res.set("Cache-Control", "public, max-age=60, s-maxage=60, stale-while-revalidate=30");
        res.json(responseData);
    } catch (error) {
        console.error("Error fetching projects:", error);
        res.status(500).json({ message: "Error fetching projects", error: error.message });
    }
});

router.put("/:slug/tags", auth, async (req, res) => {
    try {
        const { slug } = req.params;
        const { tags } = req.body;

        if(!Array.isArray(tags)) {
            return res.status(400).json({ message: "Tags must be an array with a maximum of 3 tags" });
        }

        const [projectRows] = await db.query("SELECT id, user_id, project_type FROM projects WHERE slug = ?", [slug]);
        if(!projectRows.length) {
            return res.status(404).json({ message: "Project not found" });
        }

        const project = projectRows[0];
        const access = await requireProjectPermission(res, {
            project,
            userId: req.user.id,
            permission: ORG_PROJECT_PERMISSIONS.EDIT_DETAILS,
        });

        if(!access) {
            return;
        }

        const [tagRows] = await db.query(
            "SELECT name FROM project_tags WHERE project_type = ? AND is_active = 1",
            [project.project_type]
        );
        const validTags = tagRows.map((row) => row.name);
        if(tags.some((tag) => !validTags.includes(tag))) {
            return res.status(400).json({ message: "Invalid tags for project type" });
        }

        await db.query("UPDATE projects SET tags = ? WHERE slug = ?", [tags.join(","), slug]);

        res.json({ success: true, message: "Tags updated", tags });
    } catch (error) {
        console.error("Error updating tags:", error);
        res.status(500).json({ message: "Error updating tags", error: error.message });
    }
});

router.get('/user/projects', auth, async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query;

        if(isNaN(page) || page < 1) {
            return res.status(400).json({ message: 'Invalid page number' });
        }

        if(isNaN(limit) || limit < 1) {
            return res.status(400).json({ message: 'Invalid limit' });
        }

        const normalizedPage = Number(page);
        const normalizedLimit = Number(limit);
        const offset = (normalizedPage - 1) * normalizedLimit;

        const [projects] = await db.query(
            `
            SELECT DISTINCT
            p.id,
            p.slug,
            p.title,
            p.summary,
            p.icon_url,
            p.downloads,
            p.created_at,
            p.updated_at,
            p.project_type,
            p.tags,
            p.user_id,
            u.username,
            u.slug AS user_slug,
            u.avatar,
            u.isVerified,
            o.id AS organization_id,
            o.slug AS organization_slug,
            o.name AS organization_name,
            o.icon_url AS organization_icon_url,
            o.summary AS organization_summary
            FROM projects p
            LEFT JOIN users u ON u.id = p.user_id
            LEFT JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = ?
            LEFT JOIN organization_projects op ON op.project_id COLLATE utf8mb4_unicode_ci = p.id COLLATE utf8mb4_unicode_ci
            LEFT JOIN organizations o ON o.id COLLATE utf8mb4_unicode_ci = op.organization_id COLLATE utf8mb4_unicode_ci
            LEFT JOIN organization_members om ON om.organization_id COLLATE utf8mb4_unicode_ci = o.id COLLATE utf8mb4_unicode_ci AND om.user_id = ? AND om.status = 'accepted'
            WHERE p.user_id = ? OR pm.user_id = ? OR om.user_id = ?
            ORDER BY p.updated_at DESC
            LIMIT ? OFFSET ?
            `,
            [req.user.id, req.user.id, req.user.id, req.user.id, req.user.id, normalizedLimit, Number(offset)]
        );

        const [[{ total }]] = await db.query(
            `
            SELECT COUNT(DISTINCT p.id) AS total
            FROM projects p
            LEFT JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = ?
            LEFT JOIN organization_projects op ON op.project_id COLLATE utf8mb4_unicode_ci = p.id COLLATE utf8mb4_unicode_ci
            LEFT JOIN organization_members om ON om.organization_id COLLATE utf8mb4_unicode_ci = op.organization_id COLLATE utf8mb4_unicode_ci AND om.user_id = ? AND om.status = 'accepted'
            WHERE p.user_id = ? OR pm.user_id = ? OR om.user_id = ?
            `,
            [req.user.id, req.user.id, req.user.id, req.user.id, req.user.id]
        );

        const mappedProjects = [];
        for(const project of projects) {
            const access = await resolveProjectAccess(db, project.id, req.user.id);
            const profileUrl = project.organization_slug ? `/organization/${project.organization_slug}` : `/user/${project.user_slug}`;

            mappedProjects.push({
                id: project.id,
                slug: project.slug,
                title: project.title,
                summary: project.summary,
                icon_url: project.icon_url || "https://media.modifold.com/static/no-project-icon.svg",
                downloads: project.downloads,
                created_at: project.created_at,
                updated_at: project.updated_at,
                project_type: project.project_type,
                tags: project.tags ? project.tags.split(",").map((tag) => tag.trim()) : [],
                owner: project.organization_slug ? {
                    id: project.organization_id,
                    username: project.organization_name,
                    slug: project.organization_slug,
                    avatar: project.organization_icon_url || "https://media.modifold.com/static/no-project-icon.svg",
                    summary: project.organization_summary || "",
                    type: "organization",
                    profile_url: profileUrl,
                    isVerified: 0,
                } : {
                    username: project.username,
                    slug: project.user_slug,
                    avatar: project.avatar,
                    isVerified: project.isVerified,
                    type: "user",
                    profile_url: profileUrl,
                },
                permissions: {
                    can_edit: hasProjectPermission(access, ORG_PROJECT_PERMISSIONS.EDIT_DETAILS) || hasProjectPermission(access, ORG_PROJECT_PERMISSIONS.EDIT_BODY) || hasProjectPermission(access, ORG_PROJECT_PERMISSIONS.EDIT_GALLERY) || hasProjectPermission(access, ORG_PROJECT_PERMISSIONS.MANAGE_VERSIONS),
                },
            });
        }

        res.json({
            projects: mappedProjects,
            totalPages: Math.ceil(total / normalizedLimit),
            currentPage: normalizedPage,
        });
    } catch (error) {
        console.error('Error fetching user projects:', error);
        res.status(500).json({ message: 'Error fetching user projects', error: error.message });
    }
});

router.post("/", auth, upload.single("icon"), async (req, res) => {
    const { title, summary, visibility, project_type } = req.body;
    const allowedProjectTypes = ["mod", "modpack"];
    const defaultLicenseId = "arr";
    const defaultLicenseName = "All Rights Reserved / No License";

    if(!title || !summary || !allowedProjectTypes.includes(project_type)) {
        return res.status(400).json({ message: "Missing required fields or invalid project type" });
    }

    try {
        const safeTitle = sanitizePlainText(title);
        const safeSummary = sanitizePlainText(summary);
        if(!safeTitle || !safeSummary) {
            return res.status(400).json({ message: "Title and summary cannot be empty" });
        }

        if(safeSummary.length < 30) {
            return res.status(400).json({ message: `Summary must be at least 30 characters` });
        }

        if(safeSummary.length > 256) {
            return res.status(400).json({ message: `Summary must be 256 characters or fewer` });
        }

        let slug = slugify(safeTitle, { replacement: '-', lower: true, strict: true, remove: /[^a-zA-Z0-9\s]/g });
        const fallbackRandomLength = 10;
        const generateRandomSlug = () => Array.from({ length: fallbackRandomLength }, () => {
            const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
            return chars.charAt(Math.floor(Math.random() * chars.length));
        }).join("");
        const useRandomFallback = !slug;

        if(useRandomFallback) {
            slug = generateRandomSlug();
        }

        let slugIsUnique = false;
        let attempts = 0;
        const maxAttempts = 10;

        while(!slugIsUnique && attempts < maxAttempts) {
            const [existing] = await db.query("SELECT id FROM projects WHERE slug = ?", [slug]);
            if(existing.length > 0) {
                if(useRandomFallback) {
                    slug = generateRandomSlug();
                } else {
                    slug = `${slug}-${Math.floor(Math.random() * 10000) + 1}`;
                }
                attempts++;
            } else {
                slugIsUnique = true;
            }
        }

        if(!slugIsUnique) {
            return res.status(400).json({ message: "Unable to generate unique slug" });
        }

        const projectId = generateId();
        let iconUrl = "https://media.modifold.com/static/no-project-icon.svg";
        let projectColor = null;

        if(req.file) {
            const iconFile = await convertImageToWebp(req.file);
            const tempFilePath = path.join(process.env.MEDIA_ROOT, "temp", iconFile.filename);
            const projectDir = path.join(process.env.MEDIA_ROOT, "projects", projectId);
            const finalFilePath = path.join(projectDir, iconFile.filename);
            iconUrl = `https://media.modifold.com/projects/${projectId}/${iconFile.filename}`;

            try {
                await fs.mkdir(projectDir, { recursive: true });
                await fs.rename(tempFilePath, finalFilePath);
                projectColor = await extractDominantColorInt(finalFilePath);
                console.log(`Moved icon from ${tempFilePath} to ${finalFilePath}`);
            } catch (fileError) {
                console.error(`Failed to move icon to ${finalFilePath}:`, fileError);
                return res.status(500).json({ message: "Error moving icon file", error: fileError.message });
            }
        }

        const sql = "INSERT INTO projects (id, slug, user_id, title, summary, visibility, project_type, icon_url, color, license_id, license_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
        const values = [projectId, slug, req.user.id, safeTitle, safeSummary, visibility, project_type, iconUrl, projectColor, defaultLicenseId, defaultLicenseName];

        await db.query(sql, values);

        await db.query(
            "INSERT INTO project_members (project_id, user_id, role, status) VALUES (?, ?, ?, ?)",
            [projectId, req.user.id, "Owner", "accept"]
        );

        res.json({ id: projectId, slug, title: safeTitle, summary: safeSummary, visibility, project_type, icon_url: iconUrl, color: projectColor, success: true });
    } catch (error) {
        console.error("Error creating project:", error);
        res.status(500).json({ message: "Error creating project", error: error.message });
    }
});

router.put('/:slug/settings', auth, async (req, res) => {
    const { title, summary, visibility, show_players_last_14d } = req.body;
    try {
        const project = await getProjectBySlug(req.params.slug);
        if(!project) {
            return res.status(404).json({ message: "Project not found" });
        }

        const access = await requireProjectPermission(res, {
            project,
            userId: req.user.id,
            permission: ORG_PROJECT_PERMISSIONS.EDIT_DETAILS,
        });

        if(!access) {
            return;
        }

        const updates = {};
        if(title) {
            updates.title = sanitizePlainText(title);
        }

        if(summary !== undefined) {
            const safeSummary = sanitizePlainText(summary);
            if(!safeSummary) {
                return res.status(400).json({ message: "Summary cannot be empty" });
            }

            if(safeSummary.length < 30) {
                return res.status(400).json({ message: `Summary must be at least 30 characters` });
            }

            if(safeSummary.length > 256) {
                return res.status(400).json({ message: `Summary must be 256 characters or fewer` });
            }

            updates.summary = safeSummary;
        }

        if(visibility) {
            updates.visibility = visibility;
        }

        if(show_players_last_14d !== undefined) {
            if(show_players_last_14d === true || show_players_last_14d === "true" || show_players_last_14d === "1" || show_players_last_14d === 1) {
                updates.show_players_last_14d = 1;
            } else if(show_players_last_14d === false || show_players_last_14d === "false" || show_players_last_14d === "0" || show_players_last_14d === 0) {
                updates.show_players_last_14d = 0;
            } else {
                return res.status(400).json({ message: "show_players_last_14d must be a boolean" });
            }
        }

        if(Object.keys(updates).length === 0) {
            return res.status(400).json({ message: 'No data to update' });
        }

        await db.query('UPDATE projects SET ? WHERE id = ?', [updates, project.id]);
        res.json({ success: true, message: 'Project settings updated' });
    } catch (error) {
        console.error('Error updating project:', error);
        res.status(500).json({ message: 'Error updating project', error: error.message });
    }
});

router.put('/:slug/description', auth, async (req, res) => {
    const { description } = req.body;

    try {
        const project = await getProjectBySlug(req.params.slug);
        if(!project) {
            return res.status(404).json({ message: "Project not found" });
        }

        const access = await requireProjectPermission(res, {
            project,
            userId: req.user.id,
            permission: ORG_PROJECT_PERMISSIONS.EDIT_BODY,
        });

        if(!access) {
            return;
        }

        await db.query('UPDATE projects SET description = ? WHERE id = ?', [sanitizeMarkdownText(description || ""), project.id]);
        res.json({ success: true, message: 'Project description updated' });
    } catch (error) {
        console.error('Error updating description:', error);
        res.status(500).json({ message: 'Error updating description', error: error.message });
    }
});

router.put('/:slug/license', auth, async (req, res) => {
    const { license_id, license_name } = req.body;
    const defaultLicenseId = "arr";
    const defaultLicenseName = "All Rights Reserved / No License";
    
    try {
        const project = await getProjectBySlug(req.params.slug);
        if(!project) {
            return res.status(404).json({ message: "Project not found" });
        }

        const access = await requireProjectPermission(res, {
            project,
            userId: req.user.id,
            permission: ORG_PROJECT_PERMISSIONS.EDIT_DETAILS,
        });

        if(!access) {
            return;
        }

        const updates = {};
        if(license_id !== undefined) {
            updates.license_id = (!license_id || license_id === "no-license") ? defaultLicenseId : license_id;
        }

        if(license_name !== undefined) {
            updates.license_name = (!license_name || license_id === "no-license") ? defaultLicenseName : license_name;
        }

        if(Object.keys(updates).length === 0) {
            return res.status(400).json({ message: 'No data to update' });
        }

        await db.query('UPDATE projects SET ? WHERE id = ?', [updates, project.id]);
        res.json({ success: true, message: 'Project license updated' });
    } catch (error) {
        console.error('Error updating license:', error);
        res.status(500).json({ message: 'Error updating license', error: error.message });
    }
});

router.put('/:slug/links', auth, async (req, res) => {
    const { issue_url, source_url, wiki_url, discord_url, hytale_wiki_url } = req.body;
    try {
        const project = await getProjectBySlug(req.params.slug);
        if(!project) {
            return res.status(404).json({ message: "Project not found" });
        }

        const access = await requireProjectPermission(res, {
            project,
            userId: req.user.id,
            permission: ORG_PROJECT_PERMISSIONS.EDIT_DETAILS,
        });

        if(!access) {
            return;
        }

        const updates = {};
        if(issue_url !== undefined) {
            const result = sanitizeOptionalProjectLink(issue_url);
            if(result.invalid) {
                return res.status(400).json({ message: "Invalid Issue Tracker URL" });
            }

            updates.issue_url = result.value;
        }

        if(source_url !== undefined) {
            const result = sanitizeOptionalProjectLink(source_url);
            if(result.invalid) {
                return res.status(400).json({ message: "Invalid Source Code URL" });
            }

            updates.source_url = result.value;
        }

        if(wiki_url !== undefined) {
            const result = sanitizeOptionalProjectLink(wiki_url);
            if(result.invalid) {
                return res.status(400).json({ message: "Invalid Wiki URL" });
            }

            updates.wiki_url = result.value;
        }

        if(discord_url !== undefined) {
            const result = sanitizeOptionalProjectLink(discord_url);
            if(result.invalid) {
                return res.status(400).json({ message: "Invalid Discord URL" });
            }

            updates.discord_url = result.value;
        }

        if(hytale_wiki_url !== undefined) {
            const sanitizedHytaleWikiUrl = sanitizeExternalUrl(hytale_wiki_url) || null;
            if(!sanitizedHytaleWikiUrl) {
                updates.hytale_wiki_slug = null;
            } else {
                const hytaleWikiSlug = extractHytaleWikiSlug(sanitizedHytaleWikiUrl);
                if(!hytaleWikiSlug) {
                    return res.status(400).json({ message: "Invalid HytaleModding Wiki URL" });
                }

                updates.hytale_wiki_slug = hytaleWikiSlug;
            }
        }

        if(Object.keys(updates).length === 0) {
            return res.status(400).json({ message: 'No data to update' });
        }

        await db.query('UPDATE projects SET ? WHERE id = ?', [updates, project.id]);
        res.json({ success: true, message: 'Project links updated' });
    } catch (error) {
        console.error('Error updating links:', error);
        res.status(500).json({ message: 'Error updating links', error: error.message });
    }
});

router.put('/:slug/icon', auth, upload.single('icon'), async (req, res) => {
    try {
        const project = await getProjectBySlug(req.params.slug);
        if(!project) {
            return res.status(404).json({ message: "Project not found" });
        }

        const access = await requireProjectPermission(res, {
            project,
            userId: req.user.id,
            permission: ORG_PROJECT_PERMISSIONS.EDIT_DETAILS,
        });

        if(!access) {
            return;
        }

        if(!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        const iconFile = await convertImageToWebp(req.file);
        const iconUrl = `https://media.modifold.com/projects/${project.id}/${iconFile.filename}`;
        const projectColor = await extractDominantColorInt(iconFile.path);
        
        await db.query('UPDATE projects SET icon_url = ?, color = ? WHERE id = ?', [iconUrl, projectColor, project.id]);
        res.json({ success: true, icon_url: iconUrl, color: projectColor });
    } catch (error) {
        console.error('Error uploading icon:', error);
        res.status(500).json({ message: 'Error uploading icon', error: error.message });
    }
});

router.post("/:slug/versions", auth, upload.single("file"), async (req, res) => {
    const { version_number, changelog, release_channel, game_versions, loaders, dependencies } = req.body;

    try {
        const project = await getProjectBySlug(req.params.slug);
        if(!project) {
            return res.status(404).json({ message: "Project not found" });
        }

        const access = await requireProjectPermission(res, {
            project,
            userId: req.user.id,
            permission: ORG_PROJECT_PERMISSIONS.MANAGE_VERSIONS,
        });

        if(!access) {
            return;
        }

        if(!req.file || !version_number || !game_versions || !loaders) {
            return res.status(400).json({ message: "Missing required fields or file" });
        }

        const safeVersionNumber = sanitizePlainText(version_number);
        if(!safeVersionNumber) {
            return res.status(400).json({ message: "Invalid version number" });
        }

        const normalizedGameVersions = normalizeVersionArray(game_versions);
        if(!(await validateGameVersions(normalizedGameVersions))) {
            return res.status(400).json({ message: "Invalid game versions" });
        }

        const versionId = generateId();
        const createdAt = Math.floor(Date.now() / 1000);
        const fileUrl = `https://media.modifold.com/projects/${project.id}/${req.file.filename}`;
        const connection = await db.getConnection();

        try {
            await connection.beginTransaction();

            const resolvedDependencies = await resolveVersionDependencies({ connection, dependenciesRaw: dependencies });

            await connection.query("INSERT INTO project_versions (id, project_id, version_number, changelog, release_channel, file_url, file_size, game_versions, loaders, moderation_status, scan_requested_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', NOW())", [
                versionId,
                project.id,
                safeVersionNumber,
                changelog ? sanitizeMarkdownText(changelog) : null,
                release_channel || "release",
                fileUrl,
                req.file.size,
                JSON.stringify(normalizedGameVersions),
                loaders,
            ]);

            await replaceVersionDependencies({ connection, sourceVersionId: versionId, dependencies: resolvedDependencies });
            await connection.query("UPDATE projects SET updated_at = NOW() WHERE id = ?", [project.id]);
            await connection.commit();
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }

        queueArgusScan({
            versionId,
            project,
            fileUrl,
            fileName: req.file.originalname || req.file.filename,
            fileSize: req.file.size,
        });

        res.json({ success: true, versionId, fileUrl, moderation_status: "pending" });
    } catch (error) {
        console.error("Error creating version:", error);
        if(error?.statusCode === 400) {
            return res.status(400).json({ message: error.message });
        }

        res.status(500).json({ message: "Error creating version", error: error.message });
    }
});

router.post('/:slug/gallery', auth, upload.single('image'), async (req, res) => {
    const { title, description, ordering, featured } = req.body;
    try {
        const project = await getProjectBySlug(req.params.slug);
        if(!project) {
            return res.status(404).json({ message: "Project not found" });
        }

        const access = await requireProjectPermission(res, {
            project,
            userId: req.user.id,
            permission: ORG_PROJECT_PERMISSIONS.EDIT_GALLERY,
        });

        if(!access) {
            return;
        }

        if(!req.file) {
            return res.status(400).json({ message: 'No image uploaded' });
        }

        const galleryFile = await convertImageToWebp(req.file);

        if(featured === 'true') {
            await db.query('UPDATE project_gallery SET featured = FALSE WHERE project_id = ?', [project.id]);
        }

        const url = `https://media.modifold.com/projects/${project.id}/${galleryFile.filename}`;
        const rawUrl = url;
        await db.query(
            'INSERT INTO project_gallery (project_id, url, raw_url, title, description, ordering, featured) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [
                project.id,
                url,
                rawUrl,
                title ? sanitizePlainText(title) : null,
                description ? sanitizePlainText(description, { preserveNewlines: true }) : null,
                parseInt(ordering) || 0,
                featured === 'true',
            ]
        );

        await db.query("UPDATE projects SET updated_at = NOW() WHERE id = ?", [project.id]);

        res.json({ success: true, url });
    } catch (error) {
        console.error('Error uploading gallery image:', error);
        res.status(500).json({ message: 'Error uploading gallery image', error: error.message });
    }
});

router.put("/:slug/gallery/trailer", auth, async (req, res) => {
    const { youtube_url } = req.body || {};

    try {
        const project = await getProjectBySlug(req.params.slug);
        if(!project) {
            return res.status(404).json({ message: "Project not found" });
        }

        const access = await requireProjectPermission(res, {
            project,
            userId: req.user.id,
            permission: ORG_PROJECT_PERMISSIONS.EDIT_GALLERY,
        });

        if(!access) {
            return;
        }

        const trimmedUrl = typeof youtube_url === "string" ? youtube_url.trim() : "";
        const trailer = trimmedUrl ? normalizeYouTubeTrailer(trimmedUrl) : null;

        if(trimmedUrl && !trailer) {
            return res.status(400).json({ message: "Invalid YouTube URL" });
        }

        await db.query(
            "UPDATE projects SET trailer_youtube_url = ?, trailer_youtube_video_id = ?, updated_at = NOW() WHERE id = ?",
            [trailer?.url || null, trailer?.videoId || null, project.id]
        );

        res.json({
            success: true,
            trailer_youtube_url: trailer?.url || null,
            trailer_youtube_video_id: trailer?.videoId || null,
        });
    } catch (error) {
        console.error("Error updating gallery trailer:", error);
        res.status(500).json({ message: "Error updating gallery trailer", error: error.message });
    }
});

router.put('/:slug/gallery/:galleryId', auth, upload.single('image'), async (req, res) => {
    const { title, description, ordering, featured } = req.body;
    try {
        const project = await getProjectBySlug(req.params.slug);
        if(!project) {
            return res.status(404).json({ message: "Project not found" });
        }

        const access = await requireProjectPermission(res, {
            project,
            userId: req.user.id,
            permission: ORG_PROJECT_PERMISSIONS.EDIT_GALLERY,
        });

        if(!access) {
            return;
        }

        const [gallery] = await db.query('SELECT id FROM project_gallery WHERE id = ? AND project_id = ?', [req.params.galleryId, project.id]);
        if(!gallery.length) {
            return res.status(404).json({ message: 'Gallery image not found' });
        }

        const updates = {};
        if(title) {
            updates.title = sanitizePlainText(title);
        }

        if(description) {
            updates.description = sanitizePlainText(description, { preserveNewlines: true });
        }

        if(ordering) {
            updates.ordering = parseInt(ordering);
        }

        if(featured !== undefined) {
                if(featured === 'true') {
                await db.query('UPDATE project_gallery SET featured = FALSE WHERE project_id = ?', [project.id]);
            }

            updates.featured = featured === 'true';
        }

        if(req.file) {
            const galleryFile = await convertImageToWebp(req.file);
            updates.url = `https://media.modifold.com/projects/${project.id}/${galleryFile.filename}`;
            updates.raw_url = updates.url;
        }

        if(Object.keys(updates).length === 0) {
            return res.status(400).json({ message: 'No data to update' });
        }

        await db.query('UPDATE project_gallery SET ? WHERE id = ?', [updates, req.params.galleryId]);

        await db.query("UPDATE projects SET updated_at = NOW() WHERE id = ?", [project.id]);

        res.json({ success: true, message: 'Gallery image updated' });
    } catch (error) {
        console.error('Error updating gallery image:', error);
        res.status(500).json({ message: 'Error updating gallery image', error: error.message });
    }
});

router.delete("/:slug/gallery/:galleryId", auth, async (req, res) => {
    const { slug, galleryId } = req.params;

    try {
        const project = await getProjectBySlug(slug);
        if(!project) {
            return res.status(404).json({ message: "Project not found" });
        }

        const access = await requireProjectPermission(res, {
            project,
            userId: req.user.id,
            permission: ORG_PROJECT_PERMISSIONS.EDIT_GALLERY,
        });

        if(!access) {
            return;
        }

        const [gallery] = await db.query("SELECT id, url, raw_url FROM project_gallery WHERE id = ? AND project_id = ?", [galleryId, project.id]);
        if(!gallery.length) {
            return res.status(404).json({ message: "Gallery image not found" });
        }

        const fileUrls = [gallery[0].url, gallery[0].raw_url].filter(Boolean);
        for(const fileUrl of fileUrls) {
            const filePath = path.join(process.env.MEDIA_ROOT, fileUrl.replace(/^https:\/\/media\.modifold\.com\//, ""));
            try {
                await fs.unlink(filePath);
                console.log(`Deleted gallery image: ${filePath}`);
            } catch (fileError) {
                if(fileError.code !== "ENOENT") {
                    console.warn(`Failed to delete gallery image ${filePath}: ${fileError.message}`);
                }
            }
        }

        await db.query("DELETE FROM project_gallery WHERE id = ?", [galleryId]);

        await db.query("UPDATE projects SET updated_at = NOW() WHERE id = ?", [project.id]);

        res.json({ success: true, message: "Gallery image deleted successfully" });
    } catch (error) {
        console.error("Error deleting gallery image:", error);
        res.status(500).json({ message: "Error deleting gallery image", error: error.message });
    }
});

router.get("/:slug/wiki/:pageSlug?", async (req, res) => {
    try {
        const { slug, pageSlug } = req.params;
        const wikiData = await getProjectWikiData({ projectSlug: slug, pageSlug });

        if(wikiData?.error) {
            return res.status(wikiData.statusCode || 500).json({ message: wikiData.error });
        }

        if(!wikiData.page && !wikiData.selectedPageSlug) {
            return res.status(404).json({ message: "wiki_page_not_found" });
        }

        return res.json({
            project: {
                id: wikiData.project.id,
                slug: wikiData.project.slug,
                title: wikiData.project.title,
                summary: wikiData.project.summary,
                hytale_wiki_slug: wikiData.project.hytale_wiki_slug,
            },
            mod: wikiData.mod,
            pages: wikiData.pages,
            page: wikiData.page,
            selected_page: wikiData.selectedPageMeta,
            selected_page_slug: wikiData.selectedPageSlug,
            hytale_wiki_url: `https://wiki.hytalemodding.dev/mod/${wikiData.project.hytale_wiki_slug}`,
        });
    } catch (error) {
        console.error("Error loading project wiki:", error);
        res.status(500).json({ message: "Error loading project wiki", error: error.message });
    }
});

router.get('/:slug', optionalAuth, async (req, res) => {
    try {
        const { slug } = req.params;
        const userId = req.user?.id;
        const cacheVersion = await getProjectCacheVersion(slug);
        const cacheKey = `modifold_project_details_publicsafe_v2_${slug}_${userId || "anon"}_${cacheVersion}`;
        const shouldUseProjectCache = !userId;

        if(shouldUseProjectCache) {
            const cachedProject = await getCacheJson(cacheKey);
            if(cachedProject) {
                return res.json(cachedProject);
            }
        }

        const [project] = await db.query(
            `SELECT p.*, 
            u.username, u.slug AS user_slug, u.avatar, u.id AS user_id, u.isVerified AS isVerified,
            (SELECT COUNT(*) FROM project_likes pl WHERE pl.project_id = p.id) AS followers_count,
            (SELECT 1 FROM project_likes pl WHERE pl.project_id = p.id AND pl.user_id = ?) AS is_liked
            FROM projects p
            LEFT JOIN users u ON p.user_id = u.id
            WHERE p.slug = ?`,
            [userId || null, slug]
        );

        if(!project.length) {
            return res.status(404).json({ message: 'Project not found' });
        }

        const projectData = project[0];
        const access = userId ? await resolveProjectAccess(db, projectData.id, userId) : null;
        const canViewModerationFields = await canViewPrivateProjectVersions(projectData, userId);
        const versionVisibility = await buildVisibleVersionWhereClause(projectData, userId);

        const [versions] = await db.query(
            `SELECT v.* FROM project_versions v WHERE v.project_id = ? AND ${versionVisibility.sql} ORDER BY v.created_at DESC`,
            [projectData.id, ...versionVisibility.params]
        );

        const [gallery] = await db.query(
            'SELECT * FROM project_gallery WHERE project_id = ? ORDER BY ordering',
            [projectData.id]
        );

        const [members] = await db.query(
            `SELECT pm.user_id, pm.role, pm.status, u.username, u.slug, u.avatar, u.isVerified
            FROM project_members pm 
            LEFT JOIN users u ON pm.user_id = u.id 
            WHERE pm.project_id = ?`,
            [projectData.id]
        );
        let modJamParticipations = [];
        try {
            const [rows] = await db.query(
                `SELECT mj.id, mj.slug, mj.title, mj.summary, mj.avatar_url, mj.cover_url, mj.starts_at, mj.submissions_start_at, mj.submissions_end_at, mj.voting_starts_at, mj.voting_end_at,
                mjs.id AS submission_id, mjs.submitter_user_id,
                (SELECT COALESCE(SUM(COALESCE(mjv.vote_weight, 1)), 0) FROM mod_jam_votes mjv WHERE mjv.submission_id = mjs.id) AS votes_count,
                (SELECT user_vote.submission_id FROM mod_jam_votes user_vote WHERE user_vote.jam_id = mj.id AND user_vote.user_id = ? LIMIT 1) AS user_voted_submission_id
                FROM mod_jam_submissions mjs
                LEFT JOIN mod_jams mj ON mj.id = mjs.jam_id
                WHERE mjs.project_id = ? AND mjs.status = 'submitted' AND mj.status = 'approved'
                ORDER BY mj.voting_end_at DESC`,
                [userId || null, projectData.id]
            );
            modJamParticipations = rows;
        } catch (error) {
            if(error?.code !== "ER_NO_SUCH_TABLE") {
                throw error;
            }
        }
        const organizationOwner = await getOrganizationOwnerForProject(projectData.id);

        const formattedVersions = versions.map((version) => {
            let gameVersions, loaders;
            
            try {
                gameVersions = version.game_versions ? JSON.parse(version.game_versions).join(',') : '';
                loaders = version.loaders ? JSON.parse(version.loaders).join(',') : '';
            } catch (error) {
                console.error(`Error parsing JSON for version ${version.version_number}:`, error);
                gameVersions = '';
                loaders = '';
            }

            return sanitizeVersionForPublicResponse({
                ...version,
                game_versions: gameVersions,
                loaders: loaders,
            }, { includeModeration: canViewModerationFields });
        });

        const shouldShowPlayersLast14Days = Number(projectData.show_players_last_14d) === 1;
        const playersLast14DaysBySlug = shouldShowPlayersLast14Days ? await getProjectPlayersInLastDaysBySlug({
            projectSlugs: [projectData.slug],
            days: 14,
        }) : new Map([[projectData.slug, 0]]);

        const responseData = {
            id: projectData.id,
            slug: projectData.slug,
            project_type: projectData.project_type,
            title: projectData.title,
            summary: projectData.summary,
            description: projectData.description,
            visibility: projectData.visibility,
            issues_enabled: projectData.issues_enabled === 0 ? false : true,
            created_at: projectData.created_at,
            updated_at: projectData.updated_at,
            status: projectData.status,
            license: { id: projectData.license_id, name: projectData.license_name },
            issue_url: projectData.issue_url,
            source_url: projectData.source_url,
            wiki_url: projectData.wiki_url,
            discord_url: projectData.discord_url,
            hytale_wiki_slug: projectData.hytale_wiki_slug || null,
            hytale_wiki_url: projectData.hytale_wiki_slug ? `https://wiki.hytalemodding.dev/mod/${projectData.hytale_wiki_slug}` : null,
            icon_url: projectData.icon_url || "https://media.modifold.com/static/no-project-icon.svg",
            downloads: projectData.downloads,
            show_players_last_14d: shouldShowPlayersLast14Days,
            players_last_14d: playersLast14DaysBySlug.get(projectData.slug) || 0,
            followers: projectData.followers || projectData.followers_count || 0,
            color: projectData.color,
            game_versions: projectData.game_versions ? projectData.game_versions.split(',') : [],
            loaders: projectData.loaders ? projectData.loaders.split(',') : [],
            versions: formattedVersions,
            gallery,
            trailer_youtube_url: projectData.trailer_youtube_url || null,
            trailer_youtube_video_id: projectData.trailer_youtube_video_id || null,
            tags: projectData.tags,
            user_id: projectData.user_id,
            showProjectBackground: projectData.showProjectBackground,
            owner: organizationOwner ? {
                id: organizationOwner.id,
                username: organizationOwner.name,
                slug: organizationOwner.slug,
                avatar: organizationOwner.icon_url || "https://media.modifold.com/static/no-project-icon.svg",
                summary: organizationOwner.summary || "",
                isVerified: 0,
                type: "organization",
                profile_url: `/organization/${organizationOwner.slug}`,
            } : {
                username: projectData.username,
                slug: projectData.user_slug,
                avatar: projectData.avatar,
                isVerified: projectData.isVerified,
                type: "user",
                profile_url: `/user/${projectData.user_slug}`,
            },
            organization: organizationOwner ? {
                id: organizationOwner.id,
                slug: organizationOwner.slug,
                name: organizationOwner.name,
                summary: organizationOwner.summary || "",
                icon_url: organizationOwner.icon_url || "https://media.modifold.com/static/no-project-icon.svg",
            } : null,
            members: members.map(member => ({
                user_id: member.user_id,
                role: member.role,
                status: member.status,
                username: member.username,
                slug: member.slug,
                avatar: member.avatar,
                isVerified: member.isVerified,
            })),
            mod_jam_participations: modJamParticipations.map((jam) => ({
                ...(() => {
                    const lifecycle = getModJamLifecycleFromDates(jam);
                    const userVotedSubmissionId = jam.user_voted_submission_id || null;

                    return {
                        lifecycle,
                        user_voted_submission_id: userVotedSubmissionId,
                        user_voted_this_submission: Boolean(userVotedSubmissionId && Number(userVotedSubmissionId) === Number(jam.submission_id)),
                        can_vote: Boolean(userId && lifecycle === "voting_open" && !userVotedSubmissionId && Number(jam.submitter_user_id) !== Number(userId)),
                    };
                })(),
                id: jam.id,
                slug: jam.slug,
                title: jam.title,
                summary: jam.summary,
                avatar_url: jam.avatar_url || "https://media.modifold.com/static/no-project-icon.svg",
                cover_url: jam.cover_url || null,
                starts_at: jam.starts_at ? new Date(jam.starts_at).toISOString() : null,
                submissions_start_at: (jam.submissions_start_at || jam.starts_at) ? new Date(jam.submissions_start_at || jam.starts_at).toISOString() : null,
                submissions_end_at: jam.submissions_end_at ? new Date(jam.submissions_end_at).toISOString() : null,
                voting_starts_at: (jam.voting_starts_at || jam.submissions_end_at) ? new Date(jam.voting_starts_at || jam.submissions_end_at).toISOString() : null,
                voting_end_at: jam.voting_end_at ? new Date(jam.voting_end_at).toISOString() : null,
                submission_id: jam.submission_id,
                votes_count: Number(jam.votes_count) || 0,
            })),
            is_liked: !!projectData.is_liked,
            permissions: {
                can_edit_details: hasProjectPermission(access, ORG_PROJECT_PERMISSIONS.EDIT_DETAILS),
                can_edit_body: hasProjectPermission(access, ORG_PROJECT_PERMISSIONS.EDIT_BODY),
                can_edit_gallery: hasProjectPermission(access, ORG_PROJECT_PERMISSIONS.EDIT_GALLERY),
                can_manage_versions: hasProjectPermission(access, ORG_PROJECT_PERMISSIONS.MANAGE_VERSIONS),
                can_delete_project: hasProjectPermission(access, ORG_PROJECT_PERMISSIONS.DELETE_PROJECT),
            },
        };

        if(shouldUseProjectCache) {
            await setCacheJson(cacheKey, responseData, 30);
        }
        res.json(responseData);
    } catch (error) {
        console.error('Error fetching project:', error);
        res.status(500).json({ message: 'Error fetching project', error: error.message });
    }
});

router.delete("/:slug", auth, async (req, res) => {
    try {
        const project = await getProjectBySlug(req.params.slug);
        if(!project) {
            return res.status(404).json({ message: "Project not found" });
        }

        const access = await requireProjectPermission(res, {
            project,
            userId: req.user.id,
            permission: ORG_PROJECT_PERMISSIONS.DELETE_PROJECT,
        });

        if(!access) {
            return;
        }

        const projectId = project.id;
        const cdnBasePath = process.env.MEDIA_ROOT;
        const projectDir = path.join(cdnBasePath, "projects", projectId);

        try {
            await fs.rm(projectDir, { recursive: true, force: true });
            console.log(`Deleted project directory: ${projectDir}`);
        } catch (fileError) {
            if(fileError.code !== "ENOENT") {
                console.warn(`Failed to delete project directory ${projectDir}: ${fileError.message}`);
                return res.status(500).json({
                    message: "Project deleted, but some files could not be removed",
                    error: fileError.message,
                    success: true,
                });
            }
        }

        await db.query("DELETE FROM project_versions WHERE project_id = ?", [projectId]);
        await db.query("DELETE FROM project_gallery WHERE project_id = ?", [projectId]);
        await db.query("DELETE FROM projects WHERE id = ?", [projectId]);

        res.json({ success: true, message: "Project and associated files deleted" });
    } catch (error) {
        console.error("Error deleting project:", error);
        res.status(500).json({ message: "Error deleting project", error: error.message });
    }
});

router.put('/:id', auth, upload.single('icon'), async (req, res) => {
    const { id } = req.params;
    const { title, summary, visibility, slug, issues_enabled, show_players_last_14d } = req.body;
    const userId = req.user.id;

    try {
        const project = await getProjectById(id);
        if(!project) {
            return res.status(404).json({ message: 'Project not found' });
        }

        const access = await requireProjectPermission(res, {
            project,
            userId,
            permission: ORG_PROJECT_PERMISSIONS.EDIT_DETAILS,
        });

        if(!access) {
            return;
        }

        const [projectMetaRows] = await db.query('SELECT icon_url, slug, color FROM projects WHERE id = ?', [id]);
        const projectMeta = projectMetaRows[0];

        const safeTitle = sanitizePlainText(title);
        const safeSummary = sanitizePlainText(summary);

        if(!safeTitle) {
            return res.status(400).json({ message: "Title cannot be empty" });
        }

        if(!safeSummary) {
            return res.status(400).json({ message: "Summary cannot be empty" });
        }

        if(safeSummary.length < 30) {
            return res.status(400).json({ message: `Summary must be at least 30 characters` });
        }

        if(safeSummary.length > 256) {
            return res.status(400).json({ message: `Summary must be 256 characters or fewer` });
        }

        if(slug) {
            const validation = validateSlug(slug, { allowLegacy: slug === projectMeta.slug });
            if(!validation.valid) {
                return res.status(400).json({ message: validation.reason === "too_short" ? "Slug must be at least 4 characters" : "Slug must be 4-30 characters, lowercase, alphanumeric, or hyphens" });
            }

            const [existingSlug] = await db.query('SELECT 1 FROM projects WHERE slug = ? AND id != ?', [validation.normalized, id]);
            if(existingSlug.length) {
                return res.status(400).json({ message: 'Slug is already taken' });
            }
        }

        let iconUrl = projectMeta.icon_url || "https://media.modifold.com/static/no-project-icon.svg";
        let projectColor = projectMeta.color;
        if(req.file) {
            const iconFile = await convertImageToWebp(req.file);
            iconUrl = `https://media.modifold.com/projects/${id}/${iconFile.filename}`;
            projectColor = await extractDominantColorInt(iconFile.path);
        }

        let normalizedIssuesEnabled = null;
        if(issues_enabled !== undefined) {
            if(issues_enabled === true || issues_enabled === "true" || issues_enabled === "1" || issues_enabled === 1) {
                normalizedIssuesEnabled = 1;
            } else if(issues_enabled === false || issues_enabled === "false" || issues_enabled === "0" || issues_enabled === 0) {
                normalizedIssuesEnabled = 0;
            } else {
                return res.status(400).json({ message: "issues_enabled must be a boolean" });
            }
        }

        let normalizedShowPlayersLast14Days = null;
        if(show_players_last_14d !== undefined) {
            if(show_players_last_14d === true || show_players_last_14d === "true" || show_players_last_14d === "1" || show_players_last_14d === 1) {
                normalizedShowPlayersLast14Days = 1;
            } else if(show_players_last_14d === false || show_players_last_14d === "false" || show_players_last_14d === "0" || show_players_last_14d === 0) {
                normalizedShowPlayersLast14Days = 0;
            } else {
                return res.status(400).json({ message: "show_players_last_14d must be a boolean" });
            }
        }

        await db.query(
            'UPDATE projects SET title = ?, summary = ?, visibility = ?, icon_url = ?, color = ?, slug = ?, issues_enabled = COALESCE(?, issues_enabled), show_players_last_14d = COALESCE(?, show_players_last_14d) WHERE id = ?',
            [
                safeTitle,
                safeSummary,
                visibility,
                iconUrl,
                projectColor,
                (slug ? validateSlug(slug, { allowLegacy: slug === projectMeta.slug }).normalized : projectMeta.slug),
                normalizedIssuesEnabled,
                normalizedShowPlayersLast14Days,
                id,
            ]
        );

        const nextSlug = slug ? validateSlug(slug, { allowLegacy: slug === projectMeta.slug }).normalized : projectMeta.slug;

        if(nextSlug !== projectMeta.slug) {
            await Promise.all([
                bumpProjectCacheVersion(projectMeta.slug),
                bumpProjectCacheVersion(nextSlug),
            ]);
        } else {
            await bumpProjectCacheVersion(projectMeta.slug);
        }

        res.json({ success: true, message: 'Project updated', slug: nextSlug });
    } catch (error) {
        console.error('Error updating project:', error);
        res.status(500).json({ message: 'Error updating project', error: error.message });
    }
});

const trackProjectDownload = async ({ slug, versionId, ipAddress, countryCode, userId = null }) => {
    const [project] = await db.query("SELECT id, slug, user_id FROM projects WHERE slug = ?", [slug]);
    if(!project.length) {
        return { status: 404, body: { message: "Project not found" } };
    }

    const projectSlug = project[0].slug;

    const [version] = await db.query(
        "SELECT id, file_url, version_number, moderation_status FROM project_versions WHERE id = ? AND project_id = ?",
        [versionId, project[0].id]
    );

    if(!version.length) {
        return { status: 404, body: { message: "Version not found" } };
    }

    if(!version[0].file_url) {
        return { status: 404, body: { message: "Version file not found" } };
    }

    if(version[0].moderation_status !== "approved" && !(await canViewPrivateProjectVersions(project[0], userId))) {
        return { status: 404, body: { message: "Version not found" } };
    }

    const fileUrl = version[0].file_url;

    if(!ipAddress) {
        return {
            status: 200,
            body: { success: true, counted: false, reason: "no_ip" },
            fileUrl,
        };
    }

    const shouldCount = !(await hasRecentProjectEvent({
        projectSlug,
        eventType: "download",
        ipAddress,
        windowMinutes: 30,
    }));

    if(shouldCount) {
        await insertProjectEvent({
            projectSlug,
            versionId: Number(versionId),
            eventType: "download",
            ipAddress,
            countryCode,
        });

        await db.query("UPDATE project_versions SET downloads = downloads + 1 WHERE id = ?", [versionId]);
        await db.query("UPDATE projects SET downloads = downloads + 1 WHERE slug = ?", [projectSlug]);
        await bumpProjectCacheVersion(projectSlug);
    }

    const [[{ totalDownloads }]] = await db.query(
        'SELECT downloads AS totalDownloads FROM projects WHERE slug = ?',
        [projectSlug]
    );

    return {
        status: 200,
        body: {
            success: true,
            counted: shouldCount,
            windowMinutes: 30,
            totalDownloads,
        },
        fileUrl,
    };
};

router.get('/:slug/versions/:versionId/download', optionalAuth, async (req, res) => {
    const { slug, versionId } = req.params;
    const ipAddress = getRequestIpAddress(req);
    const countryCode = getRequestCountryCode(req);

    try {
        const result = await trackProjectDownload({ slug, versionId, ipAddress, countryCode, userId: req.user?.id || null });
        if(result.status !== 200) {
            return res.status(result.status).json(result.body);
        }

        return res.redirect(result.fileUrl);
    } catch (error) {
        console.error('Error handling download redirect:', error);
        return res.status(500).json({ message: 'Error handling download redirect', error: error.message });
    }
});

router.post('/:slug/versions/:versionId/download', optionalAuth, async (req, res) => {
    const { slug, versionId } = req.params;
    const ipAddress = getRequestIpAddress(req);
    const countryCode = getRequestCountryCode(req);

    try {
        const result = await trackProjectDownload({ slug, versionId, ipAddress, countryCode, userId: req.user?.id || null });
        return res.status(result.status).json(result.body);
    } catch (error) {
        console.error('Error incrementing download count:', error);
        return res.status(500).json({ message: 'Error incrementing download count', error: error.message });
    }
});

router.get("/moderation", auth, async (req, res) => {
    if(!req.user.isRole === 'admin') {
        return res.status(403).json({ message: "Unauthorized" });
    }

    try {
        const [projects] = await db.query("SELECT id, slug, title, summary, project_type, status, tags, icon FROM projects WHERE status IN ('queued', 'pending')");
        res.json({ projects });
    } catch (error) {
        console.error("Error fetching projects for moderation:", error);
        res.status(500).json({ message: "Error fetching projects", error: error.message });
    }
});

router.post("/:id/moderate", auth, async (req, res) => {
    if(!req.user.isRole === 'admin') {
        return res.status(403).json({ message: "Unauthorized" });
    }

    const { id } = req.params;
    const { status, moderator_message } = req.body;

    if(!["approved", "rejected"].includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
    }

    try {
        await db.query("UPDATE projects SET status = ? WHERE id = ?", [status, id]);
        await bumpProjectCacheVersionById(db, id);
        res.json({ success: true });
    } catch (error) {
        console.error("Error moderating project:", error);
        res.status(500).json({ message: "Error moderating project", error: error.message });
    }
});

router.post('/:slug/submit', auth, async (req, res) => {
    const { slug } = req.params;
    const { status } = req.body;

    if(status !== "queued") {
        return res.status(400).json({ message: 'Invalid status' });
    }

    try {
        const project = await getProjectBySlug(slug);
        if(!project) {
            return res.status(404).json({ message: "Project not found" });
        }

        const access = await requireProjectPermission(res, {
            project,
            userId: req.user.id,
            permission: ORG_PROJECT_PERMISSIONS.EDIT_DETAILS,
        });

        if(!access) {
            return;
        }

        const [projectMetaRows] = await db.query(
            'SELECT icon_url, summary, description FROM projects WHERE id = ?',
            [project.id]
        );

        const projectMeta = projectMetaRows[0];

        const [versions] = await db.query('SELECT id FROM project_versions WHERE project_id = ?', [project.id]);
        if(!projectMeta.icon_url || !projectMeta.summary || !projectMeta.description || versions.length === 0) {
            return res.status(400).json({ message: 'Project missing required fields: icon, description, summary or versions' });
        }

        await db.query("UPDATE projects SET status = ?, updated_at = NOW() WHERE id = ?", [status, project.id]);

        await db.query(`
            INSERT INTO project_moderation_logs 
            (project_id, action, moderator_id, reason, created_at)
            VALUES (?, ?, NULL, NULL, NOW())
        `, [project.id, status]);

        res.json({ success: true });
    } catch (error) {
        console.error('Error submitting project for moderation:', error);
        res.status(500).json({ message: 'Error submitting project', error: error.message });
    }
});

router.put('/:slug/versions/:versionId', auth, upload.single('file'), async (req, res) => {
    const { slug, versionId } = req.params;
    const { version_number, changelog, release_channel, game_versions, loaders, dependencies } = req.body;
    const file = req.file;

    try {
        const project = await getProjectBySlug(slug);
        if(!project) {
            return res.status(404).json({ message: "Project not found" });
        }

        const access = await requireProjectPermission(res, {
            project,
            userId: req.user.id,
            permission: ORG_PROJECT_PERMISSIONS.MANAGE_VERSIONS,
        });

        if(!access) {
            return;
        }

        const [version] = await db.query('SELECT id FROM project_versions WHERE id = ? AND project_id = ?', [versionId, project.id]);
        if(!version.length) {
            return res.status(404).json({ message: 'Version not found' });
        }

        const fileUrl = file ? `https://media.modifold.com/projects/${project.id}/${file.filename}` : null;
        const fileSize = file ? file.size : null;

        const normalizedGameVersions = normalizeVersionArray(game_versions);
        if(!(await validateGameVersions(normalizedGameVersions))) {
            return res.status(400).json({ message: "Invalid game versions" });
        }

        const updateData = {
            version_number: version_number ? sanitizePlainText(version_number) : version_number,
            changelog: changelog ? sanitizeMarkdownText(changelog) : null,
            release_channel: release_channel || 'release',
            file_url: fileUrl,
            file_size: fileSize,
            game_versions: JSON.stringify(normalizedGameVersions),
            loaders: loaders || '[]',
        };

        const connection = await db.getConnection();

        try {
            await connection.beginTransaction();

            const resolvedDependencies = await resolveVersionDependencies({ connection, dependenciesRaw: dependencies });

            await connection.query(
                `UPDATE project_versions
                SET version_number = ?,
                changelog = ?,
                release_channel = ?,
                file_url = COALESCE(?, file_url),
                file_size = COALESCE(?, file_size),
                game_versions = ?,
                loaders = ?,
                moderation_status = IF(? IS NULL, moderation_status, 'pending'),
                moderation_reason = IF(? IS NULL, moderation_reason, NULL),
                moderated_by = IF(? IS NULL, moderated_by, NULL),
                moderated_at = IF(? IS NULL, moderated_at, NULL),
                scan_requested_at = IF(? IS NULL, scan_requested_at, NOW()),
                scanned_at = IF(? IS NULL, scanned_at, NULL),
                argus_report = IF(? IS NULL, argus_report, NULL)
                WHERE id = ?`,
                [
                    updateData.version_number,
                    updateData.changelog,
                    updateData.release_channel,
                    updateData.file_url,
                    updateData.file_size,
                    updateData.game_versions,
                    updateData.loaders,
                    updateData.file_url,
                    updateData.file_url,
                    updateData.file_url,
                    updateData.file_url,
                    updateData.file_url,
                    updateData.file_url,
                    updateData.file_url,
                    versionId,
                ]
            );

            await replaceVersionDependencies({ connection, sourceVersionId: versionId, dependencies: resolvedDependencies });
            await connection.query("UPDATE projects SET updated_at = NOW() WHERE id = ?", [project.id]);
            await connection.commit();
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }

        if(fileUrl) {
            queueArgusScan({
                versionId,
                project,
                fileUrl,
                fileName: file.originalname || file.filename,
                fileSize,
            });
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Error updating version:', error);
        if(error?.statusCode === 400) {
            return res.status(400).json({ message: error.message });
        }

        res.status(500).json({ message: 'Error updating version', error: error.message });
    }
});

router.delete("/:slug/versions/:versionId", auth, async (req, res) => {
    const { slug, versionId } = req.params;

    try {
        const project = await getProjectBySlug(slug);
        if(!project) {
            return res.status(404).json({ message: "Project not found" });
        }

        const access = await requireProjectPermission(res, {
            project,
            userId: req.user.id,
            permission: ORG_PROJECT_PERMISSIONS.MANAGE_VERSIONS,
        });

        if(!access) {
            return;
        }

        const [version] = await db.query("SELECT id, file_url FROM project_versions WHERE id = ? AND project_id = ?", [versionId, project.id]);
        if(!version.length) {
            return res.status(404).json({ message: "Version not found" });
        }

        const fileUrl = version[0].file_url;
        if(fileUrl) {
            const filePath = path.join(process.env.MEDIA_ROOT, fileUrl.replace(/^https:\/\/media\.modifold\.com\//, ""));
            try {
                await fs.unlink(filePath);
                console.log(`Deleted file: ${filePath}`);
            } catch (fileError) {
                if(fileError.code !== "ENOENT") {
                    console.warn(`Failed to delete file ${filePath}: ${fileError.message}`);
                }
            }
        }

        try {
            await db.query("DELETE FROM dependencies WHERE version_id = ? OR dependency_version_id = ?", [versionId, versionId]);
        } catch (error) {
            const message = String(error?.sqlMessage || error?.message || "").toLowerCase();
            if(!(error?.code === "ER_NO_SUCH_TABLE" && message.includes("dependencies"))) {
                throw error;
            }
        }
        await db.query("DELETE FROM project_versions WHERE id = ?", [versionId]);
        await db.query(
            `DELETE FROM notification_events
            WHERE event_type = 'project_version_release'
            AND object_type = 'project_version'
            AND object_id = ?`,
            [String(versionId)]
        );

        await db.query("UPDATE projects SET updated_at = NOW() WHERE id = ?", [project.id]);

        res.json({ success: true, message: "Version deleted successfully" });
    } catch (error) {
        console.error("Error deleting version:", error);
        res.status(500).json({ message: "Error deleting version", error: error.message });
    }
});

router.post("/:slug/members", auth, async (req, res) => {
    const { slug } = req.params;
    const { username, role = "Member" } = req.body;

    try {
        const [project] = await db.query("SELECT id, user_id FROM projects WHERE slug = ?", [slug]);
        if(!project.length || project[0].user_id !== req.user.id) {
            return res.status(403).json({ message: "Unauthorized or project not found" });
        }

        const [user] = await db.query("SELECT id FROM users WHERE username = ?", [username]);
        if(!user.length) {
            return res.status(404).json({ message: "User not found" });
        }

        const [existingMember] = await db.query("SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?", [project[0].id, user[0].id]);
        if(existingMember.length) {
            return res.status(400).json({ message: "User is already a member" });
        }

        await db.query("INSERT INTO project_members (project_id, user_id, role, status) VALUES (?, ?, ?, ?)", [project[0].id, user[0].id, role, "accept"]);
        res.json({ success: true, message: "Invitation sent" });
    } catch (error) {
        console.error("Error inviting member:", error);
        res.status(500).json({ message: "Error inviting member", error: error.message });
    }
});

router.put("/:slug/members/:userId", auth, async (req, res) => {
    const { slug, userId } = req.params;
    const { role, status } = req.body;

    try {
        const [project] = await db.query("SELECT id, user_id FROM projects WHERE slug = ?", [slug]);
        if(!project.length || project[0].user_id !== req.user.id) {
            return res.status(403).json({ message: "Unauthorized or project not found" });
        }

        const [member] = await db.query("SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?", [project[0].id, userId]);
        if(!member.length) {
            return res.status(404).json({ message: "Member not found" });
        }

        const updates = {};

        if(role) {
            updates.role = role;
        }

        if(status) {
            updates.status = status;
        }

        if(!Object.keys(updates).length) {
            return res.status(400).json({ message: "No updates provided" });
        }

        await db.query("UPDATE project_members SET ? WHERE project_id = ? AND user_id = ?", [updates, project[0].id, userId]);
        res.json({ success: true, message: "Member updated" });
    } catch (error) {
        console.error("Error updating member:", error);
        res.status(500).json({ message: "Error updating member", error: error.message });
    }
});

router.delete("/:slug/members/:userId", auth, async (req, res) => {
    const { slug, userId } = req.params;

    try {
        const [project] = await db.query("SELECT id, user_id FROM projects WHERE slug = ?", [slug]);
        if(!project.length) {
            return res.status(404).json({ message: "Project not found" });
        }

        const isOwner = project[0].user_id === req.user.id;
        const isSelf = req.user.id === userId;

        if(!isOwner && !isSelf) {
            return res.status(403).json({ message: "Unauthorized" });
        }

        if(isOwner && req.user.id === userId) {
            return res.status(400).json({ message: "Owner cannot leave project" });
        }

        await db.query("DELETE FROM project_members WHERE project_id = ? AND user_id = ?", [project[0].id, userId]);
        res.json({ success: true, message: "Member removed" });
    } catch (error) {
        console.error("Error removing member:", error);
        res.status(500).json({ message: "Error removing member", error: error.message });
    }
});

router.get('/:slug/members', async (req, res) => {
    const { slug } = req.params;

    try {
        const cacheVersion = await getProjectCacheVersion(slug);
        const cacheKey = `modifold_project_members_${slug}_${cacheVersion}`;
        const cachedMembers = await getCacheJson(cacheKey);
        if(cachedMembers) {
            return res.json(cachedMembers);
        }

        const [project] = await db.query('SELECT id, user_id FROM projects WHERE slug = ?', [slug]);
        if(!project.length) {
            return res.status(404).json({ message: "Project not found" });
        }

        const [members] = await db.query(`
            SELECT pm.user_id, pm.role, pm.status, u.username, u.slug, u.avatar, u.isVerified
            FROM project_members pm 
            LEFT JOIN users u ON pm.user_id = u.id 
            WHERE pm.project_id = ?
        `, [project[0].id]);

        await setCacheJson(cacheKey, members, 30);
        res.json(members);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching members' });
    }
});

router.get("/:slug/issues", optionalAuth, async (req, res) => {
    try {
        const { slug } = req.params;
        const viewerId = req.user?.id || null;
        const project = await getProjectBySlug(slug);

        if(!project) {
            return res.status(404).json({ message: "Project not found" });
        }

        const status = (req.query.status || "open").toString().toLowerCase();
        const sort = (req.query.sort || "newest").toString().toLowerCase();
        const page = Math.max(1, Number(req.query.page) || 1);
        const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
        const offset = (page - 1) * limit;

        const statusFilter = status === "closed" ? "closed" : status === "open" ? "open" : null;
        const orderDirection = sort === "oldest" ? "ASC" : "DESC";

        const [countRows] = await db.query(
            `SELECT
                SUM(status = 'open') AS openCount,
                SUM(status = 'closed') AS closedCount,
                SUM(status = 'closed' AND is_pinned = 1) AS pinnedClosedCount,
                COUNT(*) AS totalCount
            FROM project_issues
            WHERE project_id = ?`,
            [project.id]
        );

        const counts = countRows[0] || { openCount: 0, closedCount: 0, pinnedClosedCount: 0, totalCount: 0 };
        const totalCount = statusFilter === "open"
            ? Number(counts.openCount || 0) + Number(counts.pinnedClosedCount || 0)
            : statusFilter === "closed"
                ? Number(counts.closedCount || 0)
                : Number(counts.totalCount || 0);
        const totalPages = Math.max(1, Math.ceil(totalCount / limit));

        const params = [project.id];
        let query = `
            SELECT i.id, i.title, i.status, i.created_at, i.updated_at, i.author_user_id, i.is_pinned,
            u.username, u.slug, u.avatar, u.isVerified, u.isRole,
            (
                SELECT COUNT(*) FROM project_issue_comments ic
                WHERE ic.issue_id = i.id AND ic.status = 'visible'
            ) AS comments_count
            FROM project_issues i
            LEFT JOIN users u ON u.id = i.author_user_id
            WHERE i.project_id = ?
        `;

        if(statusFilter === "open") {
            query += " AND (i.status = ? OR (i.status = 'closed' AND i.is_pinned = 1))";
            params.push("open");
        } else if(statusFilter === "closed") {
            query += " AND i.status = ?";
            params.push("closed");
        }

        query += ` ORDER BY i.is_pinned DESC, i.created_at ${orderDirection}, i.id ${orderDirection} LIMIT ? OFFSET ?`;
        params.push(limit, offset);

        const [issues] = await db.query(query, params);
        const issueIds = issues.map((issue) => issue.id);

        let labelsByIssue = {};
        if(issueIds.length > 0) {
            const [labelRows] = await db.query(
                `SELECT il.issue_id, l.id, l.name, l.color, l.is_archived
                FROM project_issue_label_links il
                INNER JOIN project_issue_labels l ON l.id = il.label_id
                WHERE il.issue_id IN (?)
                ORDER BY il.created_at ASC`,
                [issueIds]
            );

            labelsByIssue = labelRows.reduce((acc, row) => {
                if(!acc[row.issue_id]) {
                    acc[row.issue_id] = [];
                }

                acc[row.issue_id].push({
                    id: row.id,
                    name: row.name,
                    color: row.color,
                    is_archived: !!row.is_archived,
                });

                return acc;
            }, {});
        }

        const formatted = issues.map((issue) => ({
            id: issue.id,
            title: issue.title,
            status: issue.status,
            created_at: issue.created_at,
            updated_at: issue.updated_at,
            is_pinned: !!issue.is_pinned,
            comments_count: Number(issue.comments_count || 0),
            labels: labelsByIssue[issue.id] || [],
            author: issue.author_user_id ? {
                id: issue.author_user_id,
                username: issue.username,
                slug: issue.slug,
                avatar: issue.avatar,
                isVerified: issue.isVerified,
                isRole: issue.isRole,
            } : null,
        }));

        const access = viewerId ? await getIssueAccess(project.id, viewerId) : { canManage: false };

        return res.json({
            projectId: project.id,
            projectSlug: project.slug,
            openCount: Number(counts.openCount || 0),
            closedCount: Number(counts.closedCount || 0),
            totalCount,
            totalPages,
            page,
            limit,
            canManage: !!access.canManage,
            issues: formatted,
        });
    } catch (error) {
        console.error("Error fetching issues:", error);
        return res.status(500).json({ message: "Error fetching issues", error: error.message });
    }
});

router.get("/:slug/issues/templates", optionalAuth, async (req, res) => {
    try {
        const { slug } = req.params;
        const viewerId = req.user?.id || null;
        const project = await getProjectBySlug(slug);

        if(!project) {
            return res.status(404).json({ message: "Project not found" });
        }

        const includeArchived = (req.query.include_archived || "").toString().toLowerCase() === "true";
        const access = viewerId ? await getIssueAccess(project.id, viewerId) : { canManage: false };
        const shouldIncludeArchived = includeArchived && access.canManage;

        const [rows] = await db.query(
            `SELECT id, name, description, content, title_placeholder, default_labels_json, default_assignees_json, default_type,
            created_at, updated_at, is_archived
            FROM project_issue_templates
            WHERE project_id = ? ${shouldIncludeArchived ? "" : "AND is_archived = 0"}
            ORDER BY created_at ASC`,
            [project.id]
        );

        const templates = rows.map((row) => ({
            id: row.id,
            name: row.name,
            description: row.description,
            content: row.content,
            title_placeholder: row.title_placeholder || "",
            default_labels: row.default_labels_json ? JSON.parse(row.default_labels_json) : [],
            default_assignees: row.default_assignees_json ? JSON.parse(row.default_assignees_json) : [],
            default_type: row.default_type || null,
            created_at: row.created_at,
            updated_at: row.updated_at,
            is_archived: !!row.is_archived,
        }));

        return res.json({ templates });
    } catch (error) {
        console.error("Error fetching issue templates:", error);
        return res.status(500).json({ message: "Error fetching issue templates", error: error.message });
    }
});

router.post("/:slug/issues/templates", auth, async (req, res) => {
    try {
        const { slug } = req.params;
        const userId = req.user?.id;
        const { name, description, content, title_placeholder, default_labels, default_assignees, default_type } = req.body || {};

        if(!userId) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const project = await getProjectBySlug(slug);
        if(!project) {
            return res.status(404).json({ message: "Project not found" });
        }

        const access = await getIssueAccess(project.id, userId);
        if(!access.canManage) {
            return res.status(403).json({ message: "Forbidden" });
        }

        const safeName = sanitizePlainText(name || "");
        const safeDescription = sanitizePlainText(description || "");
        const safeContent = sanitizeMarkdownText(content || "");
        const safeTitlePlaceholder = sanitizePlainText(title_placeholder || "");

        if(!safeName || safeName.length < 2) {
            return res.status(400).json({ message: "Template name is too short" });
        }

        const now = Date.now();
        const [result] = await db.query(
            `INSERT INTO project_issue_templates
            (project_id, name, description, content, title_placeholder, default_labels_json, default_assignees_json, default_type, is_archived, created_by, updated_by, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)`,
            [
                project.id,
                safeName,
                safeDescription,
                safeContent,
                safeTitlePlaceholder,
                Array.isArray(default_labels) ? JSON.stringify(default_labels) : null,
                Array.isArray(default_assignees) ? JSON.stringify(default_assignees) : null,
                default_type || null,
                userId,
                userId,
                now,
                now,
            ]
        );

        return res.status(201).json({
            id: result.insertId,
            name: safeName,
            description: safeDescription,
            content: safeContent,
            title_placeholder: safeTitlePlaceholder,
            default_labels: Array.isArray(default_labels) ? default_labels : [],
            default_assignees: Array.isArray(default_assignees) ? default_assignees : [],
            default_type: default_type || null,
            created_at: now,
            updated_at: now,
        });
    } catch (error) {
        console.error("Error creating issue template:", error);
        return res.status(500).json({ message: "Error creating issue template", error: error.message });
    }
});

router.patch("/:slug/issues/templates/:templateId", auth, async (req, res) => {
    try {
        const { slug, templateId } = req.params;
        const userId = req.user?.id;
        const { name, description, content, title_placeholder, default_labels, default_assignees, default_type, is_archived } = req.body || {};

        if(!userId) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const project = await getProjectBySlug(slug);
        if(!project) {
            return res.status(404).json({ message: "Project not found" });
        }

        const access = await getIssueAccess(project.id, userId);
        if(!access.canManage) {
            return res.status(403).json({ message: "Forbidden" });
        }

        const [existing] = await db.query(
            "SELECT id FROM project_issue_templates WHERE id = ? AND project_id = ? LIMIT 1",
            [templateId, project.id]
        );
        if(!existing.length) {
            return res.status(404).json({ message: "Template not found" });
        }

        const updates = [];
        const values = [];
        const now = Date.now();

        if(name !== undefined) {
            const safeName = sanitizePlainText(name || "");
            if(!safeName || safeName.length < 2) {
                return res.status(400).json({ message: "Template name is too short" });
            }
            updates.push("name = ?");
            values.push(safeName);
        }

        if(description !== undefined) {
            updates.push("description = ?");
            values.push(sanitizePlainText(description || ""));
        }

        if(content !== undefined) {
            updates.push("content = ?");
            values.push(sanitizeMarkdownText(content || ""));
        }

        if(title_placeholder !== undefined) {
            updates.push("title_placeholder = ?");
            values.push(sanitizePlainText(title_placeholder || ""));
        }

        if(default_labels !== undefined) {
            updates.push("default_labels_json = ?");
            values.push(Array.isArray(default_labels) ? JSON.stringify(default_labels) : null);
        }

        if(default_assignees !== undefined) {
            updates.push("default_assignees_json = ?");
            values.push(Array.isArray(default_assignees) ? JSON.stringify(default_assignees) : null);
        }

        if(default_type !== undefined) {
            updates.push("default_type = ?");
            values.push(default_type || null);
        }

        if(is_archived !== undefined) {
            updates.push("is_archived = ?");
            values.push(is_archived ? 1 : 0);
        }

        if(updates.length === 0) {
            return res.status(400).json({ message: "No changes" });
        }

        updates.push("updated_by = ?");
        values.push(userId);
        updates.push("updated_at = ?");
        values.push(now);

        values.push(templateId, project.id);

        await db.query(
            `UPDATE project_issue_templates SET ${updates.join(", ")} WHERE id = ? AND project_id = ?`,
            values
        );

        return res.json({ success: true });
    } catch (error) {
        console.error("Error updating issue template:", error);
        return res.status(500).json({ message: "Error updating issue template", error: error.message });
    }
});

router.delete("/:slug/issues/templates/:templateId", auth, async (req, res) => {
    try {
        const { slug, templateId } = req.params;
        const userId = req.user?.id;

        if(!userId) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const project = await getProjectBySlug(slug);
        if(!project) {
            return res.status(404).json({ message: "Project not found" });
        }

        const access = await getIssueAccess(project.id, userId);
        if(!access.canManage) {
            return res.status(403).json({ message: "Forbidden" });
        }

        const now = Date.now();
        const [result] = await db.query(
            "UPDATE project_issue_templates SET is_archived = 1, updated_by = ?, updated_at = ? WHERE id = ? AND project_id = ?",
            [userId, now, templateId, project.id]
        );

        if(result.affectedRows === 0) {
            return res.status(404).json({ message: "Template not found" });
        }

        return res.json({ success: true });
    } catch (error) {
        console.error("Error deleting issue template:", error);
        return res.status(500).json({ message: "Error deleting issue template", error: error.message });
    }
});

router.get("/:slug/issues/labels", optionalAuth, async (req, res) => {
    try {
        const { slug } = req.params;
        const viewerId = req.user?.id || null;
        const project = await getProjectBySlug(slug);

        if(!project) {
            return res.status(404).json({ message: "Project not found" });
        }

        const includeArchived = (req.query.include_archived || "").toString().toLowerCase() === "true";
        const access = viewerId ? await getIssueAccess(project.id, viewerId) : { canManage: false };
        const shouldIncludeArchived = includeArchived && access.canManage;
        const shouldRestrictToUserSelectable = !access.canManage;

        const [rows] = await db.query(
            `SELECT id, name, color, user_selectable, is_archived, created_at, updated_at
            FROM project_issue_labels
            WHERE project_id = ? ${shouldIncludeArchived ? "" : "AND is_archived = 0"}
            ${shouldRestrictToUserSelectable ? "AND user_selectable = 1" : ""}
            ORDER BY created_at ASC`,
            [project.id]
        );

        const labels = rows.map((row) => ({
            id: row.id,
            name: row.name,
            color: row.color,
            user_selectable: !!row.user_selectable,
            is_archived: !!row.is_archived,
            created_at: row.created_at,
            updated_at: row.updated_at,
        }));

        return res.json({ labels });
    } catch (error) {
        console.error("Error fetching issue labels:", error);
        return res.status(500).json({ message: "Error fetching issue labels", error: error.message });
    }
});

router.post("/:slug/issues/labels", auth, async (req, res) => {
    try {
        const { slug } = req.params;
        const userId = req.user?.id;
        const { name, color, user_selectable } = req.body || {};

        if(!userId) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const project = await getProjectBySlug(slug);
        if(!project) {
            return res.status(404).json({ message: "Project not found" });
        }

        const access = await getIssueAccess(project.id, userId);
        if(!access.canManage) {
            return res.status(403).json({ message: "Forbidden" });
        }

        const safeName = sanitizePlainText(name || "");
        if(!safeName || safeName.length < 2) {
            return res.status(400).json({ message: "Label name is too short" });
        }

        const normalizedColor = typeof color === "string" ? color.trim().toLowerCase() : "";
        if(!/^#[0-9a-f]{6}$/.test(normalizedColor)) {
            return res.status(400).json({ message: "Invalid label color" });
        }
        const normalizedUserSelectable = !!user_selectable;

        const now = Date.now();
        const [result] = await db.query(
            `INSERT INTO project_issue_labels
            (project_id, name, color, user_selectable, is_archived, created_by, updated_by, created_at, updated_at)
            VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?)`,
            [project.id, safeName, normalizedColor, normalizedUserSelectable ? 1 : 0, userId, userId, now, now]
        );

        return res.status(201).json({
            id: result.insertId,
            name: safeName,
            color: normalizedColor,
            user_selectable: normalizedUserSelectable,
            is_archived: false,
            created_at: now,
            updated_at: now,
        });
    } catch (error) {
        console.error("Error creating issue label:", error);
        return res.status(500).json({ message: "Error creating issue label", error: error.message });
    }
});

router.patch("/:slug/issues/labels/:labelId", auth, async (req, res) => {
    try {
        const { slug, labelId } = req.params;
        const userId = req.user?.id;
        const { name, color, user_selectable, is_archived } = req.body || {};

        if(!userId) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const project = await getProjectBySlug(slug);
        if(!project) {
            return res.status(404).json({ message: "Project not found" });
        }

        const access = await getIssueAccess(project.id, userId);
        if(!access.canManage) {
            return res.status(403).json({ message: "Forbidden" });
        }

        const updates = [];
        const values = [];
        const now = Date.now();

        if(name !== undefined) {
            const safeName = sanitizePlainText(name || "");
            if(!safeName || safeName.length < 2) {
                return res.status(400).json({ message: "Label name is too short" });
            }
            updates.push("name = ?");
            values.push(safeName);
        }

        if(color !== undefined) {
            const normalizedColor = typeof color === "string" ? color.trim().toLowerCase() : "";
            if(!/^#[0-9a-f]{6}$/.test(normalizedColor)) {
                return res.status(400).json({ message: "Invalid label color" });
            }
            updates.push("color = ?");
            values.push(normalizedColor);
        }

        if(is_archived !== undefined) {
            updates.push("is_archived = ?");
            values.push(is_archived ? 1 : 0);
        }

        if(user_selectable !== undefined) {
            updates.push("user_selectable = ?");
            values.push(user_selectable ? 1 : 0);
        }

        if(updates.length === 0) {
            return res.status(400).json({ message: "No changes" });
        }

        updates.push("updated_by = ?");
        values.push(userId);
        updates.push("updated_at = ?");
        values.push(now);

        values.push(labelId, project.id);

        const [result] = await db.query(
            `UPDATE project_issue_labels SET ${updates.join(", ")} WHERE id = ? AND project_id = ?`,
            values
        );

        if(result.affectedRows === 0) {
            return res.status(404).json({ message: "Label not found" });
        }

        return res.json({ success: true });
    } catch (error) {
        console.error("Error updating issue label:", error);
        return res.status(500).json({ message: "Error updating issue label", error: error.message });
    }
});

router.delete("/:slug/issues/labels/:labelId", auth, async (req, res) => {
    try {
        const { slug, labelId } = req.params;
        const userId = req.user?.id;

        if(!userId) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const project = await getProjectBySlug(slug);
        if(!project) {
            return res.status(404).json({ message: "Project not found" });
        }

        const access = await getIssueAccess(project.id, userId);
        if(!access.canManage) {
            return res.status(403).json({ message: "Forbidden" });
        }

        const now = Date.now();
        const [result] = await db.query(
            "UPDATE project_issue_labels SET is_archived = 1, updated_by = ?, updated_at = ? WHERE id = ? AND project_id = ?",
            [userId, now, labelId, project.id]
        );

        if(result.affectedRows === 0) {
            return res.status(404).json({ message: "Label not found" });
        }

        return res.json({ success: true });
    } catch (error) {
        console.error("Error deleting issue label:", error);
        return res.status(500).json({ message: "Error deleting issue label", error: error.message });
    }
});

router.get("/:slug/issues/:issueId", optionalAuth, async (req, res) => {
    try {
        const { slug, issueId } = req.params;
        const viewerId = req.user?.id || null;
        const project = await getProjectBySlug(slug);

        if(!project) {
            return res.status(404).json({ message: "Project not found" });
        }

        const [issues] = await db.query(
            `SELECT i.id, i.title, i.body, i.status, i.created_at, i.updated_at, i.closed_at, i.closed_by, i.template_id,
            i.author_user_id, u.username, u.slug, u.avatar, u.isVerified, u.isRole
            FROM project_issues i
            LEFT JOIN users u ON u.id = i.author_user_id
            WHERE i.project_id = ? AND i.id = ? LIMIT 1`,
            [project.id, issueId]
        );

        if(!issues.length) {
            return res.status(404).json({ message: "Issue not found" });
        }

        const issue = issues[0];
        const access = viewerId ? await getIssueAccess(project.id, viewerId) : { canManage: false, isModerator: false };
        const canModerate = !!access.canManage || !!access.isModerator;

        const [labelRows] = await db.query(
            `SELECT il.label_id, l.name, l.color, l.is_archived
            FROM project_issue_label_links il
            INNER JOIN project_issue_labels l ON l.id = il.label_id
            WHERE il.issue_id = ?
            ORDER BY il.created_at ASC`,
            [issue.id]
        );

        const labels = labelRows.map((row) => ({
            id: row.label_id,
            name: row.name,
            color: row.color,
            is_archived: !!row.is_archived,
        }));

        const commentsQuery = `
            SELECT c.id, c.parent_id, c.content, c.created_at, c.updated_at, c.status, c.user_id,
            u.username, u.slug, u.avatar, u.isVerified, u.isRole
            FROM project_issue_comments c
            LEFT JOIN users u ON c.user_id = u.id
            WHERE c.issue_id = ?
            ${canModerate ? "AND c.status IN ('visible', 'hidden')" : "AND c.status = 'visible'"}
            ORDER BY c.created_at ASC, c.id ASC
        `;

        const [comments] = await db.query(commentsQuery, [issue.id]);

        const formattedComments = comments.map((comment) => {
            const shouldHideContent = !canModerate && comment.status !== "visible";
            return {
                id: comment.id,
                parent_id: comment.parent_id,
                content: shouldHideContent ? null : comment.content,
                created_at: comment.created_at,
                updated_at: comment.updated_at,
                status: comment.status,
                author: {
                    id: comment.user_id,
                    username: comment.username,
                    slug: comment.slug,
                    avatar: comment.avatar,
                    isVerified: comment.isVerified,
                    isRole: comment.isRole,
                },
            };
        });

        const [eventRows] = await db.query(
            `SELECT e.id, e.event_type, e.created_at, e.actor_user_id, e.meta,
            u.username, u.slug, u.avatar, u.isVerified, u.isRole
            FROM project_issue_events e
            LEFT JOIN users u ON u.id = e.actor_user_id
            WHERE e.issue_id = ?
            ORDER BY e.created_at ASC, e.id ASC`,
            [issue.id]
        );

        const events = eventRows.map((row) => ({
            id: row.id,
            type: row.event_type,
            created_at: row.created_at,
            meta: row.meta ? JSON.parse(row.meta) : null,
            actor: row.actor_user_id ? {
                id: row.actor_user_id,
                username: row.username,
                slug: row.slug,
                avatar: row.avatar,
                isVerified: row.isVerified,
                isRole: row.isRole,
            } : null,
        }));

        let availableLabels = [];
        if(access.canManage) {
            const [labelOptions] = await db.query(
                `SELECT id, name, color FROM project_issue_labels WHERE project_id = ? AND is_archived = 0 ORDER BY created_at ASC`,
                [project.id]
            );
            availableLabels = labelOptions;
        }

        const canEditIssue = !!access.canManage || (viewerId && Number(issue.author_user_id) === Number(viewerId));

        return res.json({
            issue: {
                id: issue.id,
                title: issue.title,
                body: issue.body,
                status: issue.status,
                created_at: issue.created_at,
                updated_at: issue.updated_at,
                closed_at: issue.closed_at,
                closed_by: issue.closed_by,
                template_id: issue.template_id,
                labels,
                author: issue.author_user_id ? {
                    id: issue.author_user_id,
                    username: issue.username,
                    slug: issue.slug,
                    avatar: issue.avatar,
                    isVerified: issue.isVerified,
                    isRole: issue.isRole,
                } : null,
            },
            canManage: !!access.canManage,
            canEditIssue: !!canEditIssue,
            canComment: issue.status === "open",
            comments: formattedComments,
            events,
            availableLabels,
        });
    } catch (error) {
        console.error("Error fetching issue:", error);
        return res.status(500).json({ message: "Error fetching issue", error: error.message });
    }
});

router.post("/:slug/issues", auth, async (req, res) => {
    try {
        const { slug } = req.params;
        const userId = req.user?.id;
        const { title, body, template_id, label_ids } = req.body || {};

        if(!userId) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const project = await getProjectBySlug(slug);
        if(!project) {
            return res.status(404).json({ message: "Project not found" });
        }
        const access = await getIssueAccess(project.id, userId);
        const canManageLabels = !!access.canManage;

        const safeTitle = sanitizePlainText(title || "");
        const safeBody = sanitizeMarkdownText(body || "");

        if(!safeTitle || safeTitle.length < 3) {
            return res.status(400).json({ message: "Issue title is too short" });
        }

        let template = null;
        if(template_id) {
            const [templates] = await db.query(
                "SELECT id, default_labels_json FROM project_issue_templates WHERE id = ? AND project_id = ? AND is_archived = 0 LIMIT 1",
                [template_id, project.id]
            );

            template = templates[0] || null;
        }

        const requestedLabelIds = Array.isArray(label_ids) ? [...new Set(
            label_ids.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0)
        )] : [];

        if(requestedLabelIds.length > 0) {
            const [requestedLabels] = await db.query(
                `SELECT id, user_selectable
                FROM project_issue_labels
                WHERE project_id = ? AND is_archived = 0 AND id IN (?)`,
                [project.id, requestedLabelIds]
            );

            if(requestedLabels.length !== requestedLabelIds.length) {
                return res.status(400).json({ message: "Some labels are invalid" });
            }

            if(!canManageLabels) {
                const hasRestricted = requestedLabels.some((label) => !label.user_selectable);
                if(hasRestricted) {
                    return res.status(403).json({ message: "Some labels can only be set by project team" });
                }
            }
        }

        const resolvedTitle = safeTitle;
        const now = Date.now();

        const [result] = await db.query(
            `INSERT INTO project_issues
            (project_id, author_user_id, title, body, status, template_id, created_at, updated_at)
            VALUES (?, ?, ?, ?, 'open', ?, ?, ?)`,
            [project.id, userId, resolvedTitle, safeBody, template?.id || null, now, now]
        );

        const issueId = result.insertId;

        await db.query(
            `INSERT INTO project_issue_events (issue_id, actor_user_id, event_type, meta, created_at)
            VALUES (?, ?, 'issue_opened', ?, ?)`,
            [issueId, userId, JSON.stringify({ title: resolvedTitle }), now]
        );

        let templateLabelIds = [];
        if(template?.default_labels_json) {
            try {
                templateLabelIds = JSON.parse(template.default_labels_json) || [];
            } catch {}
        }

        const allCandidateLabelIds = [...new Set([...requestedLabelIds, ...(Array.isArray(templateLabelIds) ? templateLabelIds : [])].map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0))];

        if(allCandidateLabelIds.length > 0) {
            const [validLabels] = await db.query(
                `SELECT id
                FROM project_issue_labels
                WHERE project_id = ?
                AND is_archived = 0
                AND id IN (?)
                ${canManageLabels ? "" : "AND user_selectable = 1"}`,
                [project.id, allCandidateLabelIds]
            );

            for(const label of validLabels) {
                const [insertResult] = await db.query(
                    "INSERT IGNORE INTO project_issue_label_links (issue_id, label_id, created_at, added_by) VALUES (?, ?, ?, ?)",
                    [issueId, label.id, now, userId]
                );

                if(insertResult.affectedRows) {
                    await db.query(
                        "INSERT INTO project_issue_events (issue_id, actor_user_id, event_type, meta, created_at) VALUES (?, ?, 'label_added', ?, ?)",
                        [issueId, userId, JSON.stringify({ label_id: label.id }), now]
                    );
                }
            }
        }

        return res.status(201).json({
            id: issueId,
            title: resolvedTitle,
            status: "open",
            created_at: now,
        });
    } catch (error) {
        console.error("Error creating issue:", error);
        return res.status(500).json({ message: "Error creating issue", error: error.message });
    }
});

router.patch("/:slug/issues/:issueId", auth, async (req, res) => {
    try {
        const { slug, issueId } = req.params;
        const userId = req.user?.id;
        const { action, title, body } = req.body || {};

        if(!userId) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const project = await getProjectBySlug(slug);
        if(!project) {
            return res.status(404).json({ message: "Project not found" });
        }

        const access = await getIssueAccess(project.id, userId);

        const [issues] = await db.query(
            "SELECT id, status, author_user_id, title, body FROM project_issues WHERE id = ? AND project_id = ? LIMIT 1",
            [issueId, project.id]
        );
        if(!issues.length) {
            return res.status(404).json({ message: "Issue not found" });
        }

        const issue = issues[0];
        const now = Date.now();
        const canEditIssue = !!access.canManage || Number(issue.author_user_id) === Number(userId);
        const hasTitleUpdate = title !== undefined;
        const hasBodyUpdate = body !== undefined;

        if(action && (hasTitleUpdate || hasBodyUpdate)) {
            return res.status(400).json({ message: "Cannot combine action with content changes" });
        }

        if(hasTitleUpdate || hasBodyUpdate) {
            if(!canEditIssue) {
                return res.status(403).json({ message: "Forbidden" });
            }

            const updates = [];
            const values = [];
            const changedFields = [];

            if(hasTitleUpdate) {
                const safeTitle = sanitizePlainText(title || "");
                if(!safeTitle || safeTitle.length < 3) {
                    return res.status(400).json({ message: "Issue title is too short" });
                }

                if(safeTitle !== issue.title) {
                    updates.push("title = ?");
                    values.push(safeTitle);
                    changedFields.push("title");
                }
            }

            if(hasBodyUpdate) {
                const safeBody = sanitizeMarkdownText(body || "");
                if(safeBody !== (issue.body || "")) {
                    updates.push("body = ?");
                    values.push(safeBody);
                    changedFields.push("body");
                }
            }

            if(!updates.length) {
                return res.status(400).json({ message: "No changes" });
            }

            updates.push("updated_at = ?");
            values.push(now);
            values.push(issueId);

            await db.query(
                `UPDATE project_issues SET ${updates.join(", ")} WHERE id = ?`,
                values
            );

            for(const field of changedFields) {
                await db.query(
                    "INSERT INTO project_issue_events (issue_id, actor_user_id, event_type, meta, created_at) VALUES (?, ?, ?, ?, ?)",
                    [issueId, userId, field === "title" ? "issue_title_updated" : "issue_body_updated", JSON.stringify({}), now]
                );
            }

            return res.json({ success: true, updatedFields: changedFields });
        }

        if(!access.canManage) {
            return res.status(403).json({ message: "Forbidden" });
        }

        if(action === "pin" || action === "unpin") {
            const nextPinned = action === "pin" ? 1 : 0;
            
            await db.query(
                "UPDATE project_issues SET is_pinned = ?, updated_at = ? WHERE id = ?",
                [nextPinned, now, issueId]
            );

            return res.json({ success: true, is_pinned: !!nextPinned });
        }

        if(action === "close" && issue.status !== "closed") {
            await db.query(
                "UPDATE project_issues SET status = 'closed', closed_at = ?, closed_by = ?, updated_at = ? WHERE id = ?",
                [now, userId, now, issueId]
            );

            await db.query(
                "INSERT INTO project_issue_events (issue_id, actor_user_id, event_type, meta, created_at) VALUES (?, ?, 'issue_closed', ?, ?)",
                [issueId, userId, JSON.stringify({}), now]
            );

            return res.json({ success: true, status: "closed" });
        }

        if(action === "reopen" && issue.status !== "open") {
            await db.query(
                "UPDATE project_issues SET status = 'open', closed_at = NULL, closed_by = NULL, updated_at = ? WHERE id = ?",
                [now, issueId]
            );

            await db.query(
                "INSERT INTO project_issue_events (issue_id, actor_user_id, event_type, meta, created_at) VALUES (?, ?, 'issue_reopened', ?, ?)",
                [issueId, userId, JSON.stringify({}), now]
            );

            return res.json({ success: true, status: "open" });
        }

        return res.status(400).json({ message: "Invalid action" });
    } catch (error) {
        console.error("Error updating issue status:", error);
        return res.status(500).json({ message: "Error updating issue status", error: error.message });
    }
});

router.delete("/:slug/issues/:issueId", auth, async (req, res) => {
    let connection = null;

    try {
        const { slug, issueId } = req.params;
        const userId = req.user?.id;

        if(!userId) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const project = await getProjectBySlug(slug);
        if(!project) {
            return res.status(404).json({ message: "Project not found" });
        }

        const access = await getIssueAccess(project.id, userId);
        if(!access.canManage) {
            return res.status(403).json({ message: "Forbidden" });
        }

        connection = await db.getConnection();
        await connection.beginTransaction();

        const [issues] = await connection.query(
            "SELECT id FROM project_issues WHERE id = ? AND project_id = ? LIMIT 1",
            [issueId, project.id]
        );
        if(!issues.length) {
            await connection.rollback();
            return res.status(404).json({ message: "Issue not found" });
        }

        await connection.query("DELETE FROM project_issue_comments WHERE issue_id = ?", [issueId]);
        await connection.query("DELETE FROM project_issue_events WHERE issue_id = ?", [issueId]);
        await connection.query("DELETE FROM project_issue_label_links WHERE issue_id = ?", [issueId]);
        await connection.query("DELETE FROM project_issues WHERE id = ? AND project_id = ?", [issueId, project.id]);

        await connection.commit();
        return res.json({ success: true });
    } catch (error) {
        if(connection) {
            await connection.rollback();
        }

        console.error("Error deleting issue:", error);
        return res.status(500).json({ message: "Error deleting issue", error: error.message });
    } finally {
        if(connection) {
            connection.release();
        }
    }
});

router.post("/:slug/issues/:issueId/labels", auth, async (req, res) => {
    try {
        const { slug, issueId } = req.params;
        const userId = req.user?.id;
        const { label_id, action } = req.body || {};

        if(!userId) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const project = await getProjectBySlug(slug);
        if(!project) {
            return res.status(404).json({ message: "Project not found" });
        }

        const access = await getIssueAccess(project.id, userId);
        if(!access.canManage) {
            return res.status(403).json({ message: "Forbidden" });
        }

        const [issues] = await db.query(
            "SELECT id FROM project_issues WHERE id = ? AND project_id = ? LIMIT 1",
            [issueId, project.id]
        );
        if(!issues.length) {
            return res.status(404).json({ message: "Issue not found" });
        }

        const [labels] = await db.query(
            "SELECT id FROM project_issue_labels WHERE id = ? AND project_id = ? AND is_archived = 0 LIMIT 1",
            [label_id, project.id]
        );
        if(!labels.length) {
            return res.status(404).json({ message: "Label not found" });
        }

        const now = Date.now();
        if(action === "add") {
            const [existing] = await db.query(
                "SELECT id FROM project_issue_label_links WHERE issue_id = ? AND label_id = ? LIMIT 1",
                [issueId, label_id]
            );

            if(existing.length) {
                return res.json({ success: true });
            }

            const [insertResult] = await db.query(
                "INSERT IGNORE INTO project_issue_label_links (issue_id, label_id, created_at, added_by) VALUES (?, ?, ?, ?)",
                [issueId, label_id, now, userId]
            );

            if(insertResult.affectedRows) {
                await db.query(
                    "INSERT INTO project_issue_events (issue_id, actor_user_id, event_type, meta, created_at) VALUES (?, ?, 'label_added', ?, ?)",
                    [issueId, userId, JSON.stringify({ label_id }), now]
                );
            }

            return res.json({ success: true });
        }

        if(action === "remove") {
            const [result] = await db.query(
                "DELETE FROM project_issue_label_links WHERE issue_id = ? AND label_id = ?",
                [issueId, label_id]
            );

            if(result.affectedRows) {
                await db.query(
                    "INSERT INTO project_issue_events (issue_id, actor_user_id, event_type, meta, created_at) VALUES (?, ?, 'label_removed', ?, ?)",
                    [issueId, userId, JSON.stringify({ label_id }), now]
                );
            }

            return res.json({ success: true });
        }

        return res.status(400).json({ message: "Invalid action" });
    } catch (error) {
        console.error("Error updating issue labels:", error);
        return res.status(500).json({ message: "Error updating issue labels", error: error.message });
    }
});

router.post("/:slug/issues/:issueId/comments", auth, async (req, res) => {
    try {
        const { slug, issueId } = req.params;
        const userId = req.user?.id;
        const { content, parent_id } = req.body || {};

        if(!userId) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const project = await getProjectBySlug(slug);
        if(!project) {
            return res.status(404).json({ message: "Project not found" });
        }

        const [issues] = await db.query(
            "SELECT id, status FROM project_issues WHERE id = ? AND project_id = ? LIMIT 1",
            [issueId, project.id]
        );
        if(!issues.length) {
            return res.status(404).json({ message: "Issue not found" });
        }

        if(issues[0].status !== "open") {
            return res.status(403).json({ message: "Issue is closed" });
        }

        const trimmed = sanitizeMarkdownText(content || "");
        if(!trimmed || trimmed.length < 1) {
            return res.status(400).json({ message: "Comment is too short" });
        }

        if(trimmed.length > 8000) {
            return res.status(400).json({ message: "Comment is too long" });
        }

        const [lastComment] = await db.query(
            "SELECT created_at FROM project_issue_comments WHERE user_id = ? ORDER BY created_at DESC LIMIT 1",
            [userId]
        );

        const now = Date.now();
        if(lastComment.length && now - Number(lastComment[0].created_at || 0) < 15000) {
            return res.status(429).json({ message: "Rate limited" });
        }

        if(parent_id) {
            const [parent] = await db.query(
                "SELECT id FROM project_issue_comments WHERE id = ? AND issue_id = ? LIMIT 1",
                [parent_id, issueId]
            );

            if(!parent.length) {
                return res.status(400).json({ message: "Parent comment not found" });
            }
        }

        const normalized = normalizeComment(trimmed);
        const [recent] = await db.query(
            "SELECT content FROM project_issue_comments WHERE user_id = ? AND created_at > ? ORDER BY created_at DESC LIMIT 5",
            [userId, now - 60 * 60 * 1000]
        );
        if(recent.some((row) => normalizeComment(row.content || "") === normalized)) {
            return res.status(429).json({ message: "Duplicate content" });
        }

        const [result] = await db.query(
            "INSERT INTO project_issue_comments (issue_id, user_id, parent_id, content, status, created_at, updated_at) VALUES (?, ?, ?, ?, 'visible', ?, ?)",
            [issueId, userId, parent_id || null, trimmed, now, now]
        );

        const [users] = await db.query("SELECT id, username, slug, avatar, isVerified, isRole FROM users WHERE id = ? LIMIT 1", [userId]);
        const author = users[0];

        return res.status(201).json({
            id: result.insertId,
            parent_id: parent_id || null,
            content: trimmed,
            created_at: now,
            updated_at: now,
            status: "visible",
            author: {
                id: author.id,
                username: author.username,
                slug: author.slug,
                avatar: author.avatar,
                isVerified: author.isVerified,
                isRole: author.isRole,
            },
        });
    } catch (error) {
        console.error("Error creating issue comment:", error);
        return res.status(500).json({ message: "Error creating issue comment", error: error.message });
    }
});

router.patch("/:slug/issues/:issueId/comments/:commentId", auth, async (req, res) => {
    try {
        const { slug, issueId, commentId } = req.params;
        const { action, content } = req.body || {};
        const userId = req.user?.id;

        if(!userId) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const project = await getProjectBySlug(slug);
        if(!project) {
            return res.status(404).json({ message: "Project not found" });
        }

        const access = await getIssueAccess(project.id, userId);
        const canModerate = access.canManage || access.isModerator;

        const [comments] = await db.query(
            "SELECT id, user_id, status, content FROM project_issue_comments WHERE id = ? AND issue_id = ? LIMIT 1",
            [commentId, issueId]
        );

        if(!comments.length) {
            return res.status(404).json({ message: "Comment not found" });
        }

        const comment = comments[0];
        const now = Date.now();

        if(action === "edit") {
            const isAuthor = Number(comment.user_id) === Number(userId);
            if(!isAuthor && !canModerate) {
                return res.status(403).json({ message: "Forbidden" });
            }

            if(comment.status === "deleted") {
                return res.status(400).json({ message: "Comment is deleted" });
            }

            const trimmed = sanitizeMarkdownText(content || "");
            if(!trimmed || trimmed.length < 1) {
                return res.status(400).json({ message: "Comment is too short" });
            }

            if(trimmed.length > 8000) {
                return res.status(400).json({ message: "Comment is too long" });
            }

            if(trimmed === (comment.content || "")) {
                return res.status(400).json({ message: "No changes" });
            }

            await db.query(
                "UPDATE project_issue_comments SET content = ?, updated_at = ? WHERE id = ?",
                [trimmed, now, commentId]
            );

            return res.json({ success: true, content: trimmed, updated_at: now });
        }

        if(action === "delete") {
            if(!canModerate && Number(comment.user_id) !== Number(userId)) {
                return res.status(403).json({ message: "Forbidden" });
            }

            await db.query(
                "UPDATE project_issue_comments SET status = 'deleted', content = NULL, updated_at = ? WHERE id = ?",
                [now, commentId]
            );

            return res.json({ success: true });
        }

        if(action === "hide" && canModerate) {
            await db.query("UPDATE project_issue_comments SET status = 'hidden', updated_at = ? WHERE id = ?", [now, commentId]);
            return res.json({ success: true });
        }

        if(action === "show" && canModerate) {
            await db.query("UPDATE project_issue_comments SET status = 'visible', updated_at = ? WHERE id = ?", [now, commentId]);
            return res.json({ success: true });
        }

        return res.status(400).json({ message: "Invalid action" });
    } catch (error) {
        console.error("Error moderating issue comment:", error);
        return res.status(500).json({ message: "Error moderating issue comment", error: error.message });
    }
});

router.post('/:slug/like', auth, async (req, res) => {
    const { slug } = req.params;
    const userId = req.user.id;

    try {
        const [project] = await db.query('SELECT id, user_id FROM projects WHERE slug = ? AND status = "approved"', [slug]);
        if(!project.length) {
            return res.status(404).json({ message: 'Project not found' });
        }

        const projectId = project[0].id;

        const [existingLike] = await db.query('SELECT 1 FROM project_likes WHERE project_id = ? AND user_id = ?', [projectId, userId]);
        if(existingLike.length) {
            return res.status(400).json({ message: 'You have already liked this project' });
        }

        await db.query('INSERT INTO project_likes (project_id, user_id, created_at) VALUES (?, ?, ?)', [projectId, userId, Math.floor(Date.now() / 1000)]);
        await deleteCacheByPattern(`user_likes_${userId}_*`);

        await db.query('UPDATE projects SET followers = followers + 1 WHERE id = ?', [projectId]);

        if(project[0].user_id && project[0].user_id !== userId) {
            await db.query(
                `INSERT INTO notification_events
                (recipient_user_id, actor_user_id, event_type, object_type, object_id, created_at)
                VALUES (?, ?, 'project_like', 'project', ?, ?)
                ON DUPLICATE KEY UPDATE created_at = VALUES(created_at)`,
                [project[0].user_id, userId, String(projectId), Math.floor(Date.now() / 1000)]
            );
        }

        const [[{ followers }]] = await db.query('SELECT COUNT(*) AS followers FROM project_likes WHERE project_id = ?', [projectId]);

        res.json({ success: true, message: 'Project liked', followers, is_liked: true });
    } catch (error) {
        console.error('Error liking project:', error);
        res.status(500).json({ message: 'Error liking project', error: error.message });
    }
});

router.delete('/:slug/like', auth, async (req, res) => {
    const { slug } = req.params;
    const userId = req.user.id;

    try {
        const [project] = await db.query('SELECT id, user_id FROM projects WHERE slug = ? AND status = "approved"', [slug]);
        if(!project.length) {
            return res.status(404).json({ message: 'Project not found' });
        }

        const projectId = project[0].id;

        const [existingLike] = await db.query('SELECT 1 FROM project_likes WHERE project_id = ? AND user_id = ?', [projectId, userId]);
        if(!existingLike.length) {
            return res.status(400).json({ message: 'You have not liked this project' });
        }

        await db.query('DELETE FROM project_likes WHERE project_id = ? AND user_id = ?', [projectId, userId]);
        await deleteCacheByPattern(`user_likes_${userId}_*`);

        await db.query('UPDATE projects SET followers = followers - 1 WHERE id = ?', [projectId]);

        if(project[0].user_id && project[0].user_id !== userId) {
            await db.query(
                `DELETE FROM notification_events
                WHERE recipient_user_id = ?
                AND actor_user_id = ?
                AND event_type = 'project_like'
                AND object_type = 'project'
                AND object_id = ?`,
                [project[0].user_id, userId, String(projectId)]
            );
        }

        const [[{ followers }]] = await db.query('SELECT COUNT(*) AS followers FROM project_likes WHERE project_id = ?', [projectId]);

        res.json({ success: true, message: 'Project unliked', followers, is_liked: false });
    } catch (error) {
        console.error('Error unliking project:', error);
        res.status(500).json({ message: 'Error unliking project', error: error.message });
    }
});

router.post('/:slug/view', async (req, res) => {
    const { slug } = req.params;
    const ipAddress = getRequestIpAddress(req);
    const countryCode = getRequestCountryCode(req);

    try {
        const [project] = await db.query('SELECT id, slug FROM projects WHERE slug = ?', [slug]);
        if(!project.length) {
            return res.status(404).json({ message: 'Project not found' });
        }

        const projectSlug = project[0].slug;
        const windowMinutes = 360;
        const shouldCount = ipAddress ? !(await hasRecentProjectEvent({
            projectSlug,
            eventType: "view",
            ipAddress,
            windowMinutes,
        })) : false;

        if(shouldCount) {
            await insertProjectEvent({
                projectSlug,
                eventType: 'view',
                ipAddress,
                countryCode,
            });
            await db.query('UPDATE projects SET views = views + 1 WHERE id = ?', [project[0].id]);
            await bumpProjectCacheVersion(projectSlug);
        }

        const [[{ totalViews }]] = await db.query(
            'SELECT views AS totalViews FROM projects WHERE id = ?',
            [project[0].id]
        );

        res.json({ success: true, counted: shouldCount, windowMinutes, totalViews });
    } catch (error) {
        console.error('Error tracking view:', error);
        res.status(500).json({ message: 'Error tracking view', error: error.message });
    }
});

router.get('/user/projects/analytics', auth, async (req, res) => {
    try {
        const { time_range = '30d', project_id } = req.query;
        const userId = req.user.id;

        const params = [userId];
        let query = `
            SELECT p.id, p.slug, p.title
            FROM projects p
            WHERE p.user_id = ? AND p.status = 'approved'
        `;

        if(project_id) {
            query += ' AND p.id = ?';
            params.push(project_id);
        }

        query += ' ORDER BY p.id ASC';

        const [projects] = await db.query(query, params);

        const projectsMap = {};
        const projectSlugToId = new Map();

        projects.forEach((projectRow) => {
            projectsMap[projectRow.id] = {
                id: projectRow.id,
                slug: projectRow.slug,
                title: projectRow.title,
                data: [],
            };
            projectSlugToId.set(projectRow.slug, projectRow.id);
        });

        const analyticsRows = await getProjectEventRows({
            projectSlugs: projects.map((projectRow) => projectRow.slug),
            timeRange: time_range,
        });

        analyticsRows.forEach((row) => {
            const projectId = projectSlugToId.get(row.project_slug);
            if(!projectId || !projectsMap[projectId]) {
                return;
            }

            projectsMap[projectId].data.push({
                date: row.date,
                type: row.event_type,
                count: Number(row.count),
            });
        });

        res.json({ analytics: Object.values(projectsMap) });
    } catch (error) {
        console.error('Error fetching project analytics:', error);
        res.status(500).json({ message: 'Error fetching project analytics', error: error.message });
    }
});

router.get("/:slug/analytics", auth, async (req, res) => {
    try {
        const { slug } = req.params;
        const userId = req.user.id;
        const normalizedTimeRange = getProjectAnalyticsTimeRange(String(req.query.time_range || "7d"));

        const project = await getProjectBySlug(slug);
        if(!project) {
            return res.status(404).json({ message: "Project not found" });
        }

        const [access, userRole] = await Promise.all([
            getProjectAccess({ project, userId }),
            getUserRole(userId),
        ]);
        const isModerator = userRole === "admin" || userRole === "moderator";
        const canAccess = isModerator
            || hasProjectPermission(access, ORG_PROJECT_PERMISSIONS.EDIT_DETAILS)
            || hasProjectPermission(access, ORG_PROJECT_PERMISSIONS.EDIT_BODY)
            || hasProjectPermission(access, ORG_PROJECT_PERMISSIONS.EDIT_GALLERY)
            || hasProjectPermission(access, ORG_PROJECT_PERMISSIONS.MANAGE_VERSIONS);

        if(!canAccess) {
            return res.status(403).json({
                message: "Access denied. You do not have permissions to view this project analytics.",
            });
        }

        const cacheKey = `modifold_project_settings_analytics_${slug}_${normalizedTimeRange}`;
        const cachedAnalytics = await getCacheJson(cacheKey);
        if(cachedAnalytics) {
            return res.json(cachedAnalytics);
        }

        const { days } = PROJECT_ANALYTICS_TIME_RANGES[normalizedTimeRange];

        const [downloads, views, countries] = await Promise.all([
            getProjectEventSeries({ projectSlug: slug, eventType: "download", days }),
            getProjectEventSeries({ projectSlug: slug, eventType: "view", days }),
            getProjectDownloadCountries({ projectSlug: slug, days }),
        ]);

        const responseData = {
            slug,
            time_range: normalizedTimeRange,
            downloads,
            views,
            countries,
            totals: {
                downloads: downloads.reduce((sum, point) => sum + point.count, 0),
                views: views.reduce((sum, point) => sum + point.count, 0),
                countries: countries.reduce((sum, country) => sum + country.count, 0),
            },
        };

        await setCacheJson(cacheKey, responseData, 60 * 5);

        res.json(responseData);
    } catch (error) {
        console.error("Error fetching project analytics page data:", error);
        res.status(500).json({ message: "Error fetching project analytics", error: error.message });
    }
});

router.get('/:slug/version/:version_number', optionalAuth, async (req, res) => {
    const { slug, version_number } = req.params;

    try {
        const [project] = await db.query('SELECT id, user_id, slug FROM projects WHERE slug = ?', [slug]);
        if(!project.length) {
            return res.status(404).json({ message: 'Project not found' });
        }

        const [version] = await db.query(
            'SELECT id, project_id, version_number, downloads, changelog, release_channel, game_versions, loaders, file_url, file_size, created_at, moderation_status, moderation_reason FROM project_versions WHERE project_id = ? AND id = ?',
            [project[0].id, version_number]
        );

        const canViewModerationFields = await canViewPrivateProjectVersions(project[0], req.user?.id || null);

        if(!version.length || (version[0].moderation_status !== "approved" && !canViewModerationFields)) {
            return res.status(404).json({ message: 'Version not found' });
        }

        const dependencies = await getVersionDependencies(db, version[0].id);
        const safeVersion = sanitizeVersionForPublicResponse(version[0], { includeModeration: canViewModerationFields });

        res.json({
            ...safeVersion,
            game_versions: version[0].game_versions ? JSON.parse(version[0].game_versions) : [],
            loaders: version[0].loaders ? JSON.parse(version[0].loaders) : [],
            files: version[0].file_url ? [{ url: version[0].file_url, size: version[0].file_size, primary: true }] : [],
            dependencies,
        });
    } catch (error) {
        console.error('Error fetching version:', error);
        res.status(500).json({ message: 'Error fetching version', error: error.message });
    }
});

router.get("/:slug/settings", auth, async (req, res) => {
    try {
        const { slug } = req.params;
        const userId = req.user.id;

        const project = await getProjectBySlug(slug);
        if(!project) {
            return res.status(404).json({ message: "Project not found" });
        }

        const [access, userRole] = await Promise.all([
            getProjectAccess({ project, userId }),
            getUserRole(userId),
        ]);
        const isModerator = userRole === "admin" || userRole === "moderator";
        const canAccess = isModerator || hasProjectPermission(access, ORG_PROJECT_PERMISSIONS.EDIT_DETAILS) || hasProjectPermission(access, ORG_PROJECT_PERMISSIONS.EDIT_BODY) || hasProjectPermission(access, ORG_PROJECT_PERMISSIONS.EDIT_GALLERY) || hasProjectPermission(access, ORG_PROJECT_PERMISSIONS.MANAGE_VERSIONS);
        
        if(!canAccess) {
            return res.status(403).json({
                message: "Access denied. You do not have permissions to edit this project.",
            });
        }

        const [rows] = await db.query("SELECT * FROM projects WHERE id = ? LIMIT 1", [project.id]);
        const projectRow = rows[0];

        const [organizationRows] = await db.query(
            `SELECT
            o.id,
            o.slug,
            o.name,
            o.summary,
            o.icon_url
            FROM organization_projects op
            INNER JOIN organizations o ON o.id COLLATE utf8mb4_unicode_ci = op.organization_id COLLATE utf8mb4_unicode_ci
            WHERE op.project_id = ?
            LIMIT 1`,
            [project.id]
        );

        const [organizationOptionRows] = await db.query(
            `SELECT
            o.id,
            o.slug,
            o.name,
            o.summary,
            o.icon_url,
            o.owner_user_id,
            om.organization_permissions
            FROM organization_members om
            INNER JOIN organizations o ON o.id COLLATE utf8mb4_unicode_ci = om.organization_id COLLATE utf8mb4_unicode_ci
            WHERE om.user_id = ?
            AND om.status = 'accepted'
            ORDER BY o.updated_at DESC`,
            [req.user.id]
        );

        const organizationOptions = organizationOptionRows.filter((row) => {
            if(Number(row.owner_user_id) === Number(req.user.id)) {
                return true;
            }

            const permissions = new Set(parsePermissions(row.organization_permissions));
            return permissions.has(ORG_PERMISSIONS.ADD_PROJECT);
        }).map((row) => ({
            id: row.id,
            slug: row.slug,
            name: row.name,
            summary: row.summary || "",
            icon_url: row.icon_url || "https://media.modifold.com/static/no-project-icon.svg",
        }));

        const currentOrganization = organizationRows[0] ? {
            id: organizationRows[0].id,
            slug: organizationRows[0].slug,
            name: organizationRows[0].name,
            summary: organizationRows[0].summary || "",
            icon_url: organizationRows[0].icon_url || "https://media.modifold.com/static/no-project-icon.svg",
        } : null;

        if(currentOrganization && !organizationOptions.some((item) => item.slug === currentOrganization.slug)) {
            organizationOptions.unshift(currentOrganization);
        }

        res.json({
            ...projectRow,
            organization: currentOrganization,
            organization_options: organizationOptions,
            permissions: {
                can_edit_details: hasProjectPermission(access, ORG_PROJECT_PERMISSIONS.EDIT_DETAILS),
                can_edit_body: hasProjectPermission(access, ORG_PROJECT_PERMISSIONS.EDIT_BODY),
                can_edit_gallery: hasProjectPermission(access, ORG_PROJECT_PERMISSIONS.EDIT_GALLERY),
                can_manage_versions: hasProjectPermission(access, ORG_PROJECT_PERMISSIONS.MANAGE_VERSIONS),
                can_delete_project: hasProjectPermission(access, ORG_PROJECT_PERMISSIONS.DELETE_PROJECT),
            },
        });
    } catch (error) {
        console.error("Error fetching project settings:", error);
        res.status(500).json({ message: "Server error" });
    }
});

router.get("/:slug/moderation-history", auth, async (req, res) => {
    const { slug } = req.params;

    try {
        const [project] = await db.query(
            "SELECT id, user_id FROM projects WHERE slug = ?",
            [slug]
        );

        if(project.length === 0) {
            return res.status(404).json({ message: "Project not found" });
        }

        const access = await getProjectAccess({ project: project[0], userId: req.user.id });
        if(!hasProjectPermission(access, ORG_PROJECT_PERMISSIONS.EDIT_DETAILS)) {
            return res.status(403).json({ message: "You do not have permission to view this project's moderation history" });
        }

        const projectId = project[0].id;

		const [logs] = await db.query(`
			SELECT 
			ml.id,
			ml.action,
			ml.reason,
			ml.created_at
			FROM project_moderation_logs ml
			WHERE ml.project_id = ?
			ORDER BY ml.created_at DESC
		`, [projectId]);

		const history = logs.map(log => ({
			id: log.id,
			action: log.action,
			reason: log.reason,
			createdAt: log.created_at,
		}));

        res.json({
            success: true,
            history
        });
    } catch (error) {
        console.error("Error fetching moderation history:", error);
        res.status(500).json({ 
            message: "Failed to fetch moderation history",
            error: error.message 
        });
    }
});

router.get("/license/:licenseKey", async (req, res) => {
    const { licenseKey } = req.params;

    try {
        const githubRes = await fetch(`https://api.github.com/licenses/${licenseKey.toLowerCase()}`, {
            headers: {
                Accept: "application/vnd.github.v3+json",
                "User-Agent": "Modifold/1.0 (support@modifold.com)",
            },
        });

        if(!githubRes.ok) {
            if(githubRes.status === 404) {
                return res.status(404).json({ message: "License not found" });
            }

            throw new Error("GitHub API error");
        }

        const data = await githubRes.json();

        res.json({
            key: data.key,
            name: data.name,
            spdx_id: data.spdx_id,
            body: data.body,
            html_url: data.html_url,
        });
    } catch (err) {
        console.error("License fetch error:", err);
        res.status(500).json({ message: "Failed to fetch license text" });
    }
});

router.get("/:slug/organization-options", auth, async (req, res) => {
    try {
        const project = await getProjectBySlug(req.params.slug);
        if(!project) {
            return res.status(404).json({ message: "Project not found" });
        }

        const projectAccess = await requireProjectPermission(res, {
            project,
            userId: req.user.id,
            permission: ORG_PROJECT_PERMISSIONS.EDIT_DETAILS,
        });

        if(!projectAccess) {
            return;
        }

        const [rows] = await db.query(
            `SELECT
            o.id,
            o.slug,
            o.name,
            o.summary,
            o.icon_url,
            o.owner_user_id,
            om.organization_permissions
            FROM organization_members om
            INNER JOIN organizations o ON o.id COLLATE utf8mb4_unicode_ci = om.organization_id COLLATE utf8mb4_unicode_ci
            WHERE om.user_id = ?
            AND om.status = 'accepted'
            ORDER BY o.updated_at DESC`,
            [req.user.id]
        );

        const organizations = rows.filter((row) => {
            if(Number(row.owner_user_id) === Number(req.user.id)) {
                return true;
            }

            const permissions = new Set(parsePermissions(row.organization_permissions));
            return permissions.has(ORG_PERMISSIONS.ADD_PROJECT);
        }).map((row) => ({
            id: row.id,
            slug: row.slug,
            name: row.name,
            summary: row.summary || "",
            icon_url: row.icon_url || "https://media.modifold.com/static/no-project-icon.svg",
        }));

        return res.json({ organizations });
    } catch (error) {
        console.error("Error fetching project organization options:", error);
        return res.status(500).json({ message: "Error fetching organizations" });
    }
});

router.put("/:slug/organization", auth, async (req, res) => {
    try {
        const project = await getProjectBySlug(req.params.slug);
        if(!project) {
            return res.status(404).json({ message: "Project not found" });
        }

        const targetOrganizationSlug = sanitizePlainText(req.body?.organization_slug || "");
        const now = Math.floor(Date.now() / 1000);

        const [currentRows] = await db.query(
            `SELECT op.organization_id, o.slug AS organization_slug
            FROM organization_projects op
            INNER JOIN organizations o ON o.id COLLATE utf8mb4_unicode_ci = op.organization_id COLLATE utf8mb4_unicode_ci
            WHERE op.project_id = ?
            LIMIT 1`,
            [project.id]
        );

        const current = currentRows[0] || null;

        if(!targetOrganizationSlug) {
            if(!current) {
                return res.json({ success: true, organization: null });
            }

            const projectAccess = await resolveProjectAccess(db, project.id, req.user.id);
            const currentOrgAccess = await getOrganizationMemberAccess(db, current.organization_id, req.user.id);
            const canRemove = projectAccess.isOwner || hasOrganizationPermission(currentOrgAccess, ORG_PERMISSIONS.REMOVE_PROJECT);

            if(!canRemove) {
                return res.status(403).json({ message: "You do not have permission to remove this project from organization" });
            }

            await db.query("DELETE FROM organization_projects WHERE project_id = ?", [project.id]);
            await logOrganizationAudit(db, {
                organizationId: current.organization_id,
                actorUserId: req.user.id,
                action: "organization_project_detached",
                targetType: "project",
                targetId: project.id,
                metadata: { project_slug: project.slug },
            });

            await bumpProjectCacheVersion(project.slug);

            return res.json({ success: true, organization: null });
        }

        const projectAccess = await requireProjectPermission(res, {
            project,
            userId: req.user.id,
            permission: ORG_PROJECT_PERMISSIONS.EDIT_DETAILS,
        });

        if(!projectAccess) {
            return;
        }

        const [targetOrgRows] = await db.query(
            "SELECT id, slug, name, summary, icon_url FROM organizations WHERE slug = ? LIMIT 1",
            [targetOrganizationSlug]
        );

        if(!targetOrgRows.length) {
            return res.status(404).json({ message: "Organization not found" });
        }

        const targetOrganization = targetOrgRows[0];

        const targetOrgAccess = await getOrganizationMemberAccess(db, targetOrganization.id, req.user.id);
        const canAddToTarget = hasOrganizationPermission(targetOrgAccess, ORG_PERMISSIONS.ADD_PROJECT);
        if(!canAddToTarget) {
            return res.status(403).json({ message: "You do not have permission to add projects to this organization" });
        }

        if(current && current.organization_id !== targetOrganization.id) {
            const currentOrgAccess = await getOrganizationMemberAccess(db, current.organization_id, req.user.id);
            const canRemoveFromCurrent = projectAccess.isOwner || hasOrganizationPermission(currentOrgAccess, ORG_PERMISSIONS.REMOVE_PROJECT);
            if(!canRemoveFromCurrent) {
                return res.status(403).json({ message: "You do not have permission to move project between organizations" });
            }
        }

        await db.query(
            `INSERT INTO organization_projects (organization_id, project_id, attached_by_user_id, created_at)
            VALUES (?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
            organization_id = VALUES(organization_id),
            attached_by_user_id = VALUES(attached_by_user_id),
            created_at = VALUES(created_at)`,
            [targetOrganization.id, project.id, req.user.id, now]
        );

        await logOrganizationAudit(db, {
            organizationId: targetOrganization.id,
            actorUserId: req.user.id,
            action: current ? "organization_project_moved_in" : "organization_project_attached",
            targetType: "project",
            targetId: project.id,
            metadata: {
                project_slug: project.slug,
                from_organization_id: current?.organization_id || null,
            },
        });

        if(current && current.organization_id !== targetOrganization.id) {
            await logOrganizationAudit(db, {
                organizationId: current.organization_id,
                actorUserId: req.user.id,
                action: "organization_project_moved_out",
                targetType: "project",
                targetId: project.id,
                metadata: {
                    project_slug: project.slug,
                    to_organization_id: targetOrganization.id,
                },
            });
        }

        await bumpProjectCacheVersion(project.slug);

        return res.json({
            success: true,
            organization: {
                id: targetOrganization.id,
                slug: targetOrganization.slug,
                name: targetOrganization.name,
                summary: targetOrganization.summary || "",
                icon_url: targetOrganization.icon_url || "https://media.modifold.com/static/no-project-icon.svg",
            },
        });
    } catch (error) {
        console.error("Error attaching organization to project:", error);
        return res.status(500).json({ message: "Error updating project organization" });
    }
});

module.exports = router;