const { cacheClient } = require("../config/cache");

const CACHE_GENERATION_TTL_SECONDS = 60 * 60 * 24 * 14;
const SCAN_BATCH_SIZE = 100;
const UNLINK_BATCH_SIZE = 100;
const SCAN_DELAY_MS = 2;
const MAX_SCAN_PAGES = 10000;
const MAX_CONSECUTIVE_UNLINK_ERRORS = 3;

const BUMP_GENERATION_SCRIPT = `
	local generation = redis.call("INCR", KEYS[1])
	redis.call("EXPIRE", KEYS[1], ARGV[1])
	return tostring(generation)
`;

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

const createCacheUtils = ({
	client,
	redisPrefix = process.env.REDIS_PREFIX || "modifold:",
	wait = delay,
} = {}) => {
	const getCacheJson = async (key) => {
		try {
			const { value } = await client.get(key);
			if(!value) {
				return null;
			}

			return JSON.parse(value.toString());
		} catch (error) {
			return null;
		}
	};

	const setCacheJson = async (key, value, ttlSeconds) => {
		try {
			await client.set(key, JSON.stringify(value), { expires: ttlSeconds });
		} catch (error) {
			return false;
		}

		return true;
	};

	const getCacheGeneration = async (namespace) => {
		try {
			const { value } = await client.get(`cache_generation:${namespace}`);
			return value ? value.toString() : "0";
		} catch(error) {
			return "0";
		}
	};

	const bumpCacheGeneration = async (namespace) => {
		try {
			return await client.eval(
				BUMP_GENERATION_SCRIPT,
				[`cache_generation:${namespace}`],
				[String(CACHE_GENERATION_TTL_SECONDS)]
			);
		} catch(error) {
			return null;
		}
	};

	const deleteCacheByPattern = async (pattern) => {
		const prefixedPattern = `${redisPrefix}${pattern}`;
		let cursor = "0";
		let pageCount = 0;
		let totalDeleted = 0;
		let consecutiveUnlinkErrors = 0;

		try {
			do {
				const [nextCursor, physicalKeys = []] = await client.scan(cursor, prefixedPattern, SCAN_BATCH_SIZE);
				cursor = String(nextCursor);
				pageCount += 1;

				const logicalKeys = physicalKeys
					.filter((key) => redisPrefix === "" || String(key).startsWith(redisPrefix))
					.map((key) => redisPrefix === "" ? String(key) : String(key).slice(redisPrefix.length));

				for(let offset = 0; offset < logicalKeys.length; offset += UNLINK_BATCH_SIZE) {
					try {
						totalDeleted += Number(await client.unlink(logicalKeys.slice(offset, offset + UNLINK_BATCH_SIZE))) || 0;
						consecutiveUnlinkErrors = 0;
					} catch(error) {
						consecutiveUnlinkErrors += 1;
						if(consecutiveUnlinkErrors >= MAX_CONSECUTIVE_UNLINK_ERRORS) {
							return totalDeleted;
						}
					}
				}

				if(cursor !== "0" && pageCount < MAX_SCAN_PAGES) {
					await wait(SCAN_DELAY_MS);
				}
			} while(cursor !== "0" && pageCount < MAX_SCAN_PAGES);
		} catch(error) {
			return totalDeleted;
		}

		return totalDeleted;
	};

	return {
		getCacheJson,
		setCacheJson,
		getCacheGeneration,
		bumpCacheGeneration,
		deleteCacheByPattern,
	};
};

const cacheUtils = createCacheUtils({ client: cacheClient });

module.exports = {
	...cacheUtils,
	createCacheUtils,
	BUMP_GENERATION_SCRIPT,
};