const { cacheClient } = require("../config/cache");

const PROJECT_CACHE_VERSION_TTL_SECONDS = 60 * 60 * 24 * 14;

const getProjectCacheVersion = async (slug) => {
	const versionKey = `modifold_project_cache_v_${slug}`;

	try {
		const { value } = await cacheClient.get(versionKey);
		if(!value) {
			return "1";
		}

		return value.toString();
	} catch (error) {
		console.warn("Redis cache version read failed:", versionKey, error.message);
		return "1";
	}
};

const bumpProjectCacheVersion = async (slug) => {
	if(!slug) {
		return;
	}

	const versionKey = `modifold_project_cache_v_${slug}`;
	const nextVersion = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

	try {
		await cacheClient.set(versionKey, nextVersion, { expires: PROJECT_CACHE_VERSION_TTL_SECONDS });
	} catch (error) {
		console.warn("Redis cache version write failed:", versionKey, error.message);
	}
};

const bumpProjectCacheVersionById = async (db, projectId) => {
	if(!projectId) {
		return;
	}

	try {
		const [rows] = await db.query("SELECT slug FROM projects WHERE id = ? LIMIT 1", [projectId]);
		const slug = rows?.[0]?.slug;
		if(slug) {
			await bumpProjectCacheVersion(slug);
		}
	} catch (error) {
		console.warn("Failed to bump cache version by project id:", projectId, error.message);
	}
};

const shouldSkipProjectCacheBump = (req) => {
	const path = (req.path || "").toLowerCase();

	if(path.endsWith("/view")) return true;
	if(path.endsWith("/like")) return true;
	if(/\/versions\/[^/]+\/download$/.test(path)) return true;

	return false;
};

module.exports = {
	getProjectCacheVersion,
	bumpProjectCacheVersion,
	bumpProjectCacheVersionById,
	shouldSkipProjectCacheBump,
};