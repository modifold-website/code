export const notificationQueryKeys = {
    all: ["notifications"],
    listRoot: ["notifications", "list"],
    list: ({ userKey, tzOffset }) => ["notifications", "list", userKey || "current", { tzOffset }],
    unreadCountRoot: ["notifications", "unread-count"],
    unreadCount: (userKey) => ["notifications", "unread-count", userKey || "current"],
};