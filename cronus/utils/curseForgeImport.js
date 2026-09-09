const crypto = require("crypto");
const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const { Readable } = require("stream");
const { pipeline } = require("stream/promises");
const sharp = require("sharp");
const slugify = require("slugify");

const { logger } = require("../packages/shared/logger");
const { db } = require("../config/db");
const { enqueueJob } = require("./asyncJobs");
const { getFileDownloadUrl, getMod, getModDescription, getModFiles } = require("./curseForge");
const { deleteObject, getPublicUrl, getUploadTempRoot, uploadFile } = require("./fileHosting");
const { sanitizeMarkdownText, sanitizePlainText } = require("./sanitize");

const IMPORT_JOB_TYPE = "project.import.curseforge";
const MAX_PROJECTS_PER_IMPORT = 10;
const MAX_VERSION_FILES = 10;
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const MAX_VERSION_BYTES = 100 * 1024 * 1024;
const ALLOWED_MEDIA_HOST_SUFFIXES = ["forgecdn.net", "curseforge.com"];

const generateProjectId = () => crypto.randomBytes(4).toString("base64url");
const generateImportId = () => crypto.randomUUID();
const hashVerificationCode = (code) => crypto.createHash("sha256").update(String(code)).digest("hex");

const buildVerificationCode = () => crypto.randomBytes(3).toString("hex").toUpperCase();

const isAllowedMediaUrl = (value) => {
	try {
		const url = new URL(String(value || ""));
		const hostname = url.hostname.toLowerCase();
		return url.protocol === "https:" && ALLOWED_MEDIA_HOST_SUFFIXES.some((suffix) => hostname === suffix || hostname.endsWith(`.${suffix}`));
	} catch {
		return false;
	}
};

const normalizeFilename = (value, fallback) => {
	const parsed = path.parse(path.basename(String(value || fallback || "file")));
	const stem = parsed.name.replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/^[_\-.]+|[_\-.]+$/g, "").slice(0, 100) || "file";
	const extension = parsed.ext.replace(/^\./, "").replace(/[^a-zA-Z0-9]+/g, "").toLowerCase().slice(0, 12);
	return extension ? `${stem}.${extension}` : stem;
};

const getContentLength = (response) => {
	const header = response.headers.get("content-length");
	if(header === null) {
		return null;
	}

	const value = Number(header);
	return Number.isFinite(value) && value >= 0 ? value : null;
};

const fetchAllowedMedia = async (value) => {
	let currentUrl = value;
	for(let redirectCount = 0; redirectCount <= 5; redirectCount += 1) {
		if(!isAllowedMediaUrl(currentUrl)) {
			const error = new Error("CurseForge returned an unsupported download host");
			error.retryable = false;
			throw error;
		}

		const response = await fetch(currentUrl, { signal: AbortSignal.timeout(120000), redirect: "manual" });
		if(response.status < 300 || response.status >= 400) {
			return response;
		}

		const location = response.headers.get("location");
		await response.body?.cancel().catch(() => undefined);
		if(!location) {
			const error = new Error("CurseForge download redirect has no destination");
			error.retryable = false;
			throw error;
		}

		currentUrl = new URL(location, currentUrl).toString();
	}

	const error = new Error("CurseForge download redirected too many times");
	error.retryable = false;
	throw error;
};

const downloadRemoteFileOnce = async ({ url, filename, maximumBytes }) => {
	const response = await fetchAllowedMedia(url);
	if(!response.ok || !response.body) {
		const error = new Error(`Remote download failed (${response.status})`);
		error.retryable = response.status === 429 || response.status >= 500;
		error.retryAfter = Number(response.headers.get("retry-after")) || null;
		throw error;
	}

	const contentLength = getContentLength(response);
	if(contentLength !== null && contentLength > maximumBytes) {
		const error = new Error(`Remote file exceeds the ${Math.floor(maximumBytes / 1024 / 1024)} MiB limit`);
		error.retryable = false;
		throw error;
	}

	const directory = getUploadTempRoot();
	await fsp.mkdir(directory, { recursive: true });
	const filePath = path.join(directory, `${crypto.randomUUID()}-${normalizeFilename(filename, "download")}`);
	let received = 0;
	const source = Readable.fromWeb(response.body);
	const sizeGuard = async function* (stream) {
		for await (const chunk of stream) {
			received += chunk.length;
			if(received > maximumBytes) {
				const error = new Error(`Remote file exceeds the ${Math.floor(maximumBytes / 1024 / 1024)} MiB limit`);
				error.retryable = false;
				throw error;
			}

			yield chunk;
		}
	};

	try {
		await pipeline(sizeGuard(source), fs.createWriteStream(filePath, { flags: "wx" }));
		return {
			path: filePath,
			filename: normalizeFilename(filename, "download"),
			mimetype: response.headers.get("content-type")?.split(";")[0] || "application/octet-stream",
			size: received,
		};
	} catch(error) {
		await fsp.unlink(filePath).catch(() => undefined);
		throw error;
	}
};

const downloadRemoteFile = async (options) => {
	let lastError;
	for(let attempt = 1; attempt <= 3; attempt += 1) {
		try {
			return await downloadRemoteFileOnce(options);
		} catch(error) {
			lastError = error;
			if(attempt >= 3 || error.retryable === false) {
				throw error;
			}

			const retryAfterMs = error.retryAfter ? Math.min(60000, error.retryAfter * 1000) : 0;
			const backoffMs = retryAfterMs || Math.min(10000, (2 ** attempt) * 500) + Math.floor(Math.random() * 250);
			await new Promise((resolve) => setTimeout(resolve, backoffMs));
		}
	}

	throw lastError;
};

const mapWithConcurrency = async (items, concurrency, operation) => {
	const results = new Array(items.length);
	let nextIndex = 0;
	const workers = Array.from({ length: Math.min(items.length, concurrency) }, async () => {
		while(nextIndex < items.length) {
			const index = nextIndex;
			nextIndex += 1;
			results[index] = await operation(items[index], index);
		}
	});

	await Promise.all(workers);
	return results;
};

const updateItem = async (itemId, values) => {
	await db.query("UPDATE project_import_items SET ? WHERE id = ?", [values, itemId]);
};

const updateStage = async (item, stage, progress) => {
	await updateItem(item.id, { stage, progress });
	await db.query("UPDATE project_imports SET status = 'processing', current_stage = ? WHERE id = ?", [stage, item.import_id]);
};

const summarizeCandidate = (candidate) => ({
	id: Number(candidate.id),
	name: String(candidate.name || "Untitled project"),
	slug: String(candidate.slug || ""),
	summary: String(candidate.summary || ""),
	iconUrl: candidate.iconUrl || null,
	websiteUrl: candidate.websiteUrl || null,
	classId: candidate.classId || null,
	categories: candidate.categories || [],
	authors: candidate.authors || [],
	projectType: resolveProjectType(candidate),
	alreadyImported: Boolean(candidate.alreadyImported),
	nameConflict: Boolean(candidate.nameConflict),
});

const normalizeComparableTitle = (value) => sanitizePlainText(value || "").trim().slice(0, 70).toLocaleLowerCase();

const annotateCandidateConflicts = async (userId, candidates) => {
	const sourceIds = [...new Set(candidates.map((candidate) => String(candidate.id)))];
	const titles = [...new Set(candidates.map((candidate) => sanitizePlainText(candidate.name || "").trim().slice(0, 70)).filter(Boolean))];
	const [sourceRows, titleRows] = await Promise.all([
		db.query(
			"SELECT source_project_id FROM projects WHERE source_platform = 'curseforge' AND source_project_id IN (?)",
			[sourceIds]
		),
		titles.length ? db.query("SELECT title FROM projects WHERE user_id = ? AND title IN (?)", [userId, titles]) : Promise.resolve([[]]),
	]);
	const importedSourceIds = new Set(sourceRows[0].map((row) => String(row.source_project_id)));
	const ownedTitles = new Set(titleRows[0].map((row) => normalizeComparableTitle(row.title)));

	return candidates.map((candidate) => {
		const alreadyImported = importedSourceIds.has(String(candidate.id));
		return {
			...candidate,
			alreadyImported,
			nameConflict: !alreadyImported && ownedTitles.has(normalizeComparableTitle(candidate.name)),
		};
	});
};

const createImportSession = async ({ userId, method, profileUrl = null, candidates, verificationCode = null, verificationProjectId = null }) => {
	const importId = generateImportId();
	const requiresVerification = Boolean(verificationCode);
	const preparedCandidates = await annotateCandidateConflicts(userId, candidates);
	const connection = await db.getConnection();
	try {
		await connection.beginTransaction();
		await connection.query(
			`INSERT INTO project_imports
			(id, user_id, provider, method, status, profile_url, verification_code_hash, verification_project_id, verification_expires_at, total_items)
			VALUES (?, ?, 'curseforge', ?, ?, ?, ?, ?, ?, ?)`,
			[
				importId,
				userId,
				method,
				requiresVerification ? "awaiting_verification" : "ready",
				profileUrl,
				verificationCode ? hashVerificationCode(verificationCode) : null,
				verificationProjectId,
				requiresVerification ? new Date(Date.now() + 30 * 60 * 1000) : null,
				candidates.length,
			]
		);

		for(const candidate of preparedCandidates) {
			await connection.query(
				`INSERT INTO project_import_items
				(id, import_id, curseforge_project_id, source_url, source_data)
				VALUES (?, ?, ?, ?, ?)`,
				[generateImportId(), importId, candidate.id, candidate.websiteUrl, JSON.stringify(summarizeCandidate(candidate))]
			);
		}

		await connection.commit();
		return importId;
	} catch(error) {
		await connection.rollback();
		throw error;
	} finally {
		connection.release();
	}
};

const getImportForUser = async (importId, userId) => {
	const [[session]] = await db.query("SELECT * FROM project_imports WHERE id = ? AND user_id = ? LIMIT 1", [importId, userId]);
	if(!session) {
		const error = new Error("Import not found");
		error.statusCode = 404;
		throw error;
	}

	const [items] = await db.query(
		`SELECT id, curseforge_project_id, source_url, source_data, selected, status, stage, progress,
		modifold_project_id, modifold_project_slug, warning_message, error_message
		FROM project_import_items WHERE import_id = ? ORDER BY created_at ASC`,
		[importId]
	);

	return {
		...session,
		items: items.map((item) => ({
			...item,
			selected: Boolean(item.selected),
			source_data: typeof item.source_data === "string" ? JSON.parse(item.source_data) : item.source_data,
		})),
	};
};

const startImport = async ({ importId, userId, selectedProjectIds }) => {
	const normalizedIds = [...new Set((selectedProjectIds || []).map(Number).filter(Number.isInteger))];
	if(!normalizedIds.length) {
		const error = new Error("Select at least one project");
		error.statusCode = 400;
		throw error;
	}

	const connection = await db.getConnection();
	try {
		await connection.beginTransaction();
		const [[session]] = await connection.query("SELECT * FROM project_imports WHERE id = ? AND user_id = ? FOR UPDATE", [importId, userId]);
		if(!session) {
			const error = new Error("Import not found");
			error.statusCode = 404;
			throw error;
		}

		if(session.status !== "ready") {
			const error = new Error("Import is not ready to start");
			error.statusCode = 409;
			throw error;
		}

		if(normalizedIds.length > MAX_PROJECTS_PER_IMPORT) {
			const error = new Error(`An import is limited to ${MAX_PROJECTS_PER_IMPORT} projects`);
			error.statusCode = 400;
			throw error;
		}

		const [items] = await connection.query("SELECT id, curseforge_project_id, source_data FROM project_import_items WHERE import_id = ? FOR UPDATE", [importId]);
		const selectedSet = new Set(normalizedIds);
		const selectedItems = items.filter((item) => selectedSet.has(Number(item.curseforge_project_id)));
		if(selectedItems.length !== normalizedIds.length) {
			const error = new Error("One or more selected projects do not belong to this import");
			error.statusCode = 400;
			throw error;
		}

		if(selectedItems.some((item) => {
			const sourceData = typeof item.source_data === "string" ? JSON.parse(item.source_data) : item.source_data;
			return sourceData?.alreadyImported;
		})) {
			const error = new Error("One or more selected CurseForge projects have already been imported");
			error.statusCode = 409;
			throw error;
		}

		await connection.query("UPDATE project_import_items SET selected = 0, status = 'skipped', stage = 'skipped', progress = 100 WHERE import_id = ?", [importId]);
		for(const item of selectedItems) {
			await connection.query("UPDATE project_import_items SET selected = 1, status = 'pending', stage = 'queued', progress = 0 WHERE id = ?", [item.id]);
			await enqueueJob({
				connection,
				jobType: IMPORT_JOB_TYPE,
				idempotencyKey: `curseforge-import:${item.id}`,
				payload: { importId, itemId: item.id, userId },
				maxAttempts: 3,
			});
		}

		await connection.query(
			"UPDATE project_imports SET status = 'queued', total_items = ?, completed_items = 0, failed_items = 0, current_stage = 'queued', error_message = NULL WHERE id = ?",
			[selectedItems.length, importId]
		);

		await connection.commit();
	} catch(error) {
		await connection.rollback();
		throw error;
	} finally {
		connection.release();
	}
};

const retryImportItem = async ({ importId, itemId, userId }) => {
	const connection = await db.getConnection();
	try {
		await connection.beginTransaction();
		const [[session]] = await connection.query("SELECT id FROM project_imports WHERE id = ? AND user_id = ? FOR UPDATE", [importId, userId]);
		if(!session) {
			const error = new Error("Import not found");
			error.statusCode = 404;
			throw error;
		}

		const [[item]] = await connection.query(
			"SELECT id, status FROM project_import_items WHERE id = ? AND import_id = ? AND selected = 1 FOR UPDATE",
			[itemId, importId]
		);

		if(!item) {
			const error = new Error("Import item not found");
			error.statusCode = 404;
			throw error;
		}

		if(item.status !== "failed") {
			const error = new Error("Only a failed import item can be retried");
			error.statusCode = 409;
			throw error;
		}

		const idempotencyKey = `curseforge-import:${item.id}`;
		const [[job]] = await connection.query("SELECT id, status FROM async_jobs WHERE idempotency_key = ? FOR UPDATE", [idempotencyKey]);
		if(job && job.status !== "dead") {
			const error = new Error("This import item is already queued or processing");
			error.statusCode = 409;
			throw error;
		}

		if(job) {
			await connection.query(
				`UPDATE async_jobs SET status = 'pending', attempts = 0, available_at = UTC_TIMESTAMP(3),
				locked_at = NULL, locked_until = NULL, locked_by = NULL, last_error = NULL, completed_at = NULL
				WHERE id = ?`,
				[job.id]
			);
		} else {
			await enqueueJob({
				connection,
				jobType: IMPORT_JOB_TYPE,
				idempotencyKey,
				payload: { importId, itemId: item.id, userId },
				maxAttempts: 3,
			});
		}

		await connection.query(
			"UPDATE project_import_items SET status = 'pending', stage = 'queued', progress = 0, error_message = NULL WHERE id = ?",
			[item.id]
		);

		await connection.query(
			`UPDATE project_imports SET status = 'queued', failed_items = GREATEST(failed_items - 1, 0),
			current_stage = 'queued', error_message = NULL, completed_at = NULL WHERE id = ?`,
			[importId]
		);

		await connection.commit();
	} catch(error) {
		await connection.rollback();
		throw error;
	} finally {
		connection.release();
	}
};

const makeUniqueSlug = async (title, sourceId) => {
	const base = slugify(title, { replacement: "-", lower: true, strict: true, remove: /[^a-zA-Z0-9\s]/g }).slice(0, 220) || `curseforge-${sourceId}`;
	let slug = base;
	for(let attempt = 0; attempt < 20; attempt += 1) {
		const [[existing]] = await db.query("SELECT id FROM projects WHERE slug = ? LIMIT 1", [slug]);
		if(!existing) {
			return slug;
		}

		slug = `${base}-${String(sourceId).slice(-8)}${attempt ? `-${attempt + 1}` : ""}`;
	}

	throw new Error("Unable to generate a unique project slug");
};

const resolveProjectType = (candidate) => {
	let classSlug = "";
	try {
		classSlug = new URL(candidate.websiteUrl).pathname.split("/").filter(Boolean)[1]?.toLowerCase() || "";
	} catch {}
	if(/prefab|blueprint|schematic/.test(classSlug)) return "prefab";
	if(/world|map/.test(classSlug)) return "world";
	if(/modpack|pack/.test(classSlug)) return "modpack";
	if(/mod/.test(classSlug)) return "mod";
	const categoryNames = (candidate.categories || []).flatMap((category) => [category.name, category.slug]).join(" ").toLowerCase();
	if(/prefab|blueprint|schematic/.test(categoryNames)) return "prefab";
	if(/world|map/.test(categoryNames)) return "world";
	if(/modpack/.test(categoryNames)) return "modpack";
	return "mod";
};

const normalizeTag = (value) => String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
const TAG_ALIASES = new Map([
	["adventures", "adventure"],
	["cosmetic", "cosmetics"],
	["decor", "decoration"],
	["decorative", "decoration"],
	["minigames", "minigame"],
	["qualityoflife", "utility"],
	["qol", "utility"],
	["roleplaying", "roleplay"],
]);

const mapTags = async (projectType, categories) => {
	const [rows] = await db.query("SELECT name FROM project_tags WHERE project_type = ? AND is_active = 1 ORDER BY sort_order ASC, name ASC", [projectType]);
	const available = new Map(rows.map((row) => [normalizeTag(row.name), row.name]));
	const matches = [];
	for(const category of categories || []) {
		const normalized = normalizeTag(category.name || category.slug);
		const target = TAG_ALIASES.get(normalized) || normalized;
		const match = available.get(target);
		if(match && !matches.includes(match)) {
			matches.push(match);
		}
	}

	return matches.slice(0, 3);
};

const normalizeSummary = (summary, title) => {
	let value = sanitizePlainText(summary || "").slice(0, 256);
	if(value.length < 30) {
		value = sanitizePlainText(`${value}${value ? " — " : ""}${title} imported from CurseForge.`).slice(0, 256);
	}

	return value;
};

const storeImage = async ({ projectId, url, prefix, index = 0 }) => {
	const urlHash = crypto.createHash("sha256").update(url).digest("hex").slice(0, 16);
	const downloaded = await downloadRemoteFile({ url, filename: `${prefix}-${index}-${urlHash}`, maximumBytes: MAX_IMAGE_BYTES });
	const convertedPath = `${downloaded.path}.webp`;
	
	try {
		await sharp(downloaded.path).rotate().webp({ quality: 82, effort: 4 }).toFile(convertedPath);
		await fsp.unlink(downloaded.path).catch(() => undefined);
		const objectKey = `projects/${projectId}/${prefix}-${index}-${urlHash}.webp`;
		await uploadFile({ key: objectKey, filePath: convertedPath, contentType: "image/webp" });
		return getPublicUrl(objectKey);
	} catch(error) {
		await Promise.all([fsp.unlink(downloaded.path).catch(() => undefined), fsp.unlink(convertedPath).catch(() => undefined)]);
		throw error;
	}
};

const createOrUpdateProject = async ({ item, mod, description, candidate, userId }) => {
	const [[existing]] = await db.query("SELECT id, slug, user_id FROM projects WHERE source_platform = 'curseforge' AND source_project_id = ? LIMIT 1", [String(mod.id)]);
	if(existing) {
		if(String(existing.user_id) !== String(userId)) {
			const error = new Error("This CurseForge project has already been imported");
			error.statusCode = 409;
			throw error;
		}

		await updateItem(item.id, { modifold_project_id: existing.id, modifold_project_slug: existing.slug });
		return existing;
	}

	const projectId = generateProjectId();
	const title = sanitizePlainText(mod.name || candidate.name || "CurseForge project").slice(0, 70) || "CurseForge project";
	const slug = await makeUniqueSlug(title, mod.id);
	const projectType = resolveProjectType(candidate);
	const tags = await mapTags(projectType, mod.categories || candidate.categories);
	const safeDescription = sanitizeMarkdownText(String(description || "").slice(0, 60000));
	await db.query(
		`INSERT INTO projects
		(id, slug, user_id, title, summary, description, visibility, project_type, icon_url, license_id, license_name, tags, source_platform, source_project_id)
		VALUES (?, ?, ?, ?, ?, ?, 'public', ?, ?, 'arr', 'All Rights Reserved / No License', ?, 'curseforge', ?)`,
		[
			projectId,
			slug,
			userId,
			title,
			normalizeSummary(mod.summary, title),
			safeDescription,
			projectType,
			"https://cdn.modifold.com/static/no-project-icon.svg",
			tags.join(","),
			String(mod.id),
		]
	);

	await updateItem(item.id, { modifold_project_id: projectId, modifold_project_slug: slug });
	return { id: projectId, slug };
};

const importIcon = async ({ project, mod }) => {
	const iconUrl = mod.logo?.url || mod.logo?.thumbnailUrl;
	if(!iconUrl) {
		return null;
	}

	const storedUrl = await storeImage({ projectId: project.id, url: iconUrl, prefix: "curseforge-icon" });
	await db.query("UPDATE projects SET icon_url = ? WHERE id = ?", [storedUrl, project.id]);
	return storedUrl;
};

const importGallery = async ({ project, mod }) => {
	const screenshots = Array.isArray(mod.screenshots) ? mod.screenshots.slice(0, 20) : [];
	const results = await mapWithConcurrency(screenshots, 3, async (screenshot, index) => {
		const remoteUrl = screenshot.url || screenshot.thumbnailUrl;
		if(!remoteUrl) {
			return false;
		}

		try {
			const storedUrl = await storeImage({ projectId: project.id, url: remoteUrl, prefix: "curseforge-gallery", index });
			const [[existing]] = await db.query("SELECT id FROM project_gallery WHERE project_id = ? AND url = ? LIMIT 1", [project.id, storedUrl]);
			if(!existing) {
				await db.query(
					`INSERT INTO project_gallery (project_id, media_type, url, raw_url, title, description, ordering, featured)
					VALUES (?, 'image', ?, ?, ?, NULL, ?, ?)`,
					[project.id, storedUrl, storedUrl, sanitizePlainText(screenshot.title || "") || null, index, index === 0]
				);
			}

			return true;
		} catch(error) {
			logger.warn(`CurseForge gallery image skipped for project ${mod.id}: ${error.message}`);
			return false;
		}
	});

	return results.filter(Boolean).length;
};

const getReleaseChannel = (releaseType) => ({ 1: "release", 2: "beta", 3: "alpha" }[Number(releaseType)] || "release");

const mapCurseForgeGameVersions = (sourceVersions, activeVersions) => {
	const normalizedSourceVersions = [...new Set((sourceVersions || []).map((version) => String(version || "").trim()).filter(Boolean))];
	if(normalizedSourceVersions.some((version) => version.toLowerCase() === "early access")) {
		return activeVersions;
	}

	return activeVersions.filter((activeVersion) => normalizedSourceVersions.some((sourceVersion) => (
		activeVersion === sourceVersion
		|| (/^\d+(?:\.\d+)?$/.test(sourceVersion) && (activeVersion.startsWith(`${sourceVersion}.`) || activeVersion.startsWith(`${sourceVersion}-`)))
	)));
};

const importVersions = async ({ project, mod }) => {
	const [files, activeVersionsRows] = await Promise.all([
		getModFiles(mod.id),
		db.query("SELECT version FROM game_versions WHERE is_active = 1 AND version_type = 'release' AND (version = '0.4' OR version LIKE '0.5.%' OR version LIKE '0.6.%') ORDER BY id DESC"),
	]);
	const activeVersions = activeVersionsRows[0].map((row) => String(row.version));
	const latestFiles = files
		.toSorted((left, right) => new Date(right.fileDate || 0) - new Date(left.fileDate || 0))
		.slice(0, MAX_VERSION_FILES)
		.reverse();
	const results = await mapWithConcurrency(latestFiles, 1, async (file) => {
		const sourceFileId = String(file.id);
		const [[existing]] = await db.query(
			"SELECT id FROM project_versions WHERE project_id = ? AND source_platform = 'curseforge' AND source_file_id = ? LIMIT 1",
			[project.id, sourceFileId]
		);

		if(existing) {
			return { imported: true, warning: null };
		}

		const gameVersions = mapCurseForgeGameVersions(file.gameVersions, activeVersions);
		if(!gameVersions.length) {
			return { imported: false, warning: `${file.displayName || file.fileName}: no matching active Hytale version` };
		}

		if(Number(file.fileLength || 0) > MAX_VERSION_BYTES) {
			return { imported: false, warning: `${file.displayName || file.fileName}: file is larger than 100 MiB` };
		}

		try {
			const downloadUrl = file.downloadUrl || await getFileDownloadUrl(mod.id, file.id);
			if(!downloadUrl) {
				return { imported: false, warning: `${file.displayName || file.fileName}: downloads are disabled by the author` };
			}

			const filename = normalizeFilename(file.fileName, `curseforge-${file.id}.zip`);
			const downloaded = await downloadRemoteFile({ url: downloadUrl, filename, maximumBytes: MAX_VERSION_BYTES });
			const versionId = generateProjectId();
			const quarantineKey = `quarantine/projects/${project.id}/versions/${versionId}/${filename}`;
			try {
				await uploadFile({ key: quarantineKey, filePath: downloaded.path, contentType: downloaded.mimetype, publicity: "private" });
			} catch(error) {
				await fsp.unlink(downloaded.path).catch(() => undefined);
				throw error;
			}

			const versionNumber = sanitizePlainText(file.displayName || path.parse(filename).name).slice(0, 255) || `CurseForge ${file.id}`;
			try {
				await db.query(
					`INSERT INTO project_versions
					(id, project_id, version_number, changelog, release_channel, file_url, quarantine_key, source_platform, source_file_id, file_size, game_versions, loaders, moderation_status, scan_requested_at)
					VALUES (?, ?, ?, NULL, ?, NULL, ?, 'curseforge', ?, ?, ?, ?, 'draft', NULL)`,
					[
						versionId,
						project.id,
						versionNumber,
						getReleaseChannel(file.releaseType),
						quarantineKey,
						sourceFileId,
						downloaded.size,
						JSON.stringify(gameVersions),
						JSON.stringify(["Vanilla"]),
					]
				);
			} catch(error) {
				await deleteObject(quarantineKey, "private").catch(() => undefined);
				throw error;
			}

			return { imported: true, warning: null };
		} catch(error) {
			logger.warn(`CurseForge version skipped for project ${mod.id}: ${error.message}`);
			return { imported: false, warning: `${file.displayName || file.fileName}: ${error.message}` };
		}
	});

	return {
		imported: results.filter((result) => result.imported).length,
		requested: latestFiles.length,
		warnings: results.map((result) => result.warning).filter(Boolean),
	};
};

const refreshImportTotals = async (importId) => {
	const [[totals]] = await db.query(
		`SELECT
		SUM(status = 'completed') AS completed_items,
		SUM(status = 'failed') AS failed_items,
		SUM(status IN ('pending', 'processing')) AS active_items
		FROM project_import_items WHERE import_id = ? AND selected = 1`,
		[importId]
	);
	const completed = Number(totals.completed_items || 0);
	const failed = Number(totals.failed_items || 0);
	const active = Number(totals.active_items || 0);
	let status = "processing";
	if(active === 0) {
		status = failed === 0 ? "completed" : completed === 0 ? "failed" : "partial";
	}

	await db.query(
		`UPDATE project_imports SET completed_items = ?, failed_items = ?, status = ?,
		current_stage = ?, completed_at = IF(? IN ('completed', 'partial', 'failed'), UTC_TIMESTAMP(3), NULL)
		WHERE id = ?`,
		[completed, failed, status, active === 0 ? "finished" : "importing", status, importId]
	);
};

const processImportJob = async (job) => {
	const { itemId, userId } = job.payload;
	const [[row]] = await db.query("SELECT * FROM project_import_items WHERE id = ? AND selected = 1 LIMIT 1", [itemId]);
	if(!row) {
		return;
	}

	const item = {
		...row,
		source_data: typeof row.source_data === "string" ? JSON.parse(row.source_data) : row.source_data,
	};

	if(item.status === "completed") {
		await refreshImportTotals(item.import_id);
		return;
	}

	await updateItem(item.id, { status: "processing", error_message: null });
	await updateStage(item, "metadata", 10);
	const [mod, description] = await Promise.all([getMod(item.curseforge_project_id), getModDescription(item.curseforge_project_id)]);
	const project = await createOrUpdateProject({ item, mod, description, candidate: item.source_data, userId });

	const warnings = [];
	await updateStage(item, "icon", 30);
	try {
		await importIcon({ project, mod });
	} catch(error) {
		warnings.push(`Icon: ${error.message}`);
	}

	await updateStage(item, "gallery", 50);
	await importGallery({ project, mod });
	await updateStage(item, "versions", 65);
	const versionResult = await importVersions({ project, mod });
	warnings.push(...versionResult.warnings);

	await updateItem(item.id, {
		status: "completed",
		stage: "completed",
		progress: 100,
		modifold_project_id: project.id,
		modifold_project_slug: project.slug,
		warning_message: warnings.length ? warnings.join(" | ").slice(0, 1000) : null,
	});

	await refreshImportTotals(item.import_id);
};

const markImportJobFailed = async (job, error) => {
	const itemId = job.payload?.itemId;
	if(!itemId) {
		return;
	}

	const [[item]] = await db.query("SELECT import_id FROM project_import_items WHERE id = ? LIMIT 1", [itemId]);
	if(!item) {
		return;
	}
	
	await updateItem(itemId, {
		status: "failed",
		stage: "failed",
		error_message: String(error?.message || error || "Import failed").slice(0, 1000),
	});

	await refreshImportTotals(item.import_id);
};

module.exports = {
	IMPORT_JOB_TYPE,
	MAX_PROJECTS_PER_IMPORT,
	buildVerificationCode,
	createImportSession,
	getImportForUser,
	hashVerificationCode,
	markImportJobFailed,
	processImportJob,
	resolveProjectType,
	retryImportItem,
	startImport,
};