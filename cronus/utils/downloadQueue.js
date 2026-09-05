const crypto = require("crypto");

const { db } = require("../config/db");
const { enqueueJob } = require("./asyncJobs");

const DOWNLOAD_DEDUPE_TTL_SECONDS = Math.max(1, Number(process.env.DOWNLOAD_DEDUPE_TTL_SECONDS) || 6 * 60 * 60);
const DOWNLOAD_DEDUPE_LIMIT = Math.max(1, Number(process.env.DOWNLOAD_DEDUPE_LIMIT) || 1);

const getIdentityHash = ({ ipPrefix, projectId }) => {
	const secret = process.env.JWT_SECRET;
	if(!secret) {
		throw new Error("JWT_SECRET is required for download deduplication");
	}
	return crypto.createHmac("sha256", secret).update(`${ipPrefix}:${projectId}`).digest("hex");
};

const reserveDownload = async (connection, { projectId, identityHash }) => {
	const [insertResult] = await connection.query(
		`INSERT IGNORE INTO download_dedupe
		(project_id, identity_hash, request_count, expires_at)
		VALUES (?, ?, 1, DATE_ADD(UTC_TIMESTAMP(3), INTERVAL ? SECOND))`,
		[projectId, identityHash, DOWNLOAD_DEDUPE_TTL_SECONDS]
	);

	if(insertResult.affectedRows === 1) {
		return { allowed: true, count: 1 };
	}

	const [[row]] = await connection.query(
		`SELECT request_count, expires_at <= UTC_TIMESTAMP(3) AS expired
		FROM download_dedupe
		WHERE project_id = ? AND identity_hash = ?
		FOR UPDATE`,
		[projectId, identityHash]
	);

	if(Number(row?.expired) === 1) {
		await connection.query(
			`UPDATE download_dedupe
			SET request_count = 1, expires_at = DATE_ADD(UTC_TIMESTAMP(3), INTERVAL ? SECOND)
			WHERE project_id = ? AND identity_hash = ?`,
			[DOWNLOAD_DEDUPE_TTL_SECONDS, projectId, identityHash]
		);
		return { allowed: true, count: 1 };
	}

	const currentCount = Number(row?.request_count || 0);
	if(currentCount >= DOWNLOAD_DEDUPE_LIMIT) {
		return { allowed: false, count: currentCount };
	}

	await connection.query(
		"UPDATE download_dedupe SET request_count = request_count + 1 WHERE project_id = ? AND identity_hash = ?",
		[projectId, identityHash]
	);

	return { allowed: true, count: currentCount + 1 };
};

const enqueueDownload = async ({ version, ipAddress, ipPrefix, countryCode }) => {
	const connection = await db.getConnection();
	const eventId = crypto.randomUUID();
	const projectId = String(version.project_id);
	const identityHash = getIdentityHash({ ipPrefix, projectId });

	try {
		await connection.beginTransaction();
		const dedupe = await reserveDownload(connection, { projectId, identityHash });

		if(!dedupe.allowed) {
			await connection.commit();
			return {
				accepted: false,
				reason: "deduped",
				count: dedupe.count,
			};
		}

		await enqueueJob({
			connection,
			jobType: "download.account",
			idempotencyKey: `download:${eventId}`,
			payload: {
				eventId,
				projectId,
				projectSlug: String(version.project_slug),
				projectUserId: version.project_user_id ? String(version.project_user_id) : null,
				versionId: String(version.id),
				ipAddress: String(ipAddress),
				countryCode: countryCode || null,
				occurredAt: new Date().toISOString(),
			},
		});

		await connection.commit();
		return {
			accepted: true,
			reason: "queued",
			count: dedupe.count,
		};
	} catch(error) {
		await connection.rollback();
		throw error;
	} finally {
		connection.release();
	}
};

module.exports = {
	DOWNLOAD_DEDUPE_LIMIT,
	DOWNLOAD_DEDUPE_TTL_SECONDS,
	enqueueDownload,
	_test: {
		getIdentityHash,
		reserveDownload,
	},
};