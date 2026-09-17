const { logger } = require("../../packages/shared/logger");

const { spawn } = require("child_process");
const express = require("express");
const fs = require("fs/promises");
const path = require("path");

const { db } = require("../../config/db");
const auth = require("../../middleware/auth");
const { getLocalReadableObjectPath, getPublicObjectKeyFromUrl } = require("../../utils/fileHosting");
const { inspectIconArchive, normalizeArchiveEntry } = require("../../utils/iconEditorAssets");
const { ORG_PROJECT_PERMISSIONS, hasProjectPermission, resolveProjectAccess } = require("../../utils/organizations");

const router = express.Router();
const MAX_STREAMED_ASSET_BYTES = 16 * 1024 * 1024;
const manifestCache = new Map();
const MANIFEST_CACHE_LIMIT = 30;

const CONTENT_TYPES = {
	".blockymodel": "application/json; charset=utf-8",
	".png": "image/png",
};

const getProjectVersion = async (slug, userId) => {
	const [projects] = await db.query(
		"SELECT id, user_id, slug, project_type FROM projects WHERE slug = ? LIMIT 1",
		[slug]
	);
	if(!projects.length) {
		return { status: 404, message: "Project not found" };
	}

	const project = projects[0];
	const access = await resolveProjectAccess(db, project, userId);
	if(!hasProjectPermission(access, ORG_PROJECT_PERMISSIONS.EDIT_DETAILS)) {
		return { status: 403, message: "You do not have permission to edit this project" };
	}

	const [versions] = await db.query(
		`SELECT id, version_number, file_url, quarantine_key, file_size, created_at
		FROM project_versions
		WHERE project_id = ? AND (file_url IS NOT NULL OR quarantine_key IS NOT NULL)
		ORDER BY created_at DESC, id DESC
		LIMIT 1`,
		[project.id]
	);
	if(!versions.length) {
		return { status: 404, message: "Upload a project version before opening the icon editor" };
	}

	return { project, version: versions[0] };
};

const getArchivePath = async (project, version) => {
	if(version.quarantine_key) {
		return getLocalReadableObjectPath(version.quarantine_key, "private");
	}

	let objectKey = getPublicObjectKeyFromUrl(version.file_url);
	if(!objectKey) {
		let fileName = "";
		try {
			fileName = path.basename(new URL(version.file_url).pathname);
		} catch {
			fileName = path.basename(String(version.file_url || ""));
		}

		if(!fileName || fileName !== path.basename(fileName)) {
			throw new Error("Version archive URL is invalid");
		}

		objectKey = `projects/${project.id}/${fileName}`;
	}

	return getLocalReadableObjectPath(objectKey, "public");
};

const getManifest = async (project, version) => {
	const archivePath = await getArchivePath(project, version);
	const archiveStat = await fs.stat(archivePath);
	const cacheKey = `${version.id}:${archiveStat.size}:${archiveStat.mtimeMs}`;
	if(manifestCache.has(cacheKey)) {
		return manifestCache.get(cacheKey);
	}

	const manifest = await inspectIconArchive(archivePath);
	const result = { archivePath, manifest };
	manifestCache.set(cacheKey, result);
	if(manifestCache.size > MANIFEST_CACHE_LIMIT) {
		manifestCache.delete(manifestCache.keys().next().value);
	}

	return result;
};

router.get("/:slug/assets", auth, async (req, res) => {
	res.setHeader("Cache-Control", "no-store");
	try {
		const result = await getProjectVersion(req.params.slug, req.user.id);
		if(result.status) {
			return res.status(result.status).json({ message: result.message });
		}

		const { manifest } = await getManifest(result.project, result.version);
		return res.json({
			version: {
				id: result.version.id,
				number: result.version.version_number,
			},
			assets: manifest.assets,
			texture_overrides: manifest.textureOverrides,
			stats: manifest.stats,
		});
	} catch(error) {
		logger.error("Error inspecting icon editor assets:", error);
		return res.status(500).json({ message: "Could not inspect the latest project version" });
	}
});

router.get("/:slug/file", auth, async (req, res) => {
	res.setHeader("Cache-Control", "private, no-store");
	try {
		const entry = normalizeArchiveEntry(req.query.path);
		if(!entry || !CONTENT_TYPES[path.posix.extname(entry).toLowerCase()]) {
			return res.status(400).json({ message: "Invalid asset path" });
		}

		const result = await getProjectVersion(req.params.slug, req.user.id);
		if(result.status) {
			return res.status(result.status).json({ message: result.message });
		}

		if(String(req.query.version || "") !== String(result.version.id)) {
			return res.status(409).json({ message: "The project version changed. Reopen the icon editor" });
		}

		const { archivePath, manifest } = await getManifest(result.project, result.version);
		if(!manifest.entries.has(entry)) {
			return res.status(404).json({ message: "Asset not found in the latest version" });
		}

		res.status(200);
		res.setHeader("Content-Type", CONTENT_TYPES[path.posix.extname(entry).toLowerCase()]);
		res.setHeader("Content-Disposition", `inline; filename="${path.posix.basename(entry).replace(/"/g, "")}"`);

		const child = spawn("unzip", ["-p", archivePath, entry], {
			stdio: ["ignore", "pipe", "ignore"],
		});
		let bytesSent = 0;
		let failed = false;
		child.stdout.on("data", (chunk) => {
			bytesSent += chunk.length;
			if(bytesSent > MAX_STREAMED_ASSET_BYTES) {
				failed = true;
				child.kill("SIGKILL");
				res.destroy();
			}
		});
		child.stdout.on("error", () => res.destroy());
		child.stdout.pipe(res);
		res.on("close", () => {
			if(!res.writableEnded) child.kill("SIGKILL");
		});
		child.on("error", () => {
			if(!res.headersSent) res.status(500).json({ message: "Could not read the project asset" });
			else res.destroy();
		});
		child.on("close", (code) => {
			if((code !== 0 || failed) && !res.writableEnded) res.destroy();
		});
	} catch(error) {
		logger.error("Error streaming icon editor asset:", error);
		if(!res.headersSent) {
			return res.status(500).json({ message: "Could not read the project asset" });
		}

		return res.destroy();
	}
});

module.exports = router;