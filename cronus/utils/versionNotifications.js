const { db } = require("../config/db");
const { enqueueJob } = require("./asyncJobs");

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

const fanoutVersionReleaseNotifications = async ({ connection = db, actorUserId, projectId, versionId, createdAt }) => {
	if(!actorUserId || !projectId || !versionId) {
		return { sent: 0 };
	}

	const queued = await enqueueJob({
		connection,
		jobType: "notification.version_release",
		idempotencyKey: `notification:version-release:${versionId}:${createdAt}`,
		payload: {
			actorUserId: String(actorUserId),
			projectId: String(projectId),
			versionId: String(versionId),
			createdAt: Number(createdAt),
		},
	});

	return { sent: 0, queued: queued.created, jobId: queued.jobId };
};

const fanoutProjectReleaseNotifications = async ({ connection = db, projectOwnerUserId, actorUserId, projectId, createdAt }) => {
	if(!projectOwnerUserId || !actorUserId || !projectId) {
		return { sent: 0 };
	}

	const queued = await enqueueJob({
		connection,
		jobType: "notification.project_release",
		idempotencyKey: `notification:project-release:${projectId}:${createdAt}`,
		payload: {
			projectOwnerUserId: String(projectOwnerUserId),
			actorUserId: String(actorUserId),
			projectId: String(projectId),
			createdAt: Number(createdAt),
		},
	});

	return { sent: 0, queued: queued.created, jobId: queued.jobId };
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