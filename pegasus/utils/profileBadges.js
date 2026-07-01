export const PROFILE_BADGES = [
	{
		code: "creator_badge",
		icon: "/badges/creator.webp",
	},
	{
		code: "staff",
		icon: "/badges/staff_badge.png",
	},
	{
		code: "hytalemodjam_2026",
		icon: "/badges/hytalemodjam_2026_badge.png",
	},
	{
		code: "first_project",
		icon: "/badges/first_project_badge.png",
	},
];

export const PROFILE_BADGE_BY_CODE = PROFILE_BADGES.reduce((acc, badge) => {
	acc[badge.code] = badge;
	return acc;
}, {});

export const getProfileBadgeCode = (user) => {
	const code = user?.activeProfileBadge ?? user?.active_profile_badge ?? null;
	return PROFILE_BADGE_BY_CODE[code] ? code : null;
};

export const getProfileBadge = (userOrCode) => {
	const code = typeof userOrCode === "string" ? userOrCode : getProfileBadgeCode(userOrCode);
	return PROFILE_BADGE_BY_CODE[code] || null;
};