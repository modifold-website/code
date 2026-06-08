require("dotenv").config();

const { createClient } = require("@clickhouse/client");

const hasClickHouseConfig = Boolean(
    process.env.CLICKHOUSE_URL &&
    process.env.CLICKHOUSE_DB &&
    process.env.CLICKHOUSE_USER &&
    process.env.CLICKHOUSE_PASSWORD
);

const clickhouse = hasClickHouseConfig ? createClient({
	url: process.env.CLICKHOUSE_URL,
	database: process.env.CLICKHOUSE_DB,
	username: process.env.CLICKHOUSE_USER,
	password: process.env.CLICKHOUSE_PASSWORD,
	keep_alive: {
		enabled: true,
	},
	max_open_connections: Number(process.env.CLICKHOUSE_MAX_OPEN_CONNECTIONS) || 10,
}) : null;

module.exports = {
    clickhouse,
    hasClickHouseConfig,
};