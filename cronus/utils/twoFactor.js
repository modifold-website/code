const { authenticator } = require("otplib");
const { db } = require("../config/db");

authenticator.options = { window: 1 };

const getTwoFactorRow = async (userId, database = db) => {
	const [rows] = await database.query(
		"SELECT secret, enabled FROM user_two_factor WHERE user_id = ? LIMIT 1",
		[userId]
	);
	return rows[0] || null;
};

const isTwoFactorEnabled = (row) => Boolean(row && Number(row.enabled) === 1 && row.secret);

const verifyTwoFactorCode = (row, code) => {
	if(!isTwoFactorEnabled(row)) {
		return false;
	}

	const normalizedCode = String(code || "").replace(/\s+/g, "");
	return /^\d{6}$/.test(normalizedCode) && authenticator.check(normalizedCode, row.secret);
};

module.exports = {
	authenticator,
	getTwoFactorRow,
	isTwoFactorEnabled,
	verifyTwoFactorCode,
};