const express = require("express");
const { db } = require("../config/db");

const router = express.Router();

const ALLOWED_PROJECT_TYPES = new Set(["mod", "modpack"]);

router.get("/game-versions", async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT id, version, version_type
            FROM game_versions
            WHERE is_active = 1
            ORDER BY id DESC`
        );

        const gameVersions = rows.map((row) => ({
            id: row.id,
            version: row.version,
            version_type: row.version_type || "release",
        }));

        return res.json({
            game_versions: gameVersions,
            versions: gameVersions.map((row) => row.version),
        });
    } catch (error) {
        console.error("Error fetching game versions:", error);
        return res.status(500).json({ message: "Error fetching game versions" });
    }
});

router.get("/:projectType", async (req, res) => {
    try {
        const { projectType } = req.params;
        if(!ALLOWED_PROJECT_TYPES.has(projectType)) {
            return res.status(400).json({ message: "Invalid project type" });
        }

        const [rows] = await db.query(
            `SELECT name, icon, header, project_type, sort_order
            FROM project_tags
            WHERE project_type = ?
            AND is_active = 1
            ORDER BY sort_order ASC, name ASC`,
            [projectType]
        );

        const tags = rows.map((row) => ({
            name: row.name,
            icon: row.icon || null,
            header: row.header || null,
            project_type: row.project_type,
        }));

        return res.json({ tags });
    } catch (error) {
        console.error("Error fetching tags:", error);
        return res.status(500).json({ message: "Error fetching tags" });
    }
});

module.exports = router;