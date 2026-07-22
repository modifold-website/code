const { db } = require("../config/db");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const insertNotificationRows = async (rows) => {
	if(!rows.length) {
		return 0;
	}

	await db.query(
		`INSERT INTO notification_events
		(recipient_user_id, actor_user_id, event_type, object_type, object_id, created_at)
		VALUES ?
		ON DUPLICATE KEY UPDATE
		created_at = VALUES(created_at),
		read_at = NULL`,
		[rows]
	);

	return rows.length;
};

const fanoutVersionReleaseNotifications = async ({ actorUserId, projectId, versionId, createdAt }) => {
	if(!actorUserId || !projectId || !versionId) {
		return { sent: 0 };
	}

	const batchSize = Math.max(1, 100);
	const batchDelayMs = Math.max(0, 50);
	let offset = 0;
	let sent = 0;

	while(true) {
		const [projectLikes] = await db.query(
			`SELECT user_id AS recipient_user_id
			FROM project_likes
			WHERE project_id = ?
			AND user_id <> ?
			ORDER BY id ASC
			LIMIT ? OFFSET ?`,
			[projectId, actorUserId, batchSize, offset]
		);

		if(!projectLikes.length) {
			break;
		}

		const rows = projectLikes.map((projectLike) => Number(projectLike.recipient_user_id)).filter((recipientUserId) => Number.isFinite(recipientUserId) && recipientUserId > 0).map((recipientUserId) => [
			recipientUserId,
			actorUserId,
			"project_version_release",
			"project_version",
			String(versionId),
			createdAt,
		]);

		sent += await insertNotificationRows(rows);

		offset += projectLikes.length;

		if(batchDelayMs > 0) {
			await sleep(batchDelayMs);
		}
	}

	return { sent };
};

const fanoutProjectReleaseNotifications = async ({ projectOwnerUserId, actorUserId, projectId, createdAt }) => {
	if(!projectOwnerUserId || !actorUserId || !projectId) {
		return { sent: 0 };
	}

	const batchSize = Math.max(1, 100);
	const batchDelayMs = Math.max(0, 50);
	let offset = 0;
	let sent = 0;

	while(true) {
		const [subscribers] = await db.query(
			`SELECT author_id AS recipient_user_id
			FROM subs
			WHERE userid = ?
			AND author_id <> ?
			ORDER BY id ASC
			LIMIT ? OFFSET ?`,
			[projectOwnerUserId, actorUserId, batchSize, offset]
		);

		if(!subscribers.length) {
			break;
		}

		const rows = subscribers.map((subscriber) => Number(subscriber.recipient_user_id)).filter((recipientUserId) => Number.isFinite(recipientUserId) && recipientUserId > 0).map((recipientUserId) => [
			recipientUserId,
			actorUserId,
			"project_release",
			"project",
			String(projectId),
			createdAt,
		]);

		sent += await insertNotificationRows(rows);
		offset += subscribers.length;

		if(batchDelayMs > 0) {
			await sleep(batchDelayMs);
		}
	}

	return { sent };
};

const sendProjectModerationOwnerNotification = async ({ projectOwnerUserId, actorUserId, projectId, approved, createdAt }) => {
	if(!projectOwnerUserId || !actorUserId || !projectId) {
		return { sent: 0 };
	}

	const eventType = approved ? "project_approved" : "project_rejected";
	const sent = await insertNotificationRows([[
		projectOwnerUserId,
		actorUserId,
		eventType,
		"project",
		String(projectId),
		createdAt,
	]]);

	return { sent };
};

const sendVersionModerationOwnerNotification = async ({ projectOwnerUserId, actorUserId, versionId, approved, createdAt }) => {
	if(!projectOwnerUserId || !actorUserId || !versionId) {
		return { sent: 0 };
	}

	const eventType = approved ? "project_version_approved" : "project_version_rejected";
	const sent = await insertNotificationRows([[
		projectOwnerUserId,
		actorUserId,
		eventType,
		"project_version",
		String(versionId),
		createdAt,
	]]);

	return { sent };
};

module.exports = {
	fanoutVersionReleaseNotifications,
	fanoutProjectReleaseNotifications,
	sendProjectModerationOwnerNotification,
	sendVersionModerationOwnerNotification,
};