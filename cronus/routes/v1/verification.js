const express = require("express");
const { db } = require("../../config/db");
const auth = require("../../middleware/auth");

const router = express.Router();

const VERIFICATION_MIN_DOWNLOADS = 500;
const VERIFICATION_MIN_PROJECTS = 3;

const getVerificationEligibility = async (userId) => {
	const [rows] = await db.query(
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
		console.error("Error fetching verification status:", error);
		res.status(500).json({ message: "Error fetching verification status", error: error.message });
	}
});

router.post("/request", auth, async (req, res) => {
	try {
		const [users] = await db.query("SELECT id, isVerified FROM users WHERE id = ?", [req.user.id]);
		if(!users.length) {
			return res.status(404).json({ message: "User not found" });
		}

		if(Number(users[0].isVerified) === 1) {
			return res.status(400).json({ message: "User already verified" });
		}

		const eligibility = await getVerificationEligibility(req.user.id);
		if(!eligibility.eligible) {
			return res.status(400).json({ message: "Requirements not met", eligibility });
		}

		await db.query("UPDATE users SET isVerified = 1 WHERE id = ?", [req.user.id]);
		return res.json({ success: true });
	} catch (error) {
		console.error("Error granting verification:", error);
		return res.status(500).json({ message: "Error granting verification", error: error.message });
	}
});

module.exports = router;