const express = require("express");

const { db } = require("../../config/db");
const optionalAuth = require("../../middleware/optionalAuth");
const { ORG_PROJECT_PERMISSIONS, hasProjectPermission, resolveProjectAccess } = require("../../utils/organizations");

const router = express.Router();

const getUserRole = async (userId) => {
	if(!userId) {
		return null;
	}

	const [users] = await db.query("SELECT isRole FROM users WHERE id = ? LIMIT 1", [userId]);
	return users[0]?.isRole || null;
};

const canViewPrivateVersion = async (project, userId) => {
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

const parseJsonArray = (value) => {
	if(Array.isArray(value)) {
		return value;
	}

	if(!value) {
		return [];
	}

	try {
		const parsed = JSON.parse(value);
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
};

const getVersionDependencies = async (versionId) => {
	try {
		const [dependencies] = await db.query(
			`SELECT
			d.project_id,
			d.dependency_version_id AS version_id,
			d.dependency_type,
			p.slug AS project_slug,
			p.title AS project_title,
			p.icon_url AS project_icon_url,
			p.project_type,
			pv.version_number
			FROM dependencies d
			LEFT JOIN projects p ON p.id = d.project_id
			LEFT JOIN project_versions pv ON pv.id = d.dependency_version_id
			WHERE d.version_id = ?
			ORDER BY d.project_id ASC, d.dependency_version_id ASC`,
			[versionId]
		);

		return dependencies;
	} catch(error) {
		const message = String(error?.sqlMessage || error?.message || "").toLowerCase();
		if(error?.code === "ER_NO_SUCH_TABLE" && message.includes("dependencies")) {
			return [];
		}

		throw error;
	}
};

/**
 * @swagger
 * /v2/version/{versionId}:
 *   get:
 *     summary: Get a version by ID
 *     description: Returns a project version directly by its version ID.
 *     tags: [Versions v2]
 *     parameters:
 *       - in: path
 *         name: versionId
 *         required: true
 *         schema:
 *           type: string
 *         description: Version ID
 *     responses:
 *       200:
 *         description: Version details
 *       404:
 *         description: Version not found
 */
router.get("/:versionId", optionalAuth, async (req, res) => {
	const { versionId } = req.params;

	try {
		const [versions] = await db.query(
			`SELECT
			v.id,
			v.project_id,
			v.version_number,
			v.downloads,
			v.changelog,
			v.release_channel,
			v.game_versions,
			v.loaders,
			v.file_url,
			v.file_size,
			v.created_at,
			v.moderation_status,
			v.moderation_reason,
			p.user_id,
			p.slug AS project_slug
			FROM project_versions v
			INNER JOIN projects p ON p.id = v.project_id
			WHERE BINARY v.id = BINARY ?
			LIMIT 1`,
			[versionId]
		);

		if(!versions.length) {
			return res.status(404).json({ message: "Version not found" });
		}

		const version = versions[0];
		const project = {
			id: version.project_id,
			user_id: version.user_id,
			slug: version.project_slug,
		};
		const canViewModerationFields = await canViewPrivateVersion(project, req.user?.id || null);

		if(version.moderation_status !== "approved" && !canViewModerationFields) {
			return res.status(404).json({ message: "Version not found" });
		}

		const dependencies = await getVersionDependencies(version.id);
		const response = {
			id: version.id,
			project_id: version.project_id,
			version_number: version.version_number,
			downloads: version.downloads,
			changelog: version.changelog,
			release_channel: version.release_channel,
			game_versions: parseJsonArray(version.game_versions),
			loaders: parseJsonArray(version.loaders),
			file_url: version.file_url,
			file_size: version.file_size,
			created_at: version.created_at,
			files: version.file_url ? [{ url: version.file_url, size: version.file_size, primary: true }] : [],
			dependencies,
		};

		if(canViewModerationFields) {
			response.moderation_status = version.moderation_status;
			response.moderation_reason = version.moderation_reason;
		}

		return res.json(response);
	} catch(error) {
		console.error("Error fetching v2 version:", error);
		return res.status(500).json({ message: "Error fetching version", error: error.message });
	}
});

module.exports = router;