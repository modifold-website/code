const PROFILE_BADGE_CODES = {
	CREATOR: "creator_badge",
	STAFF: "staff",
	FIRST_PROJECT: "first_project",
	MOD_JAM: "hytalemodjam_2026",
};

const PROFILE_BADGE_CODE_SET = new Set(Object.values(PROFILE_BADGE_CODES));
const ACHIEVEMENT_PROFILE_BADGES = [
	PROFILE_BADGE_CODES.FIRST_PROJECT,
	PROFILE_BADGE_CODES.MOD_JAM,
];

const normalizeProfileBadgeCode = (value) => {
	if(value === null || value === undefined || value === "") {
		return null;
	}

	const code = String(value).trim();
	return PROFILE_BADGE_CODE_SET.has(code) ? code : null;
};

const isStaffRole = (role) => role === "admin" || role === "moderator" || role === "staff";

const getUnlockedProfileBadges = async (db, user) => {
	if(!user?.id) {
		return [];
	}

	const unlocked = [];

	if(Number(user.isVerified || 0) === 1) {
		unlocked.push(PROFILE_BADGE_CODES.CREATOR);
	}

	if(isStaffRole(user.isRole)) {
		unlocked.push(PROFILE_BADGE_CODES.STAFF);
	}

	const [achievementRows] = await db.query(
		`SELECT a.code
		FROM user_achievements ua
		INNER JOIN achievements a ON a.id = ua.achievement_id
		WHERE ua.user_id = ?
		AND a.code IN (?)
		AND a.is_active = 1`,
		[user.id, ACHIEVEMENT_PROFILE_BADGES]
	);

	const awardedCodes = new Set(achievementRows.map((row) => row.code));
	for(const code of ACHIEVEMENT_PROFILE_BADGES) {
		if(awardedCodes.has(code)) {
			unlocked.push(code);
		}
	}

	return unlocked;
};

const getVisibleProfileBadge = async (db, user) => {
	const activeBadge = normalizeProfileBadgeCode(user?.active_profile_badge || user?.activeProfileBadge);
	if(!activeBadge) {
		return null;
	}

	const unlockedBadges = await getUnlockedProfileBadges(db, user);
	return unlockedBadges.includes(activeBadge) ? activeBadge : null;
};

module.exports = {
	PROFILE_BADGE_CODES,
	getUnlockedProfileBadges,
	getVisibleProfileBadge,
	normalizeProfileBadgeCode,
};