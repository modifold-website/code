require("dotenv").config();

const Redis = require("ioredis");

const redisUrl = process.env.REDIS_URL || "redis://127.0.0.1:6379";
const redisPrefix = process.env.REDIS_PREFIX || "modifold:";

const redis = new Redis(redisUrl, {
	keyPrefix: redisPrefix,
	lazyConnect: true,
	connectTimeout: Number(process.env.REDIS_CONNECT_TIMEOUT_MS) || 1000,
	maxRetriesPerRequest: Number(process.env.REDIS_MAX_RETRIES_PER_REQUEST) || 1,
	enableOfflineQueue: false,
});

const redisRetryBackoffMs = Number(process.env.REDIS_RETRY_BACKOFF_MS) || 1000;
const redisErrorLogIntervalMs = Number(process.env.REDIS_ERROR_LOG_INTERVAL_MS) || 30000;
const lastErrorLogs = new Map();
let unavailableUntil = 0;

const logRedisError = (operation, error) => {
	const now = Date.now();
	const previous = lastErrorLogs.get(operation) || { loggedAt: 0, suppressed: 0 };

	if(now - previous.loggedAt < redisErrorLogIntervalMs) {
		lastErrorLogs.set(operation, {
			...previous,
			suppressed: previous.suppressed + 1,
		});
		return;
	}

	const suppressedMessage = previous.suppressed > 0 ? ` (${previous.suppressed} similar errors suppressed)` : "";
	console.warn(`[redis] ${operation} unavailable${suppressedMessage}:`, error.message);
	lastErrorLogs.set(operation, { loggedAt: now, suppressed: 0 });
};

redis.on("error", (error) => {
	unavailableUntil = Math.max(unavailableUntil, Date.now() + redisRetryBackoffMs);
	logRedisError("client", error);
});

let connectPromise = null;
const ensureConnected = async () => {
	if(redis.status === "ready") {
		return;
	}

	if(Date.now() < unavailableUntil) {
		throw new Error("Redis is temporarily unavailable");
	}

	if(!connectPromise) {
		connectPromise = redis.connect().catch((error) => {
			connectPromise = null;
			throw error;
		});
	}

	await connectPromise;
};

const runRedisOperation = async (operation, callback) => {
	try {
		const result = await callback();
		unavailableUntil = 0;
		return result;
	} catch(error) {
		unavailableUntil = Math.max(unavailableUntil, Date.now() + redisRetryBackoffMs);
		logRedisError(operation, error);
		throw error;
	}
};

const cacheClient = {
	get: async (key) => {
		return runRedisOperation("get", async () => {
			await ensureConnected();
			const value = await redis.getBuffer(key);
			return { value: value || null };
		});
	},
	set: async (key, value, options = {}) => {
		return runRedisOperation("set", async () => {
			await ensureConnected();
			const commandArguments = [key, value];
			if(options.expiresMilliseconds) {
				commandArguments.push("PX", Math.max(1, Number(options.expiresMilliseconds)));
			} else {
				const expires = Number(options.expires) || Number(process.env.REDIS_DEFAULT_TTL_SECONDS) || 60;
				commandArguments.push("EX", Math.max(1, expires));
			}
			if(options.onlyIfAbsent) {
				commandArguments.push("NX");
			}

			return redis.set(...commandArguments);
		});
	},
	eval: async (script, keys = [], args = []) => {
		return runRedisOperation("eval", async () => {
			await ensureConnected();
			return redis.eval(script, keys.length, ...keys, ...args);
		});
	},
	quit: async () => {
		return runRedisOperation("quit", async () => {
			if(redis.status === "end") {
				return;
			}

			await redis.quit();
		});
	},
};

module.exports = { cacheClient };