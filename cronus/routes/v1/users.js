const express = require("express");
const crypto = require("crypto");
const { db } = require("../../config/db");
const { clickhouse, hasClickHouseConfig } = require("../../config/clickhouse");
const auth = require("../../middleware/auth");
const { getCacheJson, setCacheJson } = require("../../utils/cache");
const router = express.Router();
const multer = require("multer");
const sharp = require("sharp");
const fs = require("fs").promises;
const path = require("path");
const { sanitizePlainText, sanitizeSocialLinks } = require("../../utils/sanitize");
const { normalizeSlugInput, validateSlug, getSlugValidationMessage } = require("../../utils/slug");

const storage = multer.diskStorage({
    destination: process.env.MEDIA_ROOT,
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`);
    },
});

const fileFilter = (req, file, cb) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/gif"];
    if(allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error("Invalid file type. Only images (JPEG, PNG, GIF) are allowed."), false);
    }
};

const upload = multer({
    storage,
    limits: {
        fileSize: 20 * 1024 * 1024,
    },
    fileFilter,
});

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

const convertImageToWebp = async (file) => {
    if(!file) {
        return file;
    }

    const mimeType = (file.mimetype || "").toLowerCase();
    if(mimeType === "image/gif") {
        return file;
    }

    const fileNameWithoutExt = path.parse(file.filename).name;
    const webpFilename = `${fileNameWithoutExt}.webp`;
    const webpPath = path.join(path.dirname(file.path), webpFilename);

    const webpBuffer = await sharp(file.path).rotate().webp({ quality: 82, effort: 4 }).toBuffer();

    await fs.writeFile(webpPath, webpBuffer);
    if(webpPath !== file.path) {
        await fs.unlink(file.path);
    }

    return {
        ...file,
        filename: webpFilename,
        path: webpPath,
        mimetype: "image/webp",
    };
};

router.put("/me", auth, upload.fields([{ name: "avatar" }]), async (req, res) => {
    const { username, slug, description, social_links } = req.body;
    let avatarFile = req.files?.avatar?.[0];

    try {
        if(avatarFile) {
            avatarFile = await convertImageToWebp(avatarFile);
        }

        const [currentUserRows] = await db.query("SELECT slug FROM users WHERE id = ? LIMIT 1", [req.user.id]);
        const currentUser = currentUserRows[0];

        if(!currentUser) {
            return res.status(404).json({ message: "User not found" });
        }

        const updates = {};

        if(username) {
            updates.username = sanitizePlainText(username);
        }

        if(avatarFile) {
            updates.avatar = `https://media.modifold.com/${avatarFile.filename}`;
        }

        if(description !== undefined) {
            updates.description = description ? sanitizePlainText(description, { preserveNewlines: true }) : "";
        }

        if(slug !== undefined) {
            const currentSlug = String(currentUser.slug || "").toLowerCase();
            const normalizedSlug = normalizeSlugInput(slug);

            if(normalizedSlug !== currentSlug) {
                const validation = validateSlug(normalizedSlug);
                if(!validation.valid) {
                    return res.status(400).json({ message: getSlugValidationMessage(validation.reason), code: validation.reason });
                }

                const [slugRows] = await db.query("SELECT 1 FROM users WHERE slug = ? AND id <> ? LIMIT 1", [validation.normalized, req.user.id]);
                if(slugRows.length > 0) {
                    return res.status(400).json({ message: "This URL is already taken", code: "slug_taken" });
                }

                updates.slug = validation.normalized;
            }
        }

        if(social_links) {
            const parsedSocialLinks = typeof social_links === "string" ? JSON.parse(social_links) : social_links;
            updates.social_links = JSON.stringify(sanitizeSocialLinks(parsedSocialLinks));
        }

        if(!Object.keys(updates).length) {
            return res.status(400).json({ message: "No data available for update" });
        }

        await db.query("UPDATE users SET ? WHERE id = ?", [updates, req.user.id]);

        const [updatedUser] = await db.query("SELECT id, username, slug, avatar, description, created_at, social_links FROM users WHERE id = ?", [req.user.id]);

        if(updatedUser[0]?.social_links) {
            updatedUser[0].social_links = JSON.parse(updatedUser[0].social_links);
        }

        res.json(updatedUser[0]);
    } catch (error) {
        console.error("Error updating user:", error);
        res.status(500).json({ message: "Error updating user", error: error.message });
    }
});

router.get("/slug-availability/:slug", auth, async (req, res) => {
    try {
        const candidateSlug = normalizeSlugInput(req.params.slug);

        const [currentUserRows] = await db.query("SELECT slug FROM users WHERE id = ? LIMIT 1", [req.user.id]);
        const currentSlug = String(currentUserRows[0]?.slug || "").toLowerCase();
        const allowLegacy = Boolean(candidateSlug && candidateSlug === currentSlug);
        const validation = validateSlug(candidateSlug, { allowLegacy });

        if(!validation.valid) {
            return res.json({
                available: false,
                normalized: validation.normalized,
                reason: validation.reason,
                message: getSlugValidationMessage(validation.reason),
            });
        }

        if(validation.normalized === currentSlug) {
            return res.json({
                available: true,
                normalized: validation.normalized,
                reason: null,
                message: null,
            });
        }

        const [rows] = await db.query("SELECT 1 FROM users WHERE slug = ? AND id <> ? LIMIT 1", [validation.normalized, req.user.id]);
        if(rows.length > 0) {
            return res.json({
                available: false,
                normalized: validation.normalized,
                reason: "slug_taken",
                message: "This URL is already taken",
            });
        }

        return res.json({
            available: true,
            normalized: validation.normalized,
            reason: null,
            message: null,
        });
    } catch (error) {
        console.error("Error checking user slug availability:", error);
        return res.status(500).json({ message: "Error checking slug availability" });
    }
});

router.get("/me/likes", auth, async (req, res) => {
	try {
		const rawPage = Number(req.query.page);
		const rawLimit = Number(req.query.limit);
		const page = Number.isFinite(rawPage) ? Math.max(Math.trunc(rawPage), 1) : 1;
		const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(Math.trunc(rawLimit), 1), 50) : 20;
		const offset = (page - 1) * limit;
		const userId = req.user.id;
		const cacheKey = `user_likes_${userId}_${page}_${limit}`;
		const cachedResponse = await getCacheJson(cacheKey);

		if(cachedResponse) {
			return res.json(cachedResponse);
		}

		const [projects] = await db.query(
			`SELECT
				p.id,
				p.slug,
				p.title,
				p.summary,
				p.icon_url,
				p.downloads,
				p.project_type,
				p.tags,
				p.updated_at,
				p.created_at,
				p.show_players_last_14d,
				pl.created_at AS liked_at,
				u.username,
				u.slug AS user_slug,
				u.avatar,
				u.isVerified,
				o.id AS organization_id,
				o.slug AS organization_slug,
				o.name AS organization_name,
				o.icon_url AS organization_icon_url,
				o.summary AS organization_summary
			FROM project_likes pl
			INNER JOIN projects p ON p.id = pl.project_id
			LEFT JOIN users u ON p.user_id = u.id
			LEFT JOIN organization_projects op ON op.project_id COLLATE utf8mb4_unicode_ci = p.id COLLATE utf8mb4_unicode_ci
			LEFT JOIN organizations o ON o.id COLLATE utf8mb4_unicode_ci = op.organization_id COLLATE utf8mb4_unicode_ci
			WHERE pl.user_id = ?
			AND p.status = 'approved'
			GROUP BY p.id, pl.created_at
			ORDER BY pl.created_at DESC
			LIMIT ? OFFSET ?`,
			[userId, limit, offset]
		);

		const projectSlugs = projects.filter((project) => Number(project.show_players_last_14d) === 1).map((project) => project.slug).filter(Boolean);
		const playersLast14DaysBySlug = await getProjectPlayersInLastDaysBySlug({
			projectSlugs,
			days: 14,
		});

		const [[{ total }]] = await db.query(
			`SELECT COUNT(*) AS total
			FROM project_likes pl
			INNER JOIN projects p ON p.id = pl.project_id
			WHERE pl.user_id = ?
			AND p.status = 'approved'`,
			[userId]
		);

		const responseData = {
			projects: projects.map((project) => ({
				id: project.id,
				slug: project.slug,
				title: project.title,
				summary: project.summary || "",
				icon_url: project.icon_url || "https://media.modifold.com/static/no-project-icon.svg",
				downloads: Number(project.downloads || 0),
				project_type: project.project_type,
				tags: project.tags ? project.tags.split(",").map((tag) => tag.trim()).filter(Boolean) : [],
				created_at: project.created_at,
				updated_at: project.updated_at,
				liked_at: project.liked_at,
				players_last_14d: playersLast14DaysBySlug.get(project.slug) || 0,
				show_players_last_14d: project.show_players_last_14d === 1 || project.show_players_last_14d === true,
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
			totalPages: Math.ceil(Number(total || 0) / limit),
			currentPage: page,
		};

		await setCacheJson(cacheKey, responseData, 60);
		return res.json(responseData);
	} catch (error) {
		console.error("Error fetching liked projects:", error);
		return res.status(500).json({ message: "Error fetching liked projects", error: error.message });
	}
});

router.get("/:username/projects", async (req, res) => {
    try {
        const { username } = req.params;
        const { page = 1, limit = 20 } = req.query;

        if(isNaN(page) || page < 1) {
            return res.status(400).json({ message: "Invalid page number" });
        }

        if(isNaN(limit) || limit < 1) {
            return res.status(400).json({ message: "Invalid limit" });
        }

        const offset = (page - 1) * limit;

        let query = `
            SELECT p.id, p.slug, p.title, p.summary, p.icon_url, p.downloads, p.created_at, p.updated_at, p.project_type, p.tags,
            u.username, u.slug AS user_slug, u.avatar, u.isVerified,
            o.id AS organization_id, o.slug AS organization_slug, o.name AS organization_name, o.icon_url AS organization_icon_url, o.summary AS organization_summary,
            (SELECT url FROM project_gallery WHERE project_id = p.id AND featured = 1 LIMIT 1) AS featured_image
            FROM projects p
            LEFT JOIN users u ON p.user_id = u.id
            LEFT JOIN organization_projects op ON op.project_id COLLATE utf8mb4_unicode_ci = p.id COLLATE utf8mb4_unicode_ci
            LEFT JOIN organizations o ON o.id COLLATE utf8mb4_unicode_ci = op.organization_id COLLATE utf8mb4_unicode_ci
            WHERE p.status = 'approved' AND (
                u.slug = ?
                OR EXISTS (
                    SELECT 1
                    FROM project_members pm
                    INNER JOIN users member_user ON member_user.id = pm.user_id
                    WHERE pm.project_id = p.id AND member_user.slug = ?
                )
            )
            ORDER BY p.downloads DESC
            LIMIT ? OFFSET ?
        `;

        let statsQuery = `
            SELECT COUNT(DISTINCT p.id) as total, COALESCE(SUM(p.downloads), 0) AS totalDownloads
            FROM projects p
            LEFT JOIN users u ON p.user_id = u.id
            WHERE p.status = 'approved' AND (
                u.slug = ?
                OR EXISTS (
                    SELECT 1
                    FROM project_members pm
                    INNER JOIN users member_user ON member_user.id = pm.user_id
                    WHERE pm.project_id = p.id AND member_user.slug = ?
                )
            )
        `;

        const params = [username, username, Number(limit), Number(offset)];
        const statsParams = [username, username];

        const [projects] = await db.query(query, params);
        const [[{ total, totalDownloads }]] = await db.query(statsQuery, statsParams);

        res.json({
            projects: projects.map((project) => ({
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
            totalProjects: Number(total || 0),
            totalDownloads: Number(totalDownloads || 0),
            currentPage: Number(page),
        });
    } catch (error) {
        console.error("Error fetching user projects:", error);
        res.status(500).json({ message: "Error fetching user projects", error: error.message });
    }
});

router.get("/:username/follows", async (req, res) => {
    try {
        const { username } = req.params;
        const type = req.query.type === "subscriptions" ? "subscriptions" : "subscribers";
        const rawLimit = Number(req.query.limit);
        const rawOffset = Number(req.query.offset);
        const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(Math.trunc(rawLimit), 1), 15) : 15;
        const offset = Number.isFinite(rawOffset) ? Math.max(Math.trunc(rawOffset), 0) : 0;
        const cacheKey = `modifold_user_follows_${Buffer.from(JSON.stringify({ username, type, limit, offset })).toString("base64")}`;

        const cachedResponse = await getCacheJson(cacheKey);
        if(cachedResponse) {
            return res.json(cachedResponse);
        }

        const [userRows] = await db.query("SELECT id FROM users WHERE slug = ? LIMIT 1", [username]);
        if(!userRows.length) {
            return res.status(404).json({ message: "User not found" });
        }

        const profileUserId = userRows[0].id;

        const joinColumn = type === "subscribers" ? "s.author_id" : "s.userid";
        const whereColumn = type === "subscribers" ? "s.userid" : "s.author_id";

        const [rows] = await db.query(
            `SELECT u.id, u.username, u.slug, u.avatar, u.isVerified
            FROM subs s
            INNER JOIN users u ON u.id = ${joinColumn}
            WHERE ${whereColumn} = ? AND s.type = 'user'
            ORDER BY s.date DESC, s.id DESC
            LIMIT ? OFFSET ?`,
            [profileUserId, limit + 1, offset]
        );

        const hasMore = rows.length > limit;
        const items = (hasMore ? rows.slice(0, limit) : rows).map((item) => ({
            id: item.id,
            username: item.username,
            slug: item.slug,
            avatar: item.avatar,
            isVerified: item.isVerified,
        }));

        const responseData = {
            type,
            users: items,
            pagination: {
                limit,
                offset,
                nextOffset: offset + items.length,
                hasMore,
            },
        };

        await setCacheJson(cacheKey, responseData, 30);

        res.json(responseData);
    } catch (error) {
        console.error("Error fetching user follow list:", error);
        res.status(500).json({ message: "Error fetching user follow list", error: error.message });
    }
});

router.get("/:username/organizations", async (req, res) => {
    try {
        const { username } = req.params;
        const [userRows] = await db.query("SELECT id FROM users WHERE slug = ? LIMIT 1", [username]);
        if(!userRows.length) {
            return res.status(404).json({ message: "User not found" });
        }

        const userId = userRows[0].id;
        const [rows] = await db.query(
            `SELECT
            o.id,
            o.slug,
            o.name,
            o.summary,
            o.icon_url,
            (SELECT COUNT(*) FROM organization_members om2 WHERE om2.organization_id COLLATE utf8mb4_unicode_ci = o.id COLLATE utf8mb4_unicode_ci AND om2.status = 'accepted') AS members_count
            FROM organization_members om
            INNER JOIN organizations o ON o.id COLLATE utf8mb4_unicode_ci = om.organization_id COLLATE utf8mb4_unicode_ci
            WHERE om.user_id = ?
            AND om.status = 'accepted'
            ORDER BY o.updated_at DESC`,
            [userId]
        );

        return res.json({
            organizations: rows.map((row) => ({
                id: row.id,
                slug: row.slug,
                name: row.name,
                summary: row.summary || "",
                icon_url: row.icon_url || "https://media.modifold.com/static/no-project-icon.svg",
                members_count: Number(row.members_count || 0),
            })),
        });
    } catch (error) {
        console.error("Error fetching user organizations:", error);
        return res.status(500).json({ message: "Error fetching user organizations", error: error.message });
    }
});

router.get("/:username/achievements", async (req, res) => {
	try {
		const { username } = req.params;
		const [userRows] = await db.query("SELECT id FROM users WHERE slug = ? LIMIT 1", [username]);
		if(!userRows.length) {
			return res.status(404).json({ message: "User not found" });
		}

		const [rows] = await db.query(
			`SELECT
			ua.id,
			ua.awarded_at,
			ua.context_type,
			ua.context_id,
			ua.note,
			a.code,
			a.name,
			a.description,
			a.icon_url
			FROM user_achievements ua
			INNER JOIN achievements a ON a.id = ua.achievement_id
			WHERE ua.user_id = ?
			AND a.is_active = 1
			ORDER BY ua.awarded_at DESC, ua.id DESC`,
			[userRows[0].id]
		);

		return res.json({
			achievements: rows.map((row) => ({
				id: row.id,
				code: row.code,
				name: row.name,
				description: row.description,
				icon_url: row.icon_url,
				awarded_at: Number(row.awarded_at || 0),
				context_type: row.context_type || null,
				context_id: row.context_id || null,
				note: row.note || null,
			})),
		});
	} catch (error) {
		console.error("Error fetching user achievements:", error);
		return res.status(500).json({ message: "Error fetching user achievements", error: error.message });
	}
});

router.get("/:username", async (req, res) => {
    try {
        const [user] = await db.query("SELECT id, username, slug, description, avatar, created_at, isVerified, isRole, social_links FROM users WHERE slug = ?", [req.params.username]);

        if(!user.length) {
            return res.status(404).json({ message: "User not found" });
        }

        const userId = user[0].id;

        const [subs] = await db.query("SELECT COUNT(*) as count FROM subs WHERE userid = ?", [userId]);
        const [userSubs] = await db.query("SELECT COUNT(*) as count FROM subs WHERE author_id = ?", [userId]);

        const userWithoutSensitiveData = {
            id: user[0].id,
            username: user[0].username,
            slug: user[0].slug,
            description: user[0].description,
            avatar: user[0].avatar,
            created_at: user[0].created_at,
            isVerified: user[0].isVerified,
            isRole: user[0].isRole,
            subscribers: subs[0].count,
            subscriptions: userSubs[0].count,
            social_links: user[0].social_links ? JSON.parse(user[0].social_links) : {},
        };

        res.json(userWithoutSensitiveData);
    } catch (error) {
        res.status(500).json({ message: "Error receiving user", error });
    }
});

router.delete("/me", auth, async (req, res) => {
    try {
        const userId = req.user.id;

        const [projects] = await db.query(`SELECT id, slug FROM projects WHERE user_id = ?`, [userId]);

        const projectIds = projects.map((p) => p.id);
        const projectSlugs = projects.map((p) => p.slug).filter(Boolean);

        if(projectIds.length > 0) {
            for(const projectId of projectIds) {
                const projectDir = path.join(process.env.MEDIA_ROOT, "projects", projectId);
                try {
                    await fs.rm(projectDir, { recursive: true, force: true });
                    console.log(`Удалена папка проекта ${projectId}`);
                } catch (err) {
                    console.warn(`Не удалось удалить папку проекта ${projectId}:`, err);
                }
            }

            await db.query("DELETE FROM project_versions WHERE project_id IN (?)", [projectIds]);
            await db.query("DELETE FROM project_gallery WHERE project_id IN (?)", [projectIds]);
            await db.query("DELETE FROM project_members WHERE project_id IN (?)", [projectIds]);
            await db.query("DELETE FROM project_likes WHERE project_id IN (?)", [projectIds]);
            await db.query("DELETE FROM project_ad_impressions WHERE project_id IN (?)", [projectIds]);

            if(hasClickHouseConfig && clickhouse && projectSlugs.length > 0) {
                const escapedProjectSlugs = projectSlugs.map((slug) => `'${String(slug).replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`).join(", ");

                await clickhouse.command({
                    query: `ALTER TABLE project_events DELETE WHERE project_slug IN (${escapedProjectSlugs})`,
                });
            }

            await db.query("DELETE FROM projects WHERE id IN (?)", [projectIds]);
        }

        await db.query("DELETE FROM users WHERE id = ?", [userId]);

        res.json({ success: true, message: "Account and all related data successfully deleted" });
    } catch (error) {
        console.error("Error deleting account:", error);
        res.status(500).json({
            success: false,
            message: "Failed to delete account",
            error: error.message,
        });
    }
});

module.exports = router;