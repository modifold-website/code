const express = require("express");
const { db } = require("../config/db");
const auth = require("../middleware/auth");
const router = express.Router();
const multer = require("multer");
const sharp = require("sharp");
const fs = require("fs").promises;
const path = require("path");
const { sanitizePlainText } = require("../utils/sanitize");
const { validateSlug } = require("../utils/slug");

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

router.get("/", auth, async (req, res) => {
    const [user] = await db.query("SELECT isRole FROM users WHERE id = ?", [req.user.id]);

    if(user[0].isRole !== "admin" && user[0].isRole !== "moderator") {
        return res.status(403).json({ message: "Unauthorized" });
    }

    try {
        const { page = 1, limit = 15 } = req.query;

        if(isNaN(page) || page < 1) {
            return res.status(400).json({ message: "Invalid page number" });
        }

        if(isNaN(limit) || limit < 1) {
            return res.status(400).json({ message: "Invalid limit" });
        }

        const offset = (page - 1) * limit;

        const query = `
            SELECT id, username, slug, avatar, email, description, created_at, isRole
            FROM users
            ORDER BY created_at DESC
            LIMIT ? OFFSET ?
        `;

        const countQuery = `
            SELECT COUNT(*) as total
            FROM users
        `;

        const params = [Number(limit), Number(offset)];

        const [users] = await db.query(query, params);
        const [[{ total }]] = await db.query(countQuery);

        res.json({
            users,
            totalPages: Math.ceil(total / limit),
            currentPage: Number(page),
            totalUsers: total,
        });
    } catch (error) {
        console.error("Error fetching users:", error);
        res.status(500).json({ message: "Error fetching users", error: error.message });
    }
});

router.put("/:id", auth, upload.single("avatar"), async (req, res) => {
    const [user] = await db.query("SELECT isRole FROM users WHERE id = ?", [req.user.id]);

    if(user[0].isRole !== "admin") {
        return res.status(403).json({ message: "Only an admin can edit users" });
    }

    const { id } = req.params;
    const { username, email, slug, description, isRole } = req.body;
    let avatarFile = req.file;

    try {
        if(avatarFile) {
            avatarFile = await convertImageToWebp(avatarFile);
        }

        const updates = {};

        if(username) {
            updates.username = sanitizePlainText(username);
        }

        if(email) {
            updates.email = sanitizePlainText(email);
        }

        if(slug) {
            const [currentUserRows] = await db.query("SELECT slug FROM users WHERE id = ? LIMIT 1", [id]);
            const currentSlug = String(currentUserRows[0]?.slug || "").toLowerCase();
            const validation = validateSlug(slug, { allowLegacy: slug === currentSlug });
            if(!validation.valid) {
                return res.status(400).json({ message: validation.reason === "too_short" ? "Slug must be at least 4 characters" : "Invalid slug" });
            }

            const [existingSlug] = await db.query("SELECT id FROM users WHERE slug = ? AND id != ?", [validation.normalized, id]);
            if(existingSlug.length > 0) {
                return res.status(400).json({ message: "Slug is already taken" });
            }

            updates.slug = validation.normalized;
        }

        if(description !== undefined) {
            updates.description = description ? sanitizePlainText(description, { preserveNewlines: true }) : "";
        }

        if(avatarFile) {
            updates.avatar = `https://media.modifold.com/${avatarFile.filename}`;
        }

        if(isRole && ["admin", "moderator", "user"].includes(isRole)) {
            updates.isRole = isRole;
        }

        if(!Object.keys(updates).length) {
            return res.status(400).json({ message: "No data provided for update" });
        }

        await db.query("UPDATE users SET ? WHERE id = ?", [updates, id]);

        const [updatedUser] = await db.query(
            "SELECT id, username, slug, avatar, email, description, created_at, isRole FROM users WHERE id = ?",
            [id]
        );

        res.json(updatedUser[0]);
    } catch (error) {
        console.error("Error updating user:", error);
        res.status(500).json({ message: "Error updating user", error: error.message });
    }
});

module.exports = router;