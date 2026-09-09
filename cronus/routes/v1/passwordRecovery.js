const express = require("express");
const crypto = require("crypto");
const { db } = require("../../config/db");
const { sendMail } = require("../../utils/smtpMailer");
const { buildPasswordRecoveryMail } = require("../../utils/passwordRecoveryMail");
const { createRateLimiter } = require("../../middleware/rateLimit");
const { logger } = require("../../packages/shared/logger");

const router = express.Router();
const TTL_MS = 30 * 60 * 1000;
const tokenHash = (token) => crypto.createHash("sha256").update(token).digest("hex");
const validToken = (token) => typeof token === "string" && /^[a-f0-9]{64}$/.test(token);
const invalidLink = (res) => res.status(400).json({ success: false, code: "invalid_link" });

router.use((req, res, next) => {
	res.set("Cache-Control", "no-store");
	next();
});
router.use(createRateLimiter({ namespace: "password-recovery", requestsPerMinute: 3, burstSize: 5 }));

router.post("/request", async (req, res) => {
	const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
	if(email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
		return res.status(400).json({ success: false, code: "invalid_email" });
	}

	let connection;
	try {
		connection = await db.getConnection();
		await connection.beginTransaction();
		const [users] = await connection.query("SELECT id, password_hash FROM users WHERE email_login_key = ? AND password_hash IS NOT NULL LIMIT 1 FOR UPDATE", [email]);
		const user = users[0];
		let mail = null;
		let hash = null;
		if(user?.password_hash) {
			const [previous] = await connection.query("SELECT created_at FROM password_recoveries WHERE user_id = ?", [user.id]);
			const now = Date.now();
			if(!previous.length || now - Number(previous[0].created_at) >= 60000) {
				const token = crypto.randomBytes(32).toString("hex");
				hash = tokenHash(token);
				const base = String(process.env.FRONTEND_BASE || "https://modifold.com").replace(/\/+$/, "");
				mail = buildPasswordRecoveryMail(`${base}/auth/recovery#token=${token}`);
				await connection.query(
					"INSERT INTO password_recoveries (user_id, token_hash, password_hash, email, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE token_hash = VALUES(token_hash), password_hash = VALUES(password_hash), email = VALUES(email), created_at = VALUES(created_at), expires_at = VALUES(expires_at)",
					[user.id, hash, user.password_hash, email, now, now + TTL_MS]
				);
			}
		}
		
		await connection.commit();
		connection.release();
		connection = null;
		// SMTP runs after the identical response so delivery timing cannot reveal an account
		res.json({ success: true });
		if(mail) {
			try {
				await sendMail({ to: email, ...mail });
			} catch {
				await db.query("DELETE FROM password_recoveries WHERE token_hash = ?", [hash]);
				logger.error("Password recovery email delivery failed");
			}
		}
	} catch {
		if(connection) {
			await connection.rollback();
		}

		logger.error("Password recovery request failed");
		if(!res.headersSent) {
			res.status(503).json({ success: false, code: "generic" });
		}
	} finally {
		connection?.release();
	}
});

router.post("/validate", async (req, res) => {
	const token = req.body?.token;
	if(!validToken(token)) {
		return invalidLink(res);
	}
	
	try {
		const [rows] = await db.query(
			"SELECT r.user_id FROM password_recoveries r JOIN users u ON u.id = r.user_id WHERE r.token_hash = ? AND r.expires_at > ? AND BINARY r.password_hash = BINARY u.password_hash AND BINARY r.email = BINARY u.email_login_key",
			[tokenHash(token), Date.now()]
		);

		return rows.length ? res.json({ success: true }) : invalidLink(res);
	} catch {
		return res.status(503).json({ success: false, code: "generic" });
	}
});

router.post("/confirm", async (req, res) => {
	const { token, password, confirmPassword } = req.body || {};
	if(!validToken(token)) {
		return invalidLink(res);
	}

	if(typeof password !== "string" || password.length < 8) {
		return res.status(400).json({ success: false, code: "invalid_password" });
	}

	if(Buffer.byteLength(password) > 72) {
		return res.status(400).json({ success: false, code: "password_too_long" });
	}

	if(password !== confirmPassword) {
		return res.status(400).json({ success: false, code: "password_mismatch" });
	}

	let connection;
	try {
		const hash = tokenHash(token);
		const [rows] = await db.query("SELECT user_id FROM password_recoveries WHERE token_hash = ? AND expires_at > ?", [hash, Date.now()]);
		if(!rows.length) {
			return invalidLink(res);
		}

		const newHash = await Bun.password.hash(password, { algorithm: "bcrypt", cost: 12 });
		
		connection = await db.getConnection();
		await connection.beginTransaction();
		
		const [users] = await connection.query("SELECT id, email_login_key, password_hash FROM users WHERE id = ? FOR UPDATE", [rows[0].user_id]);
		const [links] = await connection.query("SELECT * FROM password_recoveries WHERE user_id = ? AND token_hash = ? AND expires_at > ? FOR UPDATE", [rows[0].user_id, hash, Date.now()]);
		const user = users[0];
		const link = links[0];
		if(!link || !user?.password_hash || user.password_hash !== link.password_hash || user.email_login_key !== link.email) {
			await connection.rollback();
			return invalidLink(res);
		}

		await connection.query("UPDATE users SET password_hash = ? WHERE id = ?", [newHash, user.id]);
		await connection.query("UPDATE password_recoveries SET token_hash = NULL WHERE user_id = ?", [user.id]);
		await connection.commit();
		
		return res.json({ success: true, email: link.email });
	} catch {
		if(connection) {
			await connection.rollback();
		}

		logger.error("Password recovery confirmation failed");
		return res.status(503).json({ success: false, code: "generic" });
	} finally {
		connection?.release();
	}
});

module.exports = router;