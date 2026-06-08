const { cacheClient } = require("../config/cache");

const RATE_LIMIT_SCRIPT = `
local key = KEYS[1]
local now_ms = tonumber(ARGV[1])
local emission_interval_ms = tonumber(ARGV[2])
local burst_size = tonumber(ARGV[3])
local expiry_seconds = tonumber(ARGV[4])

local tat_raw = redis.call("GET", key)
local tat = now_ms
if tat_raw then
	tat = tonumber(tat_raw)
end

local increment = emission_interval_ms
local max_tat_delta = increment * burst_size
local allowance = now_ms - tat

if allowance < -max_tat_delta then
	local retry_after_ms = math.max(0, -allowance - max_tat_delta)
	local reset_after_ms = math.max(0, -allowance)
	return {0, 0, reset_after_ms, retry_after_ms}
end

local new_tat = math.max(tat + increment, now_ms)
redis.call("SET", key, tostring(new_tat), "EX", expiry_seconds)

local remaining = math.floor(math.max(0, (max_tat_delta - (new_tat - now_ms)) / increment))
local reset_after_ms = math.max(0, new_tat - now_ms)
return {1, remaining, reset_after_ms, 0}
`;

const getClientIp = (req) => {
	const useCloudflareIp = String(process.env.CLOUDFLARE_INTEGRATION || "").toLowerCase() === "true";
	if(useCloudflareIp) {
		const cfIp = req.headers["cf-connecting-ip"];
		if(typeof cfIp === "string" && cfIp.trim()) {
			return cfIp.trim();
		}
	}

	const candidates = [
		req.headers["x-real-ip"],
		req.headers["x-forwarded-for"],
		req.ip,
		req.socket?.remoteAddress,
	];

	for(const candidate of candidates) {
		if(Array.isArray(candidate) && candidate[0]) {
			return String(candidate[0]).split(",")[0].trim();
		}

		if(typeof candidate === "string" && candidate.trim()) {
			return candidate.split(",")[0].trim();
		}
	}

	return null;
};

const createRateLimiter = ({ namespace, requestsPerMinute, burstSize, expirySeconds = 300 }) => {
	const safeRpm = Math.max(1, Number(requestsPerMinute) || 60);
	const safeBurst = Math.max(1, Number(burstSize) || safeRpm);
	const emissionIntervalMs = Math.max(1, Math.floor(60000 / safeRpm));

	return async (req, res, next) => {
		const ignoreKey = process.env.RATE_LIMIT_IGNORE_KEY;
		const providedIgnoreKey = req.headers["x-ratelimit-key"];
		if(ignoreKey && providedIgnoreKey === ignoreKey) {
			return next();
		}

		const identifier = req.user?.id ? `user:${req.user.id}` : `ip:${getClientIp(req) || "unknown"}`;
		const key = `rl:${namespace}:${identifier}`;
		const nowMs = Date.now();

		try {
			const result = await cacheClient.eval(
				RATE_LIMIT_SCRIPT,
				[key],
				[String(nowMs), String(emissionIntervalMs), String(safeBurst), String(expirySeconds)]
			);

			const allowed = Number(result?.[0]) === 1;
			const remaining = Math.max(0, Number(result?.[1]) || 0);
			const resetAfterMs = Math.max(0, Number(result?.[2]) || 0);
			const retryAfterMs = Math.max(0, Number(result?.[3]) || 0);

			res.setHeader("x-ratelimit-limit", String(safeBurst));
			res.setHeader("x-ratelimit-remaining", String(remaining));
			res.setHeader("x-ratelimit-reset", String(Math.ceil(resetAfterMs / 1000)));

			if(!allowed) {
				res.setHeader("retry-after", String(Math.ceil(retryAfterMs / 1000)));
				return res.status(429).json({
					message: "Rate limit exceeded",
					retryAfterMs,
				});
			}

			return next();
		} catch (error) {
			// Fail-open: do not take API down when Redis is degraded.
			console.warn("Rate limiter degraded (fail-open):", error.message);
			res.setHeader("x-ratelimit-limit", String(safeBurst));
			res.setHeader("x-ratelimit-remaining", "1");
			res.setHeader("x-ratelimit-reset", "60");
			return next();
		}
	};
};

module.exports = { createRateLimiter };