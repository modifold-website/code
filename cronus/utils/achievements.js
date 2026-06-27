const ACHIEVEMENT_CODES = {
	FIRST_PROJECT: "first_project",
	DOWNLOADS_100: "downloads_100",
	DOWNLOADS_500: "downloads_500",
};

const DOWNLOAD_ACHIEVEMENT_THRESHOLDS = [
	{ minDownloads: 100, code: ACHIEVEMENT_CODES.DOWNLOADS_100 },
	{ minDownloads: 500, code: ACHIEVEMENT_CODES.DOWNLOADS_500 },
];

const awardAchievementToUser = async (db, { userId, code, contextType = null, contextId = null, awardedByUserId = null, note = null }) => {
	if(!userId || !code) {
		return false;
	}

	const [achievementRows] = await db.query(
		"SELECT id FROM achievements WHERE code = ? AND is_active = 1 LIMIT 1",
		[code]
	);

	if(!achievementRows.length) {
		return false;
	}

	const [result] = await db.query(
		`INSERT IGNORE INTO user_achievements
		(user_id, achievement_id, awarded_at, awarded_by_user_id, context_type, context_id, note)
		VALUES (?, ?, ?, ?, ?, ?, ?)`,
		[
			userId,
			achievementRows[0].id,
			Math.floor(Date.now() / 1000),
			awardedByUserId || null,
			contextType,
			contextId ? String(contextId) : null,
			note,
		]
	);

	return result.affectedRows > 0;
};

const awardFirstApprovedProjectAchievement = async (db, { projectId, userId, awardedByUserId = null }) => {
	if(!projectId || !userId) {
		return false;
	}

	const [[{ approvedProjects }]] = await db.query(
		"SELECT COUNT(*) AS approvedProjects FROM projects WHERE user_id = ? AND status = 'approved'",
		[userId]
	);

	if(Number(approvedProjects || 0) !== 1) {
		return false;
	}

	return awardAchievementToUser(db, {
		userId,
		code: ACHIEVEMENT_CODES.FIRST_PROJECT,
		contextType: "project",
		contextId: projectId,
		awardedByUserId,
	});
};

const awardProjectDownloadAchievements = async (db, { projectId, userId, totalDownloads }) => {
	if(!projectId || !userId) {
		return [];
	}

	const downloads = Math.max(0, Number(totalDownloads) || 0);
	const awardedCodes = [];

	for(const threshold of DOWNLOAD_ACHIEVEMENT_THRESHOLDS) {
		if(downloads < threshold.minDownloads) {
			continue;
		}

		const awarded = await awardAchievementToUser(db, {
			userId,
			code: threshold.code,
			contextType: "project",
			contextId: projectId,
		});

		if(awarded) {
			awardedCodes.push(threshold.code);
		}
	}

	return awardedCodes;
};

module.exports = {
	ACHIEVEMENT_CODES,
	awardAchievementToUser,
	awardFirstApprovedProjectAchievement,
	awardProjectDownloadAchievements,
};