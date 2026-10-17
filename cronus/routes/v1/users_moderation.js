const { logger } = require("../../packages/shared/logger");

const express = require("express");
const { db } = require("../../config/db");
const auth = require("../../middleware/auth");
const router = express.Router();
const multer = require("multer");
const sharp = require("sharp");
const fs = require("fs").promises;
const path = require("path");
const { sanitizePlainText, containsEmoji } = require("../../utils/sanitize");
const { validateSlug } = require("../../utils/slug");
const { buildSafeObjectFilename, deleteObject, getPublicObjectKeyFromUrl, getPublicUrl, getUploadTempRoot, uploadFile } = require("../../utils/fileHosting");
const { parsePagination, normalizeSearch } = require("../../utils/queryPagination");
const { ACHIEVEMENT_CODES, awardAchievementToUser } = require("../../utils/achievements");
const { getVisibleProfileBadge } = require("../../utils/profileBadges");

const requireRole = (roles) => async (req, res, next) => {
	try {
		const [users] = await db.query("SELECT isRole FROM users WHERE id = ?", [req.user.id]);
		if(!users[0] || !roles.includes(users[0].isRole)) {
			return res.status(403).json({ code: "forbidden", message: "Unauthorized" });
		}

		next();
	} catch(error) {
		logger.error("Error checking user moderation access:", error);
		res.status(500).json({ code: "accessCheckFailed", message: "Error checking access" });
	}
};
const requireAdmin = requireRole(["admin"]);
const requireModerator = requireRole(["admin", "moderator"]);
const userFields = "id, username, slug, avatar, email, description, created_at, isRole, isVerified, active_profile_badge";
const userIdFrom = (value) => {
	const id = Number(value);
	if(!/^\d+$/.test(String(value)) || !Number.isSafeInteger(id) || id < 1 || id > 2147483647) {
		throw Object.assign(new Error("Invalid user ID"), { statusCode: 400, errorCode: "invalidUserId" });
	}

	return id;
};
const validationError = (code, message, field) => Object.assign(new Error(message), {
	statusCode: 400,
	errorCode: code,
	field,
});

const respondWithError = (res, error, message, code) => {
	if(!error.statusCode && error.code !== "ER_DUP_ENTRY") {
		logger.error(message, error);
	}

	const duplicate = error.code === "ER_DUP_ENTRY";
	return res.status(error.statusCode || (duplicate ? 409 : 500)).json({
		code: duplicate ? "slugTaken" : error.errorCode || code,
		message: duplicate ? "Slug is already taken" : error.statusCode ? error.message : message,
		field: duplicate ? "slug" : error.field,
	});
};

const deleteUserAvatarUrl = async (url, userId) => {
	const objectKey = getPublicObjectKeyFromUrl(url);
	if(objectKey && (!objectKey.includes("/") || objectKey.startsWith(`users/${userId}/avatar/`))) {
		await deleteObject(objectKey);
	}
};

const storage = multer.diskStorage({
	destination: async (req, file, cb) => {
		try {
			const destination = getUploadTempRoot();
			await fs.mkdir(destination, { recursive: true });
			cb(null, destination);
		} catch(error) {
			cb(error);
		}
    },
    filename: (req, file, cb) => {
        cb(null, buildSafeObjectFilename(file.originalname));
    },
});

const fileFilter = (req, file, cb) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/gif"];
    if(allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error("Invalid file type. Only JPEG, PNG, and GIF are allowed."), false);
    }
};

const upload = multer({
    storage,
    limits: { fileSize: 20 * 1024 * 1024 },
    fileFilter,
});

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

router.get("/", auth, requireModerator, async (req, res) => {
	try {
		const { page, limit, offset } = parsePagination(req.query, { defaultLimit: 15, maxLimit: 50 });
		const search = normalizeSearch(req.query.search, { maxLength: 100 });
		const like = "%" + search.replace(/[!%_]/g, "!$&") + "%";
		const where = search ? " WHERE (username LIKE ? ESCAPE '!' OR slug LIKE ? ESCAPE '!')" : "";
		const filters = search ? [like, like] : [];
		const [users] = await db.query(
			"SELECT " + userFields + " FROM users" + where + " ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?",
			[...filters, limit, offset]
		);

		const [[{ total }]] = await db.query("SELECT COUNT(*) AS total FROM users" + where, filters);
		res.json({
			users: users.map(({ active_profile_badge, ...user }) => ({ ...user, activeProfileBadge: active_profile_badge })),
			totalPages: Math.max(1, Math.ceil(total / limit)),
			currentPage: page,
			totalUsers: Number(total),
		});
	} catch(error) {
		respondWithError(res, error, "Error fetching users", "fetch");
	}
});

router.get("/:id/achievements", auth, requireAdmin, async (req, res) => {
	try {
		const id = userIdFrom(req.params.id);
		const [users] = await db.query("SELECT id, isVerified FROM users WHERE id = ?", [id]);
		if(!users.length) {
			return res.status(404).json({ code: "userNotFound", message: "User not found" });
		}

		const [rows] = await db.query(
			"SELECT a.code, a.name, a.description, a.icon_url, a.is_manual_only, ua.id AS award_id, ua.awarded_at, issuer.username AS awarded_by " +
			"FROM achievements a LEFT JOIN user_achievements ua ON ua.achievement_id = a.id AND ua.user_id = ? " +
			"LEFT JOIN users issuer ON issuer.id = ua.awarded_by_user_id WHERE a.is_active = 1 ORDER BY a.id",
			[id]
		);

		res.json({ achievements: rows.map(({ award_id, ...item }) => ({
			...item,
			earned: Boolean(award_id) || (item.code === ACHIEVEMENT_CODES.CREATOR && Number(users[0].isVerified) === 1),
			awarded_at: award_id ? Number(item.awarded_at) : null,
		})) });
	} catch(error) {
		respondWithError(res, error, "Error fetching achievements", "achievementsFetch");
	}
});

router.put("/:id/achievements/:code", auth, requireAdmin, async (req, res) => {
	let connection;
	try {
		const id = userIdFrom(req.params.id);
		const code = String(req.params.code);
		const earned = req.body?.earned;
		if(typeof earned !== "boolean" || !/^[a-z0-9_]{1,80}$/.test(code)) {
			throw validationError("invalidAchievementUpdate", "Invalid achievement update");
		}

		connection = await db.getConnection();
		await connection.beginTransaction();
		const [users] = await connection.query("SELECT id, active_profile_badge FROM users WHERE id = ? FOR UPDATE", [id]);
		if(!users.length) {
			throw Object.assign(new Error("User not found"), { statusCode: 404, errorCode: "userNotFound" });
		}

		const [achievements] = await connection.query("SELECT id FROM achievements WHERE code = ? AND is_active = 1", [code]);
		if(!achievements.length) {
			throw Object.assign(new Error("Achievement not found"), { statusCode: 404, errorCode: "achievementNotFound" });
		}

		if(earned) {
			await awardAchievementToUser(connection, { userId: id, code, awardedByUserId: req.user.id, contextType: "moderation" });
		} else {
			await connection.query("DELETE FROM user_achievements WHERE user_id = ? AND achievement_id = ?", [id, achievements[0].id]);
			await connection.query("UPDATE users SET active_profile_badge = NULL WHERE id = ? AND active_profile_badge = ?", [id, code]);
		}

		if(code === ACHIEVEMENT_CODES.CREATOR) {
			await connection.query("UPDATE users SET isVerified = ? WHERE id = ?", [earned ? 1 : 0, id]);
		}

		await connection.commit();
		logger.info("User achievement updated", { actorId: req.user.id, userId: id, code, earned });
		return res.json({ success: true });
	} catch(error) {
		if(connection) {
			await connection.rollback();
		}
		return respondWithError(res, error, "Error updating achievement", "achievement");
	} finally {
		connection?.release();
	}
});

router.put("/:id", auth, requireAdmin, upload.single("avatar"), async (req, res) => {
	let connection;
	let avatarFile = req.file;
	try {
		const id = userIdFrom(req.params.id);
		const { username, email, slug, description, isRole } = req.body;
		connection = await db.getConnection();
		await connection.beginTransaction();
		const [targetRows] = await connection.query("SELECT " + userFields + " FROM users WHERE id = ? FOR UPDATE", [id]);
		const targetUser = targetRows[0];
		if(!targetUser) {
			throw Object.assign(new Error("User not found"), { statusCode: 404, errorCode: "userNotFound" });
		}

		const updates = {};
		if(username !== undefined) {
			if(typeof username !== "string" || !username.trim() || username.length > 100) {
				throw validationError("invalidUsername", "Invalid username", "username");
			}

			updates.username = sanitizePlainText(username.trim());
			if(!updates.username || containsEmoji(updates.username)) {
				throw validationError("invalidUsername", "Invalid username", "username");
			}
		}

		if(email !== undefined) {
			if(typeof email !== "string" || email.length > 255 || (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))) {
				throw validationError("invalidEmail", "Invalid email", "email");
			}

			updates.email = email.trim().toLowerCase() || null;
		}

		if(slug !== undefined) {
			if(typeof slug !== "string") {
				throw validationError("invalidSlug", "Invalid slug", "slug");
			}

			const validation = validateSlug(slug, { allowLegacy: slug === targetUser.slug });
			if(!validation.valid || validation.normalized !== slug.toLowerCase()) {
				throw validationError(
					validation.reason === "too_short" ? "slugShort" : "invalidSlug",
					validation.reason === "too_short" ? "Slug must be at least 4 characters" : "Invalid slug",
					"slug"
				);
			}

			const [existing] = await connection.query("SELECT id FROM users WHERE slug = ? AND id != ?", [validation.normalized, id]);
			if(existing.length) {
				throw validationError("slugTaken", "Slug is already taken", "slug");
			}

			updates.slug = validation.normalized;
		}

		if(description !== undefined) {
			if(typeof description !== "string" || description.length > 5000) {
				throw validationError("invalidDescription", "Invalid description", "description");
			}

			updates.description = sanitizePlainText(description, { preserveNewlines: true });
		}

		if(isRole !== undefined && isRole !== targetUser.isRole) {
			if(!["admin", "moderator", "user"].includes(isRole)) {
				throw validationError("invalidRole", "Invalid role", "isRole");
			}

			if(id === Number(req.user.id) && isRole !== "admin") {
				throw validationError("ownRole", "Cannot change your own admin role", "isRole");
			}

			const [admins] = await connection.query("SELECT id FROM users WHERE isRole = 'admin' FOR UPDATE");
			if(!admins.some((admin) => Number(admin.id) === Number(req.user.id))) {
				throw Object.assign(new Error("Unauthorized"), { statusCode: 403, errorCode: "forbidden" });
			}

			updates.isRole = isRole;
			if(isRole === "user" && targetUser.active_profile_badge === "staff") {
				const [staffAwards] = await connection.query(
					"SELECT ua.id FROM user_achievements ua JOIN achievements a ON a.id = ua.achievement_id WHERE ua.user_id = ? AND a.code = 'staff' AND a.is_active = 1",
					[id]
				);

				if(!staffAwards.length) {
					updates.active_profile_badge = null;
				}
			}
		}

		if(!Object.keys(updates).length && !avatarFile) {
			throw validationError("emptyUpdate", "No data provided for update");
		}

		if(avatarFile) {
			avatarFile = await convertImageToWebp(avatarFile);
			const objectKey = "users/" + id + "/avatar/" + avatarFile.filename;
			await uploadFile({ key: objectKey, filePath: avatarFile.path, contentType: avatarFile.mimetype });
			updates.avatar = getPublicUrl(objectKey);
		}

		await connection.query("UPDATE users SET ? WHERE id = ?", [updates, id]);
		await connection.commit();
		if(updates.avatar && targetUser.avatar !== updates.avatar) {
			await deleteUserAvatarUrl(targetUser.avatar, id).catch((error) => logger.warn("Failed to delete replaced user avatar:", error));
		}

		const [updated] = await db.query("SELECT " + userFields + " FROM users WHERE id = ?", [id]);
		updated[0].activeProfileBadge = await getVisibleProfileBadge(db, updated[0]);
		delete updated[0].active_profile_badge;
		return res.json(updated[0]);
	} catch(error) {
		if(connection) {
			await connection.rollback();
		}
		return respondWithError(res, error, "Error updating user", "updateUser");
	} finally {
		connection?.release();
	}
});

module.exports = router;