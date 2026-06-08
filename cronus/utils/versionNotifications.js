const { db } = require("../config/db");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const fanoutVersionReleaseNotifications = async ({ projectOwnerUserId, actorUserId, projectId, versionId, createdAt }) => {
	if(!projectOwnerUserId || !actorUserId || !projectId || !versionId) {
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
			"project_version_release",
			"project_version",
			String(versionId),
			createdAt,
		]);

		if(rows.length) {
			await db.query(
				`INSERT INTO notification_events
				(recipient_user_id, actor_user_id, event_type, object_type, object_id, created_at)
				VALUES ?
				ON DUPLICATE KEY UPDATE
				created_at = VALUES(created_at),
				read_at = NULL`,
				[rows]
			);
			sent += rows.length;
		}

		offset += subscribers.length;

		if(batchDelayMs > 0) {
			await sleep(batchDelayMs);
		}
	}

	return { sent };
};

const sendVersionApprovedOwnerNotification = async ({ projectOwnerUserId, actorUserId, versionId, createdAt }) => {
	if(!projectOwnerUserId || !actorUserId || !versionId) {
		return { sent: 0 };
	}

	await db.query(
		`INSERT INTO notification_events
		(recipient_user_id, actor_user_id, event_type, object_type, object_id, created_at)
		VALUES (?, ?, 'project_version_approved', 'project_version', ?, ?)
		ON DUPLICATE KEY UPDATE
		created_at = VALUES(created_at),
		read_at = NULL`,
		[projectOwnerUserId, actorUserId, String(versionId), createdAt]
	);

	return { sent: 1 };
};

module.exports = {
	fanoutVersionReleaseNotifications,
	sendVersionApprovedOwnerNotification,
};