const { execFile, spawn } = require("child_process");
const { promisify } = require("util");
const { createGzip } = require("zlib");
const express = require("express");
const fs = require("fs").promises;
const path = require("path");
const axios = require("axios");

const { db } = require("../../config/db");

const router = express.Router();
const execFileAsync = promisify(execFile);
const PREFAB_FILE_PATTERN = /\.prefab\.json$/i;
const MAX_PREFAB_BYTES = 128 * 1024 * 1024;
const ALLOWED_ASSET_EXTENSIONS = new Set([".blockymodel", ".json", ".jpg", ".jpeg", ".png", ".webp"]);
const PREFAB_VALIDATION_CACHE_LIMIT = 100;
const prefabValidationCache = new Map();

const getArchivePath = (projectId, fileUrl) => {
	let fileName = "";

	try {
		fileName = path.basename(new URL(fileUrl).pathname);
	} catch {
		fileName = path.basename(String(fileUrl || ""));
	}

	if(!fileName || fileName !== path.basename(fileName)) {
		return null;
	}

	return path.join(process.env.MEDIA_ROOT || "", "projects", String(projectId), fileName);
};

const getSinglePrefabEntry = async (archivePath) => {
	const { stdout } = await execFileAsync("unzip", ["-l", archivePath], {
		maxBuffer: 4 * 1024 * 1024,
	});
	const entries = String(stdout || "").split(/\r?\n/).map((line) => {
		const match = line.match(/^\s*\d+\s+\S+\s+\S+\s+(.+)$/);
		return match ? match[1].trim() : null;
	}).filter(Boolean);

	const prefabEntries = entries.filter((entry) => (
		PREFAB_FILE_PATTERN.test(entry) &&
		!entry.startsWith("/") &&
		!entry.split("/").includes("..")
	));

	return prefabEntries.length === 1 ? prefabEntries[0] : null;
};

const hasCoordinates = (value) => (
	value &&
	typeof value === "object" &&
	Number.isFinite(Number(value.x)) &&
	Number.isFinite(Number(value.y)) &&
	Number.isFinite(Number(value.z))
);

const isPrefabDocument = (document) => {
	if(!document || typeof document !== "object" || Array.isArray(document)) {
		return false;
	}

	if(!Object.hasOwn(document, "version") || !Object.hasOwn(document, "blockIdVersion")) {
		return false;
	}

	if(![document.anchorX, document.anchorY, document.anchorZ].every((value) => Number.isFinite(Number(value)))) {
		return false;
	}

	const blocks = Object.hasOwn(document, "blocks") ? document.blocks : [];
	const fluids = Object.hasOwn(document, "fluids") ? document.fluids : [];
	const entities = Object.hasOwn(document, "entities") ? document.entities : [];

	if(!Array.isArray(blocks) || !Array.isArray(fluids) || !Array.isArray(entities)) {
		return false;
	}

	return (
		blocks.some((block) => hasCoordinates(block) && typeof block.name === "string" && block.name.length > 0) ||
		fluids.some((fluid) => hasCoordinates(fluid) && typeof fluid.name === "string" && fluid.name.length > 0) ||
		entities.length > 0
	);
};

const validatePrefabEntry = async (archivePath, archiveStat, entry) => {
	const cacheKey = `${archivePath}:${archiveStat.size}:${archiveStat.mtimeMs}:${entry}`;
	if(prefabValidationCache.has(cacheKey)) {
		return prefabValidationCache.get(cacheKey);
	}

	const validation = (async () => {
		try {
			const { stdout } = await execFileAsync("unzip", ["-p", archivePath, entry], {
				encoding: "buffer",
				maxBuffer: MAX_PREFAB_BYTES,
			});

			return isPrefabDocument(JSON.parse(stdout.toString("utf8")));
		} catch {
			return false;
		}
	})();

	prefabValidationCache.set(cacheKey, validation);
	if(prefabValidationCache.size > PREFAB_VALIDATION_CACHE_LIMIT) {
		prefabValidationCache.delete(prefabValidationCache.keys().next().value);
	}

	return validation;
};

const getLatestPrefab = async (slug) => {
	const [rows] = await db.query(
		`SELECT
		p.id AS project_id,
		p.slug AS project_slug,
		v.id AS version_id,
		v.version_number,
		v.file_url,
		v.created_at
		FROM projects p
		INNER JOIN project_versions v ON v.project_id = p.id
		WHERE p.slug = ?
		AND p.project_type = 'prefab'
		AND p.status = 'approved'
		AND p.visibility IN ('public', 'unlisted')
		AND v.moderation_status = 'approved'
		ORDER BY v.created_at DESC
		LIMIT 1`,
		[slug]
	);

	if(!rows.length) {
		return null;
	}

	const prefab = rows[0];
	const archivePath = getArchivePath(prefab.project_id, prefab.file_url);
	if(!archivePath) {
		return null;
	}

	try {
		const archiveStat = await fs.stat(archivePath);
		const entry = await getSinglePrefabEntry(archivePath);
		if(!entry || !await validatePrefabEntry(archivePath, archiveStat, entry)) {
			return null;
		}

		return { ...prefab, archivePath, entry };
	} catch {
		return null;
	}
};

const normalizeAssetPath = (value) => {
	const decoded = decodeURIComponent(String(value || "")).replace(/\\/g, "/").replace(/^\/+/, "");
	const normalized = path.posix.normalize(decoded);
	const extension = path.posix.extname(normalized).toLowerCase();

	if(!normalized || normalized === "." || normalized.startsWith("../") || normalized.includes("\0") || !ALLOWED_ASSET_EXTENSIONS.has(extension)) {
		return null;
	}

	return normalized;
};

router.get("/assets/*", async (req, res) => {
	let assetPath = null;
	try {
		assetPath = normalizeAssetPath(req.params[0]);
	} catch {
		return res.status(400).json({ message: "Invalid Hytale asset path" });
	}

	if(!assetPath) {
		return res.status(400).json({ message: "Invalid Hytale asset path" });
	}

	try {
		const remote = await axios.get(`https://media.modifold.com/hytale-assets/${encodeURI(assetPath)}`, {
			responseType: "stream",
			timeout: 30_000,
			maxRedirects: 2,
		});
		res.status(remote.status);
		res.setHeader("Content-Type", remote.headers["content-type"] || "application/octet-stream");
		res.setHeader("Cache-Control", "public, max-age=86400, stale-while-revalidate=604800");
		if(remote.headers["content-length"]) {
			res.setHeader("Content-Length", remote.headers["content-length"]);
		}

		remote.data.on("error", () => res.destroy());
		remote.data.pipe(res);
	} catch(error) {
		const status = Number(error?.response?.status) || 502;
		return res.status(status).json({ message: "Hytale asset is unavailable" });
	}
});

router.get("/:slug/preview", async (req, res) => {
	res.setHeader("Cache-Control", "no-store");
	try {
		const prefab = await getLatestPrefab(req.params.slug);
		if(!prefab) {
			return res.status(404).json({ message: "The latest version does not contain exactly one valid prefab file" });
		}

		return res.json({
			project_slug: prefab.project_slug,
			version_id: prefab.version_id,
			version_number: prefab.version_number,
			file_name: path.posix.basename(prefab.entry),
			url: `/v2/prefabs/${encodeURIComponent(prefab.project_slug)}/preview/file`,
		});
	} catch(error) {
		console.error("Error finding prefab preview:", error);
		return res.status(500).json({ message: "Error finding prefab preview" });
	}
});

router.get("/:slug/preview/file", async (req, res) => {
	try {
		const prefab = await getLatestPrefab(req.params.slug);
		if(!prefab) {
			return res.status(404).json({ message: "The latest version does not contain exactly one valid prefab file" });
		}

		res.status(200);
		res.setHeader("Content-Type", "application/json; charset=utf-8");
		res.setHeader("Cache-Control", "no-store");
		res.setHeader("Content-Disposition", `inline; filename="${path.posix.basename(prefab.entry).replace(/\"/g, "")}"`);
		const acceptsGzip = /(?:^|,)\s*gzip\s*(?:,|$)/i.test(String(req.headers["accept-encoding"] || ""));
		const gzip = acceptsGzip ? createGzip({ level: 6 }) : null;
		if(gzip) {
			res.setHeader("Content-Encoding", "gzip");
			res.setHeader("Vary", "Accept-Encoding");
		}

		const child = spawn("unzip", ["-p", prefab.archivePath, prefab.entry], {
			stdio: ["ignore", "pipe", "pipe"],
		});
		let bytesSent = 0;
		let failed = false;

		child.stdout.on("data", (chunk) => {
			bytesSent += chunk.length;
			if(bytesSent > MAX_PREFAB_BYTES) {
				failed = true;
				child.kill("SIGKILL");
				res.destroy();
			}
		});
		child.stdout.on("error", () => res.destroy());
		if(gzip) {
			gzip.on("error", () => res.destroy());
			child.stdout.pipe(gzip).pipe(res);
		} else {
			child.stdout.pipe(res);
		}

		res.on("close", () => {
			if(!res.writableEnded) {
				child.kill("SIGKILL");
			}
		});

		child.on("error", () => {
			if(!res.headersSent) {
				res.status(500).json({ message: "Error reading prefab archive" });
			} else {
				res.destroy();
			}
		});
		
		child.on("close", (code) => {
			if((code !== 0 || failed) && !res.writableEnded) {
				res.destroy();
			}
		});
	} catch(error) {
		console.error("Error streaming prefab preview:", error);
		return res.status(500).json({ message: "Error streaming prefab preview" });
	}
});

module.exports = router;