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
};

const normalizeProjectType = (projectType) => PROJECT_TYPE_ALIASES[String(projectType || "").toLowerCase()] || null;

router.get("/", async (req, res) => {
    try {
        const { type } = req.query;

        const normalizedType = type ? normalizeProjectType(type) : null;

        if(type && !normalizedType) {
            return res.status(400).json({ message: "Invalid project type" });
        }

        const params = [];
        let whereClause = "WHERE p.status = 'approved'";
        let orderClause = "ORDER BY r.slug ASC";

        const [recommendedColumns] = await db.query("SHOW COLUMNS FROM recommended");
        const hasPositionColumn = recommendedColumns.some((column) => column?.Field === "position");
        const hasIdColumn = recommendedColumns.some((column) => column?.Field === "id");

        if(hasPositionColumn && hasIdColumn) {
            orderClause = "ORDER BY r.position ASC, r.id ASC";
        } else if(hasPositionColumn) {
            orderClause = "ORDER BY r.position ASC, r.slug ASC";
        } else if(hasIdColumn) {
            orderClause = "ORDER BY r.id ASC";
        }

        if(normalizedType) {
            whereClause += " AND p.project_type = ?";
            params.push(normalizedType);
        }

        const query = `
            SELECT
            p.id,
            p.slug,
            p.title,
            p.summary,
            p.icon_url,
            u.username,
            u.slug AS user_slug,
            u.avatar AS user_avatar,
            o.slug AS organization_slug,
            o.name AS organization_name,
            o.icon_url AS organization_icon_url,
            (SELECT url FROM project_gallery WHERE project_id = p.id AND featured = 1 LIMIT 1) AS featured_image
            FROM recommended r
            INNER JOIN projects p ON p.slug COLLATE utf8mb4_unicode_ci = r.slug COLLATE utf8mb4_unicode_ci
            LEFT JOIN users u ON p.user_id = u.id
            LEFT JOIN organization_projects op ON op.project_id COLLATE utf8mb4_unicode_ci = p.id COLLATE utf8mb4_unicode_ci
            LEFT JOIN organizations o ON o.id COLLATE utf8mb4_unicode_ci = op.organization_id COLLATE utf8mb4_unicode_ci
            ${whereClause}
            ${orderClause}
        `;

        const [projects] = await db.query(query, params);

        return res.json({
            projects: projects.map((project) => ({
                id: project.id,
                slug: project.slug,
                title: project.title,
                summary: project.summary,
                icon_url: project.icon_url || "https://media.modifold.com/static/no-project-icon.svg",
                gallery: project.featured_image ? [{ url: project.featured_image, featured: 1 }] : [],
                owner: project.organization_slug ? {
                    username: project.organization_name,
                    slug: project.organization_slug,
                    avatar: project.organization_icon_url || "https://media.modifold.com/static/no-project-icon.svg",
                    profile_url: `/organization/${project.organization_slug}`,
                } : {
                    username: project.username,
                    slug: project.user_slug,
                    avatar: project.user_avatar || "https://media.modifold.com/static/no-project-icon.svg",
                    profile_url: `/user/${project.user_slug}`,
                },
            })),
        });
    } catch (error) {
        console.error("Error fetching recommended projects:", error);
        return res.status(500).json({ message: "Error fetching recommended projects" });
    }
});

module.exports = router;