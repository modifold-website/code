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

let connectPromise = null;
const ensureConnected = async () => {
	if(redis.status === "ready") {
		return;
	}

	if(!connectPromise) {
		connectPromise = redis.connect().catch((error) => {
			connectPromise = null;
			throw error;
		});
	}

	await connectPromise;
};

const cacheClient = {
	get: async (key) => {
		await ensureConnected();
		const value = await redis.getBuffer(key);
		return { value: value || null };
	},
	set: async (key, value, options = {}) => {
		await ensureConnected();
		const expires = Number(options.expires) || Number(process.env.REDIS_DEFAULT_TTL_SECONDS) || 60;
		await redis.set(key, value, "EX", expires);
	},
	eval: async (script, keys = [], args = []) => {
		await ensureConnected();
		return redis.eval(script, keys.length, ...keys, ...args);
	},
	quit: async () => {
		if(redis.status === "end") {
			return;
		}

		await redis.quit();
	},
};

module.exports = { cacheClient };