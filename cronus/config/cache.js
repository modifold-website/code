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

redis.on("error", (error) => {
	console.error("[redis] client error:", error);
});

let connectPromise = null;
const ensureConnected = async () => {
	if(redis.status === "ready") {
		return;
	}

	if(!connectPromise) {
		connectPromise = redis.connect().catch((error) => {
			connectPromise = null;
			console.error("[redis] connect failed:", error);
			throw error;
		});
	}

	await connectPromise;
};

const runRedisOperation = async (operation, callback) => {
	try {
		return await callback();
	} catch(error) {
		console.error(`[redis] ${operation} failed:`, error);
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
			const expires = Number(options.expires) || Number(process.env.REDIS_DEFAULT_TTL_SECONDS) || 60;
			await redis.set(key, value, "EX", expires);
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