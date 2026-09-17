const crypto = require("crypto");
const path = require("path");
const { execFile } = require("child_process");
const { promisify } = require("util");

const execFileAsync = promisify(execFile);
const MAX_ARCHIVE_LIST_BYTES = 8 * 1024 * 1024;
const MAX_REFERENCE_DOCUMENT_BYTES = 1024 * 1024;
const MAX_REFERENCE_DOCUMENTS = 240;
const MAX_ICON_ASSETS = 72;
const MAX_TEXTURE_OVERRIDES = 240;

const normalizeArchiveEntry = (value) => {
	const normalized = path.posix.normalize(String(value || "").replace(/\\/g, "/").replace(/^\/+/, ""));
	if(!normalized || normalized === "." || normalized === ".." || normalized.startsWith("../") || normalized.includes("\0")) {
		return null;
	}

	return normalized;
};

const isRenderableAssetPath = (entry) => (
	/^Common\/(Blocks|BlockTextures|Characters|Items|NPC|Resources)\//i.test(entry) &&
	!/(?:^|\/)Icons?\//i.test(entry)
);

const humanizeAssetName = (value) => {
	const stem = path.posix.basename(String(value || ""), path.posix.extname(String(value || "")));
	return stem
		.replace(/^(?:SSJP|JPT|HT|Hytale)_/i, "")
		.replace(/_Textures?$/i, "")
		.replace(/_/g, " ")
		.replace(/([a-z\d])([A-Z])/g, "$1 $2")
		.replace(/\s+/g, " ")
		.trim();
};

const comparableName = (value) => humanizeAssetName(value)
	.toLowerCase()
	.replace(/\b(?:model|texture|textures|mesh|icon|generated)\b/g, "")
	.replace(/\b(?:tier|level)\s*\d+\b/g, "")
	.replace(/\b(?:old|off|on)\b/g, "")
	.replace(/[^a-z0-9]+/g, " ")
	.trim();

const nameTokens = (value) => new Set(comparableName(value).split(/\s+/).filter((token) => token.length > 2));

const textureScore = (modelEntry, textureEntry) => {
	const modelStem = modelEntry.replace(/\.blockymodel$/i, "").toLowerCase();
	const textureStem = textureEntry.replace(/\.png$/i, "").toLowerCase();
	const modelDirectory = path.posix.dirname(modelEntry).toLowerCase();
	const textureDirectory = path.posix.dirname(textureEntry).toLowerCase();
	const modelName = comparableName(modelEntry);
	const textureName = comparableName(textureEntry);
	const compactModelName = modelName.replace(/\s+/g, "");
	const compactTextureName = textureName.replace(/\s+/g, "");
	let score = 0;

	if(textureStem === modelStem) {
		score += 320;
	}

	if(textureStem === `${modelStem}_texture` || textureStem === `${modelStem}_textures`) {
		score += 340;
	}

	if(modelName && modelName === textureName) {
		score += 260;
	}

	if(compactModelName && compactModelName === compactTextureName) {
		score += 250;
	}

	if(textureDirectory === modelDirectory) {
		score += 80;
	}

	if(textureDirectory.startsWith(`${modelDirectory}/`)) {
		score += 48;
	}

	const modelTokens = nameTokens(modelEntry);
	const textureTokens = nameTokens(textureEntry);
	let sharedTokens = 0;
	for(const token of modelTokens) {
		if(textureTokens.has(token)) {
			sharedTokens += 1;
		}
	}

	if(sharedTokens > 0) {
		score += sharedTokens * 42;
		score += Math.round((sharedTokens / Math.max(modelTokens.size, textureTokens.size, 1)) * 70);
	}

	return score;
};

const thumbnailScore = (modelEntry, imageEntry) => {
	const modelName = comparableName(modelEntry);
	const imageName = comparableName(imageEntry);
	let score = imageEntry.includes("/Icons/ItemsGenerated/") ? 80 : 0;
	if(modelName && imageName === modelName) {
		score += 300;
	}

	const modelTokens = nameTokens(modelEntry);
	const imageTokens = nameTokens(imageEntry);
	let sharedTokens = 0;
	for(const token of modelTokens) {
		if(imageTokens.has(token)) {
			sharedTokens += 1;
		}
	}

	if(sharedTokens > 0) {
		score += sharedTokens * 44;
		score += Math.round((sharedTokens / Math.max(modelTokens.size, imageTokens.size, 1)) * 80);
	}

	return score;
};

const findBestEntry = (sourceEntry, candidates, scoreEntry, minimumScore) => {
	let best = null;
	let bestScore = minimumScore;
	for(const candidate of candidates) {
		const score = scoreEntry(sourceEntry, candidate);
		if(score > bestScore) {
			best = candidate;
			bestScore = score;
		}
	}

	return best;
};

const createAssetId = (...parts) => crypto.createHash("sha256").update(parts.join("\0")).digest("base64url").slice(0, 16);

const listArchiveEntries = async (archivePath) => {
	const { stdout } = await execFileAsync("unzip", ["-l", archivePath], {
		maxBuffer: MAX_ARCHIVE_LIST_BYTES,
	});

	return String(stdout || "").split(/\r?\n/).map((line) => {
		const match = line.match(/^\s*\d+\s+\S+\s+\S+\s+(.+)$/);
		return match ? normalizeArchiveEntry(match[1].trim()) : null;
	}).filter(Boolean);
};

const normalizeReferencedAsset = (value) => {
	const entry = normalizeArchiveEntry(value);
	if(!entry) {
		return null;
	}

	return /^Common\//i.test(entry) ? entry : `Common/${entry}`;
};

const isPrimaryTexturePath = (entry) => {
	const fileName = path.posix.basename(String(entry || "")).toLowerCase();
	return fileName !== "empty.png" && !/^eyes?[_-]/.test(fileName);
};

const collectModelTextureReferences = (value, entries, references, depth = 0) => {
	if(!value || typeof value !== "object" || depth > 12) {
		return;
	}

	if(!Array.isArray(value)) {
		const modelValue = value.Model || value.model || value.CustomModel || value.customModel || value.ItemModel || value.itemModel;
		const textureValue = value.Texture || value.texture || value.CustomModelTexture || value.customModelTexture || value.ItemTexture || value.itemTexture;
		const modelPath = typeof modelValue === "string" ? normalizeReferencedAsset(modelValue) : null;
		const texturePath = typeof textureValue === "string" ? normalizeReferencedAsset(textureValue) : null;
		if(modelPath?.toLowerCase().endsWith(".blockymodel") && texturePath?.toLowerCase().endsWith(".png") && isPrimaryTexturePath(texturePath) && entries.has(modelPath) && entries.has(texturePath) && !references.has(modelPath)) {
			references.set(modelPath, texturePath);
		}
	}

	for(const child of Object.values(value)) {
		if(child && typeof child === "object") {
			collectModelTextureReferences(child, entries, references, depth + 1);
		}
	}
};

const findReferencedTextures = async (archivePath, entries) => {
	const references = new Map();
	const documents = [...entries]
		.filter((entry) => /^(?:Server|Common)\/(?:Models|Items|Blocks|NPC|Characters|Resources)\/.+\.json$/i.test(entry))
		.slice(0, MAX_REFERENCE_DOCUMENTS);

	for(let offset = 0; offset < documents.length; offset += 8) {
		const batch = documents.slice(offset, offset + 8);
		await Promise.all(batch.map(async (entry) => {
			try {
				const { stdout } = await execFileAsync("unzip", ["-p", archivePath, entry], {
					maxBuffer: MAX_REFERENCE_DOCUMENT_BYTES,
				});
				collectModelTextureReferences(JSON.parse(String(stdout || "")), entries, references);
			} catch {}
		}));
	}

	return references;
};

const inspectIconArchive = async (archivePath) => {
	const entries = await listArchiveEntries(archivePath);
	const entrySet = new Set(entries);
	const referencedTextures = await findReferencedTextures(archivePath, entrySet);
	const models = entries.filter((entry) => (
		entry.toLowerCase().endsWith(".blockymodel") &&
		isRenderableAssetPath(entry) &&
		(!/^Common\/(?:Characters|NPC)\//i.test(entry) || referencedTextures.has(entry))
	));
	const textures = entries.filter((entry) => entry.toLowerCase().endsWith(".png") && isRenderableAssetPath(entry) && isPrimaryTexturePath(entry));
	const generatedIcons = entries.filter((entry) => /\/Icons\/(?:Items|Models)Generated\/.+\.png$/i.test(entry));
	const assets = models.map((modelPath) => {
		const thumbnailPath = findBestEntry(modelPath, generatedIcons, thumbnailScore, 132);
		const texturePath = referencedTextures.get(modelPath)
			|| findBestEntry(modelPath, textures, textureScore, 92)
			|| (thumbnailPath ? findBestEntry(thumbnailPath, textures, thumbnailScore, 118) : null);
		return {
			id: createAssetId(modelPath, texturePath),
			kind: "model",
			name: humanizeAssetName(modelPath),
			model_path: modelPath,
			texture_path: texturePath,
			thumbnail_path: thumbnailPath,
		};
	}).filter((asset) => asset.texture_path).slice(0, MAX_ICON_ASSETS);
	const usedTextures = new Set(assets.map((asset) => asset.texture_path).filter(Boolean));
	const textureOverrides = textures
		.filter((texturePath) => !usedTextures.has(texturePath))
		.slice(0, MAX_TEXTURE_OVERRIDES)
		.map((texturePath) => ({
			id: createAssetId("texture", texturePath),
			name: humanizeAssetName(texturePath),
			texture_path: texturePath,
		}));

	return {
		assets,
		textureOverrides,
		entries: entrySet,
		stats: {
			models: models.length,
			textures: textures.length,
		},
	};
};

module.exports = {
	humanizeAssetName,
	inspectIconArchive,
	normalizeArchiveEntry,
};