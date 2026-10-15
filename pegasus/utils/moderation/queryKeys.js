export const userModerationQueryKeys = {
	root: (actorId) => ["user-moderation", actorId || "current"],
	list: (actorId, page, search) => [...userModerationQueryKeys.root(actorId), "list", { page, search }],
	achievements: (actorId, userId) => [...userModerationQueryKeys.root(actorId), "achievements", userId],
};

export const moderationStatisticsQueryKeys = {
	analytics: (actorId, timeRange) => ["moderation-statistics", actorId || "current", timeRange],
};

export const projectAnalyticsQueryKeys = {
	report: (actorId, project, from, to) => ["moderation-project-analytics", actorId, project, { from, to }],
};