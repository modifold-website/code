const crypto = require("crypto");

const RELEASE_LOCK_SCRIPT = `
	if redis.call("GET", KEYS[1]) == ARGV[1] then
		return redis.call("DEL", KEYS[1])
	end
	return 0
`;

const EXTEND_LOCK_SCRIPT = `
	if redis.call("GET", KEYS[1]) == ARGV[1] then
		return redis.call("PEXPIRE", KEYS[1], ARGV[2])
	end
	return 0
`;

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

const createSingleFlightCache = ({ cacheClient, now = Date.now, random = Math.random } = {}) => {
	const memorySnapshots = new Map();
	const localFlights = new Map();

	const readSnapshot = async (key) => {
		try {
			const { value } = await cacheClient.get(key);
			if(!value) {
				const memorySnapshot = memorySnapshots.get(key) || null;
				if(memorySnapshot && memorySnapshot.staleUntil > now()) {
					return memorySnapshot;
				}

				memorySnapshots.delete(key);
				return null;
			}

			const snapshot = JSON.parse(value.toString());
			if(!snapshot || typeof snapshot !== "object" || !("value" in snapshot)) {
				return null;
			}

			memorySnapshots.set(key, snapshot);
			return snapshot;
		} catch(error) {
			const memorySnapshot = memorySnapshots.get(key) || null;
			if(memorySnapshot && memorySnapshot.staleUntil > now()) {
				return memorySnapshot;
			}

			memorySnapshots.delete(key);
			return null;
		}
	};

	const writeSnapshot = async (key, value, freshTtlSeconds, staleTtlSeconds, jitterRatio) => {
		const jitterMultiplier = 1 + ((random() * 2) - 1) * jitterRatio;
		const freshForSeconds = Math.max(1, Math.round(freshTtlSeconds * jitterMultiplier));
		const snapshot = {
			value,
			freshUntil: now() + freshForSeconds * 1000,
			staleUntil: now() + (freshForSeconds + staleTtlSeconds) * 1000,
		};
		memorySnapshots.set(key, snapshot);

		try {
			await cacheClient.set(key, JSON.stringify(snapshot), {
				expires: freshForSeconds + staleTtlSeconds,
			});
		} catch(error) {
			// the in-process snapshot still provides bounded fallback during Redis outages
		}

		return snapshot;
	};

	const acquireLock = async (lockKey, lockTtlMs) => {
		const token = crypto.randomBytes(18).toString("base64url");
		try {
			const result = await cacheClient.set(lockKey, token, {
				expiresMilliseconds: lockTtlMs,
				onlyIfAbsent: true,
			});

			return result === "OK" ? token : null;
		} catch(error) {
			return undefined;
		}
	};

	const releaseLock = async (lockKey, token) => {
		if(!token) {
			return;
		}
		try {
			await cacheClient.eval(RELEASE_LOCK_SCRIPT, [lockKey], [token]);
		} catch(error) {
			// expiration is the final safety net when Redis disappears mid-refresh
		}
	};

	const withLockHeartbeat = async (lockKey, token, lockTtlMs, callback) => {
		const heartbeat = setInterval(() => {
			cacheClient.eval(EXTEND_LOCK_SCRIPT, [lockKey], [token, String(lockTtlMs)]).catch(() => {});
		}, Math.max(1000, Math.floor(lockTtlMs / 3)));
		heartbeat.unref?.();

		try {
			return await callback();
		} finally {
			clearInterval(heartbeat);
			await releaseLock(lockKey, token);
		}
	};

	const runLocalFlight = (key, callback) => {
		if(localFlights.has(key)) {
			return localFlights.get(key);
		}

		const flight = Promise.resolve().then(callback).finally(() => {
			if(localFlights.get(key) === flight) {
				localFlights.delete(key);
			}
		});

		localFlights.set(key, flight);
		return flight;
	};

	const refresh = ({ key, lockKey, lockToken, build, freshTtlSeconds, staleTtlSeconds, jitterRatio, lockTtlMs }) => runLocalFlight(key, () => {
		const buildAndStore = async () => {
			const value = await build();
			await writeSnapshot(key, value, freshTtlSeconds, staleTtlSeconds, jitterRatio);
			return value;
		};

		return lockToken ? withLockHeartbeat(lockKey, lockToken, lockTtlMs, buildAndStore) : buildAndStore();
	});

	const getOrRefresh = async ({
		key,
		build,
		freshTtlSeconds,
		staleTtlSeconds,
		jitterRatio = 0.15,
		lockTtlMs = 60000,
		coldWaitMs = 2000,
	}) => {
		const snapshot = await readSnapshot(key);
		if(snapshot && snapshot.freshUntil > now()) {
			return { value: snapshot.value, cacheStatus: "fresh" };
		}

		const lockKey = `cache-refresh-lock:${key}`;
		const lockToken = await acquireLock(lockKey, lockTtlMs);

		if(snapshot) {
			if(lockToken || lockToken === undefined) {
				refresh({ key, lockKey, lockToken, build, freshTtlSeconds, staleTtlSeconds, jitterRatio, lockTtlMs }).catch(() => {});
			}

			return { value: snapshot.value, cacheStatus: lockToken || lockToken === undefined ? "stale-refreshing" : "stale" };
		}

		if(lockToken) {
			const value = await refresh({ key, lockKey, lockToken, build, freshTtlSeconds, staleTtlSeconds, jitterRatio, lockTtlMs });
			return { value, cacheStatus: "miss" };
		}

		if(lockToken === undefined) {
			const value = await refresh({ key, lockKey, lockToken, build, freshTtlSeconds, staleTtlSeconds, jitterRatio, lockTtlMs });
			return { value, cacheStatus: "uncached" };
		}

		const waitDeadline = now() + coldWaitMs;
		while(now() < waitDeadline) {
			await sleep(Math.min(50, Math.max(1, waitDeadline - now())));
			const filledSnapshot = await readSnapshot(key);
			if(filledSnapshot) {
				return { value: filledSnapshot.value, cacheStatus: "coalesced" };
			}
		}

		const value = await runLocalFlight(key, async () => {
			const builtValue = await build();
			await writeSnapshot(key, builtValue, freshTtlSeconds, staleTtlSeconds, jitterRatio);
			return builtValue;
		});

		return { value, cacheStatus: "uncached" };
	};

	return {
		getOrRefresh,
	};
};

module.exports = {
	createSingleFlightCache,
	RELEASE_LOCK_SCRIPT,
	EXTEND_LOCK_SCRIPT,
};