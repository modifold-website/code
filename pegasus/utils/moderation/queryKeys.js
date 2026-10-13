export const userModerationQueryKeys = {
	root: (actorId) => ["user-moderation", actorId || "current"],
	list: (actorId, page, search) => [...userModerationQueryKeys.root(actorId), "list", { page, search }],
	achievements: (actorId, userId) => [...userModerationQueryKeys.root(actorId), "achievements", userId],
};