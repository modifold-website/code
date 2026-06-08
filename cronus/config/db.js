require('dotenv').config();
const mysql = require('mysql2/promise');

const db = mysql.createPool({
	host: process.env.DB_HOST,
	user: process.env.DB_USER,
	password: process.env.DB_PASSWORD,
	database: process.env.DB_NAME,
	connectionLimit: Number(process.env.DB_CONNECTION_LIMIT) || 50,
	maxIdle: Number(process.env.DB_MAX_IDLE) || 20,
	idleTimeout: Number(process.env.DB_IDLE_TIMEOUT_MS) || 60000,
	enableKeepAlive: true,
	keepAliveInitialDelay: 0,
	waitForConnections: true,
	queueLimit: Number(process.env.DB_QUEUE_LIMIT) || 2000
});

module.exports = { db };