const express = require("express");
const { db } = require("../../config/db");

const router = express.Router();

const PROJECT_TYPE_ALIASES = {
    mod: "mod",
    mods: "mod",
    modpack: "modpack",
    modpacks: "modpack",
    world: "world",
    worlds: "world",
	prefab: "prefab",
	prefabs: "prefab",
};

const normalizeProjectType = (projectType) => PROJECT_TYPE_ALIASES[String(projectType || "").toLowerCase()] || null;

function normalizeGroupVersions(value) {
    if(Array.isArray(value)) {
        return value.map((item) => String(item || "").trim()).filter(Boolean);
    }

    if(typeof value !== "string") {
        return [];
    }

    const trimmedValue = value.trim();
    if(!trimmedValue) {
        return [];
    }

    if(trimmedValue.startsWith("[")) {
        try {
            const parsed = JSON.parse(trimmedValue);
            return Array.isArray(parsed) ? parsed.map((item) => String(item || "").trim()).filter(Boolean) : [];
        } catch {}
    }

    return trimmedValue.split(",").map((item) => item.trim()).filter(Boolean);
}

async function hasTable(tableName) {
    const [rows] = await db.query("SHOW TABLES LIKE ?", [tableName]);
    return rows.length > 0;
}

async function getGameVersionGroupsByVersion() {
    if(!await hasTable("game_version_groups")) {
        return new Map();
    }

    const [groups] = await db.query(
        `SELECT group_key, label, update_number, versions, is_browse_default, is_visible, sort_order
        FROM game_version_groups
        WHERE is_visible = 1
        ORDER BY sort_order DESC, update_number DESC`
    );
    const groupsByVersion = new Map();

    groups.forEach((group) => {
        const versions = normalizeGroupVersions(group.versions);
        const groupKey = group.group_key || (group.update_number ? `update-${group.update_number}` : "");
        const groupLabel = group.label || (group.update_number ? `Update ${group.update_number}` : groupKey);

        if(!groupKey || versions.length === 0) {
            return;
        }

        versions.forEach((version) => {
            groupsByVersion.set(version, {
                browse_group_key: groupKey,
                browse_group_label: groupLabel,
                browse_group_sort: Number(group.sort_order) || Number(group.update_number) || 0,
                is_browse_default: Number(group.is_browse_default) === 1,
                is_browse_visible: Number(group.is_visible) === 1,
            });
        });
    });

    return groupsByVersion;
}

router.get("/game-versions", async (req, res) => {
    try {
        const groupsByVersion = await getGameVersionGroupsByVersion();
        const [rows] = await db.query(
            `SELECT id, version, version_type
            FROM game_versions
            WHERE is_active = 1
            ORDER BY id DESC`
        );

        const gameVersions = rows.map((row) => {
            const group = groupsByVersion.get(row.version);

            return {
                id: row.id,
                version: row.version,
                version_type: row.version_type || "release",
                browse_group_key: group?.browse_group_key || "",
                browse_group_label: group?.browse_group_label || "",
                browse_group_sort: group?.browse_group_sort || 0,
                is_browse_default: group?.is_browse_default || false,
                is_browse_visible: group?.is_browse_visible !== false,
            };
        });

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
        const projectType = normalizeProjectType(req.params.projectType);
        if(!projectType) {
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