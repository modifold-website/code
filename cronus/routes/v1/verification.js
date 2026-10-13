const { logger } = require("../../packages/shared/logger");

const express = require("express");
const { db } = require("../../config/db");
const auth = require("../../middleware/auth");
const { ACHIEVEMENT_CODES, awardAchievementToUser } = require("../../utils/achievements");

const router = express.Router();

const VERIFICATION_MIN_DOWNLOADS = 500;
const VERIFICATION_MIN_PROJECTS = 3;

const getVerificationEligibility = async (userId, connection = db) => {
	const [rows] = await connection.query(
		"SELECT downloads FROM projects WHERE user_id = ? AND status = 'approved'",
		[userId]
	);

	const publishedProjects = rows.length;
	const totalDownloads = rows.reduce((sum, row) => sum + Math.max(0, Number(row.downloads) || 0), 0);
	const hasMinProjects = publishedProjects >= VERIFICATION_MIN_PROJECTS;
	const hasMinDownloads = totalDownloads >= VERIFICATION_MIN_DOWNLOADS;
	const eligible = hasMinProjects && hasMinDownloads;

	return {
		publishedProjects,
		totalDownloads,
		requirements: {
			minProjects: VERIFICATION_MIN_PROJECTS,
			minDownloads: VERIFICATION_MIN_DOWNLOADS,
		},
		checks: {
			projects: hasMinProjects,
			downloads: hasMinDownloads,
		},
		eligible,
	};
};

router.get("/me", auth, async (req, res) => {
	try {
		const [users] = await db.query("SELECT id, isVerified FROM users WHERE id = ?", [req.user.id]);
		if(!users.length) {
			return res.status(404).json({ message: "User not found" });
		}

		const eligibility = await getVerificationEligibility(req.user.id);

		res.json({
			isVerified: Number(users[0].isVerified) === 1 ? 1 : 0,
			request: null,
			eligibility,
		});
	} catch (error) {
		logger.error("Error fetching verification status:", error);
		res.status(500).json({ message: "Error fetching verification status", error: error.message });
	}
});

router.post("/request", auth, async (req, res) => {
	let connection;
	try {
		connection = await db.getConnection();
		await connection.beginTransaction();
		const [users] = await connection.query("SELECT id, isVerified FROM users WHERE id = ? FOR UPDATE", [req.user.id]);
		if(!users.length) {
			await connection.rollback();
			return res.status(404).json({ message: "User not found" });
		}

		if(Number(users[0].isVerified) === 1) {
			await connection.rollback();
			return res.status(400).json({ message: "User already verified" });
		}

		const eligibility = await getVerificationEligibility(req.user.id, connection);
		if(!eligibility.eligible) {
			await connection.rollback();
			return res.status(400).json({ message: "Requirements not met", eligibility });
		}

		await awardAchievementToUser(connection, { userId: req.user.id, code: ACHIEVEMENT_CODES.CREATOR });
		const [awards] = await connection.query(
			`SELECT ua.id FROM user_achievements ua
			INNER JOIN achievements a ON a.id = ua.achievement_id
			WHERE ua.user_id = ? AND a.code = ? AND a.is_active = 1`,
			[req.user.id, ACHIEVEMENT_CODES.CREATOR]
		);
		if(!awards.length) {
			throw new Error("Creator achievement is missing; apply migration 008_creator_badge_achievement.sql");
		}

		await connection.query("UPDATE users SET isVerified = 1 WHERE id = ?", [req.user.id]);
		await connection.commit();
		return res.json({ success: true });
	} catch (error) {
		if(connection) {
			await connection.rollback();
		}
		logger.error("Error granting verification:", error);
		return res.status(500).json({ message: "Error granting verification", error: error.message });
	} finally {
		connection?.release();
	}
});

module.exports = router;