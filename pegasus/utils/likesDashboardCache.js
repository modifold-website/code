const LIKES_DASHBOARD_TTL_MS = 60000;
const likesDashboardCache = new Map();

function getCacheKey(page, limit) {
	return `${page}:${limit}`;
}

function getLikesDashboardCache(page, limit) {
	const key = getCacheKey(page, limit);
	return likesDashboardCache.get(key) || null;
}

function setLikesDashboardCache(page, limit, data) {
	const key = getCacheKey(page, limit);
	likesDashboardCache.set(key, {
		...data,
		fetchedAt: Date.now(),
	});
}

function isLikesDashboardCacheFresh(entry) {
	if(!entry?.fetchedAt) {
		return false;
	}

	return (Date.now() - entry.fetchedAt) < LIKES_DASHBOARD_TTL_MS;
}

function clearLikesDashboardCache() {
	likesDashboardCache.clear();
}

export {
	LIKES_DASHBOARD_TTL_MS,
	getLikesDashboardCache,
	setLikesDashboardCache,
	isLikesDashboardCacheFresh,
	clearLikesDashboardCache,
};