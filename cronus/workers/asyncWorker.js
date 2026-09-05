require("dotenv").config();

const crypto = require("crypto");
const os = require("os");

const { db } = require("../config/db");
const { clickhouse, hasClickHouseConfig } = require("../config/clickhouse");
const { claimJobs, completeJob, completeJobs, retryOrDeadLetterJob } = require("../utils/asyncJobs");
const { awardProjectDownloadAchievements } = require("../utils/achievements");
const { bumpProjectCacheVersion } = require("../utils/projectCache");

// WIP
const WORKER_ID = `${os.hostname()}:${process.pid}`;
const BATCH_SIZE = 250;
const FANOUT_BATCH_SIZE = 1000;
const FANOUT_JOB_BATCH_SIZE = 10;
const LEASE_SECONDS = 120;
const IDLE_DELAY_MS = 500;
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
const CLEANUP_BATCH_SIZE = 1000;
const COMPLETED_JOB_RETENTION_DAYS = 7;
const FANOUT_JOB_TYPES = ["notification.project_release", "notification.version_release"];

let stopping = false;
let lastCleanupAt = 0;

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const placeholders = (values) => values.map(() => "?").join(", ");

const groupBy = (values, getKey) => {
	const groups = new Map();
	for(const value of values) {
		const key = getKey(value);
		const group = groups.get(key) || [];
		group.push(value);
		groups.set(key, group);
	}

	return groups;
};

const applyDownloadCounters = async (jobs) => {
	const pendingJobs = jobs.filter((job) => !job.counters_applied_at);
	if(!pendingJobs.length) {
		return;
	}

	const connection = await db.getConnection();
	try {
		await connection.beginTransaction();
		const jobIds = pendingJobs.map((job) => job.id);
		const [lockedRows] = await connection.query(
			`SELECT id, payload
			FROM async_jobs
			WHERE id IN (${placeholders(jobIds)}) AND counters_applied_at IS NULL
			FOR UPDATE`,
			jobIds
		);
		const lockedJobs = lockedRows.map((row) => ({
			id: row.id,
			payload: typeof row.payload === "string" ? JSON.parse(row.payload) : row.payload,
		}));
		const projectGroups = groupBy(lockedJobs, (job) => String(job.payload.projectId));
		const versionGroups = groupBy(lockedJobs, (job) => String(job.payload.versionId));
		const projectIds = [...projectGroups.keys()];

		if(projectIds.length) {
			const [projectRows] = await connection.query(
				`SELECT id, downloads FROM projects WHERE id IN (${placeholders(projectIds)}) FOR UPDATE`,
				projectIds
			);
			const previousTotals = new Map(projectRows.map((row) => [String(row.id), Number(row.downloads || 0)]));

			for(const [versionId, versionJobs] of versionGroups) {
				await connection.query(
					"UPDATE project_versions SET downloads = downloads + ? WHERE id = ?",
					[versionJobs.length, versionId]
				);
			}

			for(const [projectId, projectJobs] of projectGroups) {
				const previousDownloads = previousTotals.get(projectId) || 0;
				const totalDownloads = previousDownloads + projectJobs.length;
				await connection.query("UPDATE projects SET downloads = downloads + ? WHERE id = ?", [projectJobs.length, projectId]);
				await connection.query(
					`UPDATE async_jobs
					SET counters_applied_at = UTC_TIMESTAMP(3), result = JSON_OBJECT('previousDownloads', ?, 'totalDownloads', ?)
					WHERE id IN (${placeholders(projectJobs)}) AND counters_applied_at IS NULL`,
					[previousDownloads, totalDownloads, ...projectJobs.map((job) => job.id)]
				);
			}
		}

		await connection.commit();
	} catch(error) {
		await connection.rollback();
		throw error;
	} finally {
		connection.release();
	}
};

const applyDownloadAnalytics = async (jobs) => {
	const jobIds = jobs.map((job) => job.id);
	const [rows] = await db.query(
		`SELECT id, payload
		FROM async_jobs
		WHERE id IN (${placeholders(jobIds)})
		AND counters_applied_at IS NOT NULL AND analytics_applied_at IS NULL`,
		jobIds
	);
	if(!rows.length) {
		return;
	}

	if(!hasClickHouseConfig || !clickhouse) {
		throw new Error("ClickHouse is required for durable download analytics");
	}

	await clickhouse.insert({
		table: "project_events",
		values: rows.map((row) => {
			const payload = typeof row.payload === "string" ? JSON.parse(row.payload) : row.payload;
			return {
				event_id: row.id,
				project_slug: payload.projectSlug,
				version_id: String(payload.versionId),
				event_type: "download",
				ip_address: payload.ipAddress,
				country_code: payload.countryCode,
			};
		}),
		format: "JSONEachRow",
	});

	await db.query(
		`UPDATE async_jobs SET analytics_applied_at = UTC_TIMESTAMP(3) WHERE id IN (${placeholders(rows)})`,
		rows.map((row) => row.id)
	);
};

const applyDownloadSideEffects = async (jobs) => {
	const jobIds = jobs.map((job) => job.id);
	const [rows] = await db.query(
		`SELECT id, payload, result
		FROM async_jobs
		WHERE id IN (${placeholders(jobIds)})
		AND counters_applied_at IS NOT NULL AND side_effects_applied_at IS NULL`,
		jobIds
	);
	if(!rows.length) {
		return;
	}

	const parsedRows = rows.map((row) => ({
		...row,
		payload: typeof row.payload === "string" ? JSON.parse(row.payload) : row.payload,
		result: typeof row.result === "string" ? JSON.parse(row.result) : row.result,
	}));
	const projectGroups = groupBy(parsedRows, (row) => String(row.payload.projectId));

	for(const projectRows of projectGroups.values()) {
		const sample = projectRows[0];
		await bumpProjectCacheVersion(sample.payload.projectSlug);
		await awardProjectDownloadAchievements(db, {
			projectId: sample.payload.projectId,
			userId: sample.payload.projectUserId,
			previousTotalDownloads: sample.result?.previousDownloads,
			totalDownloads: sample.result?.totalDownloads,
		});
	}

	await db.query(
		`UPDATE async_jobs SET side_effects_applied_at = UTC_TIMESTAMP(3) WHERE id IN (${placeholders(rows)})`,
		rows.map((row) => row.id)
	);
};

const processDownloadJobs = async (jobs) => {
	await applyDownloadCounters(jobs);
	await applyDownloadAnalytics(jobs);
	await applyDownloadSideEffects(jobs);

	const jobIds = jobs.map((job) => job.id);
	const [completedRows] = await db.query(
		`SELECT id FROM async_jobs
		WHERE id IN (${placeholders(jobIds)})
		AND counters_applied_at IS NOT NULL
		AND analytics_applied_at IS NOT NULL
		AND side_effects_applied_at IS NOT NULL`,
		jobIds
	);
	await completeJobs(completedRows.map((row) => row.id));
};

const getNotificationDeliveryKey = ({ jobId, recipientUserId, eventType, objectId }) => crypto
	.createHash("sha256")
	.update(`${jobId}:${recipientUserId}:${eventType}:${objectId}`)
	.digest("hex");

const processFanoutJob = async (job) => {
	const payload = job.payload;
	const cursor = String(job.cursor_value || "");
	let recipients;
	let nextCursor;
	let eventType;
	let objectType;
	let objectId;

	if(job.job_type === "notification.version_release") {
		const [rows] = await db.query(
			`SELECT user_id AS recipient_user_id
			FROM project_likes
			WHERE project_id = ? AND user_id <> ? AND user_id > ?
			ORDER BY user_id ASC LIMIT ?`,
			[payload.projectId, payload.actorUserId, cursor || "0", FANOUT_BATCH_SIZE]
		);
		recipients = rows;
		nextCursor = rows.length ? String(rows[rows.length - 1].recipient_user_id) : cursor;
		eventType = "project_version_release";
		objectType = "project_version";
		objectId = String(payload.versionId);
	} else {
		const [rows] = await db.query(
			`SELECT id, author_id AS recipient_user_id
			FROM subs
			WHERE userid = ? AND author_id <> ? AND id > ?
			ORDER BY id ASC LIMIT ?`,
			[payload.projectOwnerUserId, payload.actorUserId, cursor || "0", FANOUT_BATCH_SIZE]
		);
		recipients = rows;
		nextCursor = rows.length ? String(rows[rows.length - 1].id) : cursor;
		eventType = "project_release";
		objectType = "project";
		objectId = String(payload.projectId);
	}

	if(!recipients.length) {
		await completeJob(job.id);
		return;
	}

	const connection = await db.getConnection();
	try {
		await connection.beginTransaction();
		const values = recipients.map((recipient) => [
			String(recipient.recipient_user_id),
			String(payload.actorUserId),
			eventType,
			objectType,
			objectId,
			getNotificationDeliveryKey({
				jobId: job.id,
				recipientUserId: recipient.recipient_user_id,
				eventType,
				objectId,
			}),
			Number(payload.createdAt),
		]);
		await connection.query(
			`INSERT INTO notification_events
			(recipient_user_id, actor_user_id, event_type, object_type, object_id, delivery_key, created_at)
			VALUES ?
			ON DUPLICATE KEY UPDATE
			read_at = IF(created_at < VALUES(created_at), NULL, read_at),
			created_at = GREATEST(created_at, VALUES(created_at))`,
			[values]
		);
		await connection.query(
			"UPDATE async_jobs SET status = 'pending', attempts = 0, cursor_value = ?, locked_at = NULL, locked_until = NULL, locked_by = NULL, last_error = NULL WHERE id = ?",
			[nextCursor, job.id]
		);
		await connection.commit();
	} catch(error) {
		await connection.rollback();
		throw error;
	} finally {
		connection.release();
	}
};

const cleanupNotifications = async () => {
	const connection = await db.getConnection();
	const cleanupQueries = [
		`DELETE FROM notification_events
		WHERE id IN (
			SELECT id FROM (
				SELECT ne.id
				FROM notification_events ne
				LEFT JOIN project_versions pv ON BINARY pv.id = BINARY ne.object_id
				WHERE ne.event_type IN ('project_version_release', 'project_version_approved', 'project_version_rejected')
				AND ne.object_type = 'project_version' AND pv.id IS NULL
				ORDER BY ne.id ASC LIMIT ?
			) stale_versions
		)`,
		`DELETE FROM notification_events
		WHERE id IN (
			SELECT id FROM (
				SELECT ne.id
				FROM notification_events ne
				LEFT JOIN project_members pm
				ON BINARY pm.project_id = BINARY ne.object_id
				AND BINARY pm.user_id = BINARY ne.recipient_user_id
				AND pm.status = 'pending'
				WHERE ne.event_type = 'project_collaboration_invite'
				AND ne.object_type = 'project' AND pm.id IS NULL
				ORDER BY ne.id ASC LIMIT ?
			) stale_invites
		)`,
	];

	try {
		const [[lockRow]] = await connection.query("SELECT GET_LOCK('modifold:async-worker:cleanup', 0) AS acquired");
		if(Number(lockRow?.acquired || 0) !== 1) {
			return;
		}

		for(const query of cleanupQueries) {
			await connection.query(query, [CLEANUP_BATCH_SIZE]);
		}

		await connection.query(
			"DELETE FROM download_dedupe WHERE expires_at < UTC_TIMESTAMP(3) ORDER BY expires_at ASC LIMIT ?",
			[CLEANUP_BATCH_SIZE]
		);
		await connection.query(
			`DELETE FROM async_jobs
			WHERE status = 'completed'
			AND completed_at < DATE_SUB(UTC_TIMESTAMP(3), INTERVAL ? DAY)
			ORDER BY completed_at ASC LIMIT ?`,
			[COMPLETED_JOB_RETENTION_DAYS, CLEANUP_BATCH_SIZE]
		);
	} finally {
		await connection.query("SELECT RELEASE_LOCK('modifold:async-worker:cleanup')").catch(() => undefined);
		connection.release();
	}
};

const run = async () => {
	await db.query("SELECT id FROM async_jobs LIMIT 1");
	console.log(`[async-worker] ${WORKER_ID} started`);
	while(!stopping) {
		if(Date.now() - lastCleanupAt >= CLEANUP_INTERVAL_MS) {
			lastCleanupAt = Date.now();
			try {
				await cleanupNotifications();
			} catch(error) {
				console.error("[async-worker] notification cleanup failed:", error.message);
			}
		}

		let downloadJobs;
		let fanoutJobs;
		try {
			[downloadJobs, fanoutJobs] = await Promise.all([
				claimJobs({ workerId: WORKER_ID, jobTypes: ["download.account"], limit: BATCH_SIZE, leaseSeconds: LEASE_SECONDS }),
				claimJobs({ workerId: WORKER_ID, jobTypes: FANOUT_JOB_TYPES, limit: FANOUT_JOB_BATCH_SIZE, leaseSeconds: LEASE_SECONDS }),
			]);
		} catch(error) {
			console.error("[async-worker] claim failed:", error.message);
			await delay(IDLE_DELAY_MS);
			continue;
		}

		if(!downloadJobs.length && !fanoutJobs.length) {
			await delay(IDLE_DELAY_MS);
			continue;
		}

		if(downloadJobs.length) {
			try {
				await processDownloadJobs(downloadJobs);
			} catch(error) {
				console.error("[async-worker] download batch failed:", error.message);
				for(const job of downloadJobs) {
					await retryOrDeadLetterJob(job, error);
				}
			}
		}

		for(const job of fanoutJobs) {
			try {
				await processFanoutJob(job);
			} catch(error) {
				console.error(`[async-worker] ${job.job_type} failed:`, error.message);
				await retryOrDeadLetterJob(job, error);
			}
		}
	}
};

const requestShutdown = (signal) => {
	console.log(`[async-worker] received ${signal}, stopping`);
	stopping = true;
};

process.once("SIGTERM", () => requestShutdown("SIGTERM"));
process.once("SIGINT", () => requestShutdown("SIGINT"));

run().then(async () => {
	await db.end();
}).catch(async (error) => {
	console.error("[async-worker] fatal error:", error);
	await db.end();
	process.exit(1);
});