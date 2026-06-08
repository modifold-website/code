const { cacheClient } = require("../config/cache");

const getCacheJson = async (key) => {
	try {
		const { value } = await cacheClient.get(key);
		if(!value) {
			return null;
		}

		return JSON.parse(value.toString());
	} catch (error) {
		console.warn("Redis cache read failed:", key, error.message);
		return null;
	}
};

const setCacheJson = async (key, value, ttlSeconds) => {
	try {
		await cacheClient.set(key, JSON.stringify(value), { expires: ttlSeconds });
	} catch (error) {
		console.warn("Redis cache write failed:", key, error.message);
	}
};

const deleteCacheByPattern = async (pattern) => {
	try {
		const redisPrefix = process.env.REDIS_PREFIX || "modifold:";
		const prefixedPattern = `${redisPrefix}${pattern}`;
		const script = `
			local cursor = "0"
			local totalDeleted = 0
			repeat
				local result = redis.call("SCAN", cursor, "MATCH", ARGV[1], "COUNT", 100)
				cursor = result[1]
				local keys = result[2]
				if #keys > 0 then
					totalDeleted = totalDeleted + redis.call("DEL", unpack(keys))
				end
			until cursor == "0"
			return totalDeleted
		`;

		return await cacheClient.eval(script, [], [prefixedPattern]);
	} catch (error) {
		console.warn("Redis cache delete failed:", pattern, error.message);
		return 0;
	}
};

module.exports = {
	getCacheJson,
	setCacheJson,
	deleteCacheByPattern,
};