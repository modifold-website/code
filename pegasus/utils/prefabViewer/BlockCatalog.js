const DEFAULT_ASSET_BASE = "/hytale-assets";

const CACHE_BUST = new URL(import.meta.url).search;

let cached = null;
let loading = null;
let loadingAssetBase = null;

function lowercaseIndex(entries) {
	const index = new Map();
	for(const [id, entry] of Object.entries(entries)) {
		const key = id.toLowerCase();
		if(!index.has(key)) {
			index.set(key, entry);
		}
	}

	return index;
}

export async function loadCatalogs(assetBase = DEFAULT_ASSET_BASE) {
	if(cached && cached.assetBase === assetBase) {
		return cached;
	}

	const base = assetBase.replace(/\/$/, "");
	if(loading && loadingAssetBase === base) {
		return loading;
	}

	loadingAssetBase = base;
	loading = (async () => {
		const [blocksRes, modelsRes] = await Promise.all([
			fetch(`${base}/catalog/block_catalog.json${CACHE_BUST}`),
			fetch(`${base}/catalog/model_catalog.json${CACHE_BUST}`),
		]);

		if(!blocksRes.ok) {
			throw new Error(`Block catalog unavailable (${blocksRes.status})`);
		}

		if(!modelsRes.ok) {
			throw new Error(`Model catalog unavailable (${modelsRes.status})`);
		}

		const blocks = await blocksRes.json();
		const models = await modelsRes.json();
		cached = {
			blocks,
			models,
			blocksLower: lowercaseIndex(blocks),
			modelsLower: lowercaseIndex(models),
			assetBase: base,
		};
		return cached;
	})();

	try {
		return await loading;
	} finally {
		loading = null;
		loadingAssetBase = null;
	}
}

const FACE_KEY = /^(All|Up|Down|Sides|UpDown|North|South|East|West|Left|Right)$/i;

function normalizeStateOverride(override) {
	if(!override || typeof override !== "object") {
		return null;
	}

	if(Object.keys(override).some((k) => FACE_KEY.test(k))) {
		return { textures: override };
	}

	return override;
}

function findState(states, wanted) {
	if(!states) {
		return null;
	}

	if(states[wanted]) {
		return states[wanted];
	}

	const lower = wanted.toLowerCase();
	for(const [name, override] of Object.entries(states)) {
		if(name.toLowerCase() === lower) {
			return override;
		}
	}

	return null;
}

function applyBlockState(base, stateName, preferVariant) {
	const maps = preferVariant ? [base.variants, base.states] : [base.states, base.variants];
	const override = normalizeStateOverride(findState(maps[0], stateName) || findState(maps[1], stateName));
	if(!override) {
		return base;
	}

	const merged = { ...base, ...override };
	merged.states = override.states || null;
	merged.variants = override.variants || null;
	if(override.customModel) {
		merged.customModelTexture = override.customModelTexture || base.customModelTexture || null;
	} else if(override.textures) {
		merged.customModel = null;
		merged.customModelTexture = null;
	}

	return merged;
}

export function getBlockDef(name) {
	if(!cached) {
		return null;
	}

	const id = String(name || "");
	if(!id) {
		return null;
	}

	const direct = cached.blocks[id] || cached.blocksLower.get(id.toLowerCase());
	if(direct) {
		return direct;
	}

	const stateMatch = id.match(/^(\*?.+)_State_Definitions_(.+)$/) || id.match(/^(\*?.+)_State_(.+)$/);
	if(stateMatch) {
		const base = getBlockDef(stateMatch[1]);
		return base ? applyBlockState(base, stateMatch[2], !id.includes("_State_Definitions_")) : null;
	}

	if(id.startsWith("*")) {
		const bare = id.slice(1);
		return cached.blocks[bare] || cached.blocksLower.get(bare.toLowerCase()) || null;
	}

	return null;
}

export function getModelDef(modelId) {
	if(!cached) {
		return null;
	}

	const id = String(modelId || "");
	if(!id) {
		return null;
	}

	return cached.models[id] || cached.modelsLower.get(id.toLowerCase()) || null;
}

export function getAssetBase() {
	return cached?.assetBase || DEFAULT_ASSET_BASE;
}

export function assetUrl(assetPath) {
	const base = getAssetBase();
	let p = String(assetPath || "").replace(/\\/g, "/").replace(/^\/+/, "");
	if(p.startsWith("BlockTextures/")) {
		return `${base}/Common/${p}`;
	}

	if(p.startsWith("Common/")) {
		return `${base}/${p}`;
	}

	if(p.startsWith("Blocks/") || p.startsWith("NPC/") || p.startsWith("Characters/") || p.startsWith("Items/")) {
		return `${base}/Common/${p}`;
	}

	return `${base}/Common/${p}`;
}

export function resolveCubeFaces(def) {
	const t = def?.textures || {};
	const all = t.All || null;
	const upDown = t.UpDown || null;
	const sides = t.Sides || null;
	const up = t.Up || upDown || all;
	const down = t.Down || upDown || all;
	const north = t.North || t.back || sides || all;
	const south = t.South || t.front || sides || all;
	const east = t.East || t.Right || sides || all;
	const west = t.West || t.Left || sides || all;
	return { up, down, north, south, east, west };
}