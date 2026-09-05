const crypto = require("crypto");

const { db } = require("../config/db");

const createJobId = () => crypto.randomUUID();

const enqueueJob = async ({
	connection = db,
	jobType,
	idempotencyKey,
	payload,
	maxAttempts = 10,
	availableAt = null,
}) => {
	const jobId = createJobId();
	const [result] = await connection.query(
		`INSERT IGNORE INTO async_jobs
		(id, job_type, idempotency_key, payload, max_attempts, available_at)
		VALUES (?, ?, ?, ?, ?, COALESCE(?, UTC_TIMESTAMP(3)))`,
		[
			jobId,
			jobType,
			idempotencyKey,
			JSON.stringify(payload),
			Math.max(1, Number(maxAttempts) || 10),
			availableAt,
		]
	);

	if(result.affectedRows === 1) {
		return { created: true, jobId };
	}

	const [[existingJob]] = await connection.query(
		"SELECT id, status FROM async_jobs WHERE idempotency_key = ? LIMIT 1",
		[idempotencyKey]
	);

	return {
		created: false,
		jobId: existingJob?.id || null,
		status: existingJob?.status || null,
	};
};

const claimJobs = async ({ workerId, jobTypes, limit = 100, leaseSeconds = 60 }) => {
	const normalizedTypes = [...new Set(jobTypes.map((value) => String(value || "").trim()).filter(Boolean))];
	if(!normalizedTypes.length) {
		return [];
	}

	const connection = await db.getConnection();
	const typePlaceholders = normalizedTypes.map(() => "?").join(", ");

	try {
		await connection.beginTransaction();
		const [rows] = await connection.query(
			`SELECT *
			FROM async_jobs
			WHERE job_type IN (${typePlaceholders})
			AND status IN ('pending', 'processing')
			AND available_at <= UTC_TIMESTAMP(3)
			AND (locked_until IS NULL OR locked_until < UTC_TIMESTAMP(3))
			ORDER BY created_at ASC
			LIMIT ?
			FOR UPDATE SKIP LOCKED`,
			[...normalizedTypes, Math.max(1, Number(limit) || 100)]
		);

		if(rows.length) {
			const placeholders = rows.map(() => "?").join(", ");
			await connection.query(
				`UPDATE async_jobs
				SET status = 'processing',
				locked_at = UTC_TIMESTAMP(3),
				locked_until = DATE_ADD(UTC_TIMESTAMP(3), INTERVAL ? SECOND),
				locked_by = ?
				WHERE id IN (${placeholders})`,
				[Math.max(10, Number(leaseSeconds) || 60), workerId, ...rows.map((row) => row.id)]
			);
		}

		await connection.commit();
		return rows.map((row) => ({
			...row,
			payload: typeof row.payload === "string" ? JSON.parse(row.payload) : row.payload,
			result: typeof row.result === "string" ? JSON.parse(row.result) : row.result,
		}));
	} catch(error) {
		await connection.rollback();
		throw error;
	} finally {
		connection.release();
	}
};

const completeJob = async (jobId) => {
	await db.query(
		`UPDATE async_jobs
		SET status = 'completed', completed_at = UTC_TIMESTAMP(3),
		locked_at = NULL, locked_until = NULL, locked_by = NULL, last_error = NULL
		WHERE id = ? AND status != 'completed'`,
		[jobId]
	);
};

const completeJobs = async (jobIds) => {
	const normalizedIds = [...new Set(jobIds.map((value) => String(value || "").trim()).filter(Boolean))];
	if(!normalizedIds.length) {
		return;
	}

	const placeholders = normalizedIds.map(() => "?").join(", ");
	await db.query(
		`UPDATE async_jobs
		SET status = 'completed', completed_at = UTC_TIMESTAMP(3),
		locked_at = NULL, locked_until = NULL, locked_by = NULL, last_error = NULL
		WHERE id IN (${placeholders}) AND status != 'completed'`,
		normalizedIds
	);
};

const retryOrDeadLetterJob = async (job, error) => {
	const attempts = Number(job.attempts || 0) + 1;
	const maxAttempts = Math.max(1, Number(job.max_attempts) || 10);
	const dead = attempts >= maxAttempts;
	const baseDelaySeconds = Math.min(1800, Math.max(1, 2 ** Math.min(attempts, 10)));
	const delaySeconds = Math.max(1, Math.floor(baseDelaySeconds * (0.5 + Math.random())));

	await db.query(
		`UPDATE async_jobs
		SET status = ?, attempts = ?,
		available_at = IF(? = 'dead', available_at, DATE_ADD(UTC_TIMESTAMP(3), INTERVAL ? SECOND)),
		locked_at = NULL, locked_until = NULL, locked_by = NULL, last_error = ?
		WHERE id = ? AND status != 'completed'`,
		[
			dead ? "dead" : "pending",
			attempts,
			dead ? "dead" : "pending",
			delaySeconds,
			String(error?.message || error || "Unknown worker error").slice(0, 1000),
			job.id,
		]
	);

	if(dead) {
		console.error(`[async-worker] job ${job.id} moved to DLQ after ${attempts} attempts`);
	}
};

module.exports = {
	claimJobs,
	completeJob,
	completeJobs,
	createJobId,
	enqueueJob,
	retryOrDeadLetterJob,
};