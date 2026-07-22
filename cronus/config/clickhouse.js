require("dotenv").config();

const { createClient } = require("@clickhouse/client");

const hasClickHouseConfig = Boolean(
	process.env.CLICKHOUSE_URL &&
	process.env.CLICKHOUSE_DB &&
	process.env.CLICKHOUSE_USER &&
	process.env.CLICKHOUSE_PASSWORD
);

const createLoggedClickHouseClient = (client) => {
	const runClickHouseOperation = async (operation, payload, callback) => {
		try {
			return await callback();
		} catch(error) {
			console.error(`[clickhouse] ${operation} failed:`, {
				operation,
				table: payload?.table,
				query: payload?.query,
				format: payload?.format,
			}, error);
			throw error;
		}
	};

	return {
		...client,
		insert: (payload) => runClickHouseOperation("insert", payload, () => client.insert(payload)),
		query: (payload) => runClickHouseOperation("query", payload, () => client.query(payload)),
		command: (payload) => runClickHouseOperation("command", payload, () => client.command(payload)),
		close: () => runClickHouseOperation("close", null, () => client.close()),
	};
};

const rawClickHouse = hasClickHouseConfig ? createClient({
	url: process.env.CLICKHOUSE_URL,
	database: process.env.CLICKHOUSE_DB,
	username: process.env.CLICKHOUSE_USER,
	password: process.env.CLICKHOUSE_PASSWORD,
	keep_alive: {
		enabled: true,
	},
	max_open_connections: Number(process.env.CLICKHOUSE_MAX_OPEN_CONNECTIONS) || 10,
}) : null;

const clickhouse = rawClickHouse ? createLoggedClickHouseClient(rawClickHouse) : null;

module.exports = {
	clickhouse,
	hasClickHouseConfig,
};