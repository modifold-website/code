const ACHIEVEMENT_CODES = {
	FIRST_PROJECT: "first_project",
	DOWNLOADS_100: "downloads_100",
	DOWNLOADS_500: "downloads_500",
	DOWNLOADS_10000: "downloads_10000",
};

const DOWNLOAD_ACHIEVEMENT_THRESHOLDS = [
	{ minDownloads: 100, code: ACHIEVEMENT_CODES.DOWNLOADS_100 },
	{ minDownloads: 500, code: ACHIEVEMENT_CODES.DOWNLOADS_500 },
	{ minDownloads: 10000, code: ACHIEVEMENT_CODES.DOWNLOADS_10000 },
];

const getAchievementLockName = (userId, code) => {
	return `achievement:${String(userId).slice(0, 32)}:${code}`;
};

const withAchievementLock = async (db, userId, code, callback) => {
	if(typeof db.getConnection !== "function") {
		return callback(db);
	}

	const connection = await db.getConnection();

	try {
		const [[lockRow]] = await connection.query(
			"SELECT GET_LOCK(?, 5) AS lockAcquired",
			[getAchievementLockName(userId, code)]
		);

		if(Number(lockRow?.lockAcquired || 0) !== 1) {
			return false;
		}

		try {
			return await callback(connection);
		} finally {
			await connection.query("SELECT RELEASE_LOCK(?)", [getAchievementLockName(userId, code)]);
		}
	} finally {
		connection.release();
	}
};

const awardAchievementToUser = async (db, { userId, code, contextType = null, contextId = null, awardedByUserId = null, note = null }) => {
	if(!userId || !code) {
		return false;
	}

	return withAchievementLock(db, userId, code, async (connection) => {
		const [result] = await connection.query(
			`INSERT IGNORE INTO user_achievements
			(user_id, achievement_id, awarded_at, awarded_by_user_id, context_type, context_id, note)
			SELECT ?, a.id, ?, ?, ?, ?, ?
			FROM achievements a
			LEFT JOIN user_achievements ua
			ON ua.user_id = ?
			AND ua.achievement_id = a.id
			WHERE a.code = ?
			AND a.is_active = 1
			AND ua.id IS NULL
			LIMIT 1`,
			[
				userId,
				Math.floor(Date.now() / 1000),
				awardedByUserId || null,
				contextType,
				contextId ? String(contextId) : null,
				note,
				userId,
				code,
			]
		);

		return result.affectedRows > 0;
	});
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