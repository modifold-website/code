const { db } = require("../config/db");
const { ACHIEVEMENT_CODES } = require("../utils/achievements");

const isApply = process.argv.includes("--apply");
const note = "Backfilled by scripts/backfillProjectAchievements.js";

const projectAchievementBackfills = [
	{
		code: ACHIEVEMENT_CODES.FIRST_PROJECT,
		label: "first approved project",
		candidateSql: `
			SELECT p.user_id, MIN(p.id) AS project_id
			FROM projects p
			WHERE p.status = 'approved'
			GROUP BY p.user_id
		`,
		params: [],
	},
	{
		code: ACHIEVEMENT_CODES.DOWNLOADS_100,
		label: "100 downloads",
		candidateSql: `
			SELECT p.user_id, MIN(p.id) AS project_id
			FROM projects p
			INNER JOIN (
				SELECT user_id, MAX(downloads) AS max_downloads
				FROM projects
				WHERE status = 'approved' AND downloads >= ?
				GROUP BY user_id
			) best
			ON best.user_id = p.user_id
			AND best.max_downloads = p.downloads
			WHERE p.status = 'approved' AND p.downloads >= ?
			GROUP BY p.user_id
		`,
		params: [100, 100],
	},
	{
		code: ACHIEVEMENT_CODES.DOWNLOADS_500,
		label: "500 downloads",
		candidateSql: `
			SELECT p.user_id, MIN(p.id) AS project_id
			FROM projects p
			INNER JOIN (
				SELECT user_id, MAX(downloads) AS max_downloads
				FROM projects
				WHERE status = 'approved' AND downloads >= ?
				GROUP BY user_id
			) best
			ON best.user_id = p.user_id
			AND best.max_downloads = p.downloads
			WHERE p.status = 'approved' AND p.downloads >= ?
			GROUP BY p.user_id
		`,
		params: [500, 500],
	},
];

const getCandidateCount = async ({ candidateSql, params }) => {
	const [[row]] = await db.query(
		`SELECT COUNT(*) AS total FROM (${candidateSql}) candidates`,
		params
	);

	return Number(row.total || 0);
};

const getMissingCount = async ({ code, candidateSql, params }) => {
	const [[row]] = await db.query(
		`SELECT COUNT(*) AS total
		FROM (${candidateSql}) candidates
		INNER JOIN achievements a
		ON a.code = ?
		AND a.is_active = 1
		LEFT JOIN user_achievements ua
		ON ua.user_id = candidates.user_id
		AND ua.achievement_id = a.id
		WHERE ua.id IS NULL`,
		[...params, code]
	);

	return Number(row.total || 0);
};

const awardMissingAchievements = async (connection, { code, candidateSql, params }) => {
	const [result] = await connection.query(
		`INSERT IGNORE INTO user_achievements
		(user_id, achievement_id, awarded_at, awarded_by_user_id, context_type, context_id, note)
		SELECT candidates.user_id, a.id, UNIX_TIMESTAMP(), NULL, 'project', CAST(candidates.project_id AS CHAR), ?
		FROM (${candidateSql}) candidates
		INNER JOIN achievements a
		ON a.code = ?
		AND a.is_active = 1
		LEFT JOIN user_achievements ua
		ON ua.user_id = candidates.user_id
		AND ua.achievement_id = a.id
		WHERE ua.id IS NULL`,
		[note, ...params, code]
	);

	return Number(result.affectedRows || 0);
};

const validateAchievements = async () => {
	const requiredCodes = projectAchievementBackfills.map(({ code }) => code);
	const [rows] = await db.query(
		"SELECT code FROM achievements WHERE code IN (?) AND is_active = 1",
		[requiredCodes]
	);
	const existingCodes = new Set(rows.map((row) => row.code));
	const missingCodes = requiredCodes.filter((code) => !existingCodes.has(code));

	if(missingCodes.length > 0) {
		throw new Error(`Missing active achievements: ${missingCodes.join(", ")}`);
	}
};

const run = async () => {
	await validateAchievements();

	const summaries = [];

	for(const backfill of projectAchievementBackfills) {
		const eligible = await getCandidateCount(backfill);
		const missing = await getMissingCount(backfill);

		summaries.push({
			...backfill,
			eligible,
			missing,
			awarded: 0,
		});
	}

	if(!isApply) {
		console.log("Dry run only. Re-run with --apply to write changes.");
		for(const summary of summaries) {
			console.log(`${summary.code}: ${summary.missing} missing of ${summary.eligible} eligible (${summary.label})`);
		}

		return;
	}

	const connection = await db.getConnection();

	try {
		await connection.beginTransaction();

		for(const summary of summaries) {
			summary.awarded = await awardMissingAchievements(connection, summary);
		}

		await connection.commit();
	} catch (error) {
		await connection.rollback();
		throw error;
	} finally {
		connection.release();
	}

	for(const summary of summaries) {
		console.log(`${summary.code}: awarded ${summary.awarded} of ${summary.missing} missing (${summary.label})`);
	}
};

run().catch((error) => {
	console.error(error);
	process.exitCode = 1;
}).finally(async () => {
	await db.end();
});