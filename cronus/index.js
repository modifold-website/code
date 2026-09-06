require("dotenv").config();

const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");

const { logger } = require("./packages/shared/logger");
const { db } = require("./config/db");
const { clickhouse } = require("./config/clickhouse");
const { cacheClient } = require("./config/cache");
const { createRateLimiter } = require("./middleware/rateLimit");
const { errorHandler, requestObservability } = require("./middleware/requestObservability");
const { validateStorageConfiguration } = require("./utils/fileHosting");
const authRoutes = require("./routes/v1/auth");
const usersRoutes = require("./routes/v1/users");
const subscriptionRoutes = require("./routes/v1/subscriptions");
const bansRoutes = require("./routes/v1/bans");
const notificationsRouter = require("./routes/v1/notifications");
const projectRoutes = require("./routes/v1/projects");
const versionRoutesV2 = require("./routes/v2/versions");
const discoverRoutesV2 = require("./routes/v2/discover");
const imageRoutesV2 = require("./routes/v2/images");
const prefabRoutesV2 = require("./routes/v2/prefabs");
const moderationTags = require("./routes/v1/moderation");
const usersModerationRouter = require("./routes/v1/users_moderation");
const ApiTokensRouter = require("./routes/v1/api-tokens");
const verificationRoutes = require("./routes/v1/verification");
const reportsRoutes = require("./routes/v1/reports");
const organizationsRoutes = require("./routes/v1/organizations");
const mediaRoutes = require("./routes/v1/media");
const tagsRoutes = require("./routes/v1/tags");
const analyticsRoutes = require("./routes/v1/analytics");
const internalDownloadsRoutes = require("./routes/internal/downloads");
const SERVER_PORT = Number(process.env.SERVER_PORT) || 4000;
const recommendedRoutes = require("./routes/v1/recommended");
const modJamsRoutes = require("./routes/v1/mod-jams");

const startServer = async () => {
	validateStorageConfiguration();
	await discoverRoutesV2.initializeDiscover();
	const app = express();

	app.disable("x-powered-by");
	app.set("trust proxy", true);
	app.use(requestObservability);

	app.use(cors({
		origin: true,
		methods: ["GET", "POST", "OPTIONS", "PATCH", "DELETE", "PUT"],
		allowedHeaders: [
			"DNT",
			"User-Agent",
			"X-Requested-With",
			"If-Modified-Since",
			"Cache-Control",
			"Content-Type",
			"Range",
			"Authorization",
			"X-Request-ID",
		],
		exposedHeaders: ["Content-Length", "Content-Range", "X-Request-ID"],
		credentials: true,
	}));

	const bodyLimit = process.env.EXPRESS_BODY_LIMIT || "2mb";
	app.use(express.json({ limit: bodyLimit }));
	app.use(express.urlencoded({ limit: bodyLimit, extended: true }));

	const tokenCache = new Map();
	const tokenCacheSizeLimit = Number(process.env.TOKEN_CACHE_MAX_SIZE) || 2000;
	const tokenCacheTtlMs = Number(process.env.TOKEN_CACHE_TTL_MS) || 2 * 60 * 1000;
	const tokenCachePruneIntervalMs = Number(process.env.TOKEN_CACHE_PRUNE_INTERVAL_MS) || 60 * 1000;

	const pruneExpiredTokenCacheEntries = () => {
		const now = Date.now();
		for(const [token, cached] of tokenCache.entries()) {
			if(!cached || cached.expiresAt <= now) {
				tokenCache.delete(token);
			}
		}
	};

	const tokenCachePruneInterval = setInterval(pruneExpiredTokenCacheEntries, tokenCachePruneIntervalMs);

	const authMiddleware = (req, res, next) => {
		const authHeader = req.headers.authorization;
		if(authHeader && authHeader.startsWith("Bearer ")) {
			const token = authHeader.split(" ")[1];

			if(token.startsWith("mf_")) {
				return next();
			}

			const now = Date.now();
			const cached = tokenCache.get(token);

			if(cached && cached.expiresAt > now) {
				req.user = cached.user;
				return next();
			}

			if(cached && cached.expiresAt <= now) {
				tokenCache.delete(token);
			}

			try {
				const decoded = jwt.verify(token, process.env.JWT_SECRET);
				req.user = decoded;

				const tokenExpMs = typeof decoded.exp === "number" ? decoded.exp * 1000 : now + tokenCacheTtlMs;
				const cacheExp = Math.min(now + tokenCacheTtlMs, tokenExpMs);

				if(tokenCache.size >= tokenCacheSizeLimit) {
					const firstKey = tokenCache.keys().next().value;
					if(firstKey) {
						tokenCache.delete(firstKey);
					}
				}

				tokenCache.set(token, { user: decoded, expiresAt: cacheExp });
			} catch (error) {
				// invalid bearer tokens are expected client input and are intentionally not logged
			}
		}

		next();
	};

	app.use(authMiddleware);

	const rateLimitEnabled = String(process.env.RATE_LIMIT_ENABLED || "true").toLowerCase() !== "false";
	const globalRateLimiter = createRateLimiter({
		namespace: "global",
		requestsPerMinute: Number(process.env.RATE_LIMIT_REQUESTS_PER_MINUTE) || 300,
		burstSize: Number(process.env.RATE_LIMIT_BURST_SIZE) || 120,
		expirySeconds: Number(process.env.RATE_LIMIT_EXPIRY_SECONDS) || 300,
	});
	const projectsRateLimiter = createRateLimiter({
		namespace: "projects",
		requestsPerMinute: Number(process.env.RATE_LIMIT_PROJECTS_REQUESTS_PER_MINUTE) || 120,
		burstSize: Number(process.env.RATE_LIMIT_PROJECTS_BURST_SIZE) || 40,
		expirySeconds: Number(process.env.RATE_LIMIT_EXPIRY_SECONDS) || 300,
	});

	if(rateLimitEnabled) {
		app.use(globalRateLimiter);
	}

	app.get("/health", (req, res) => {
		res.status(200).json({ status: "OK", uptime: process.uptime() });
	});

	app.use("/internal/downloads", internalDownloadsRoutes);

	const mountV1Route = (routePath, ...handlers) => {
		app.use(routePath, ...handlers);
		app.use(`/v1${routePath}`, ...handlers);
	};

	const projectsLimiterMiddleware = rateLimitEnabled ? projectsRateLimiter : (req, res, next) => next();
	mountV1Route("/moderation", moderationTags);
	mountV1Route("/projects", projectsLimiterMiddleware, projectRoutes);
	app.use("/v2/version", projectsLimiterMiddleware, versionRoutesV2);
	app.use("/v2/discover", projectsLimiterMiddleware, discoverRoutesV2);
	app.use("/v2/image", projectsLimiterMiddleware, imageRoutesV2);
	app.use("/v2/prefabs", (req, res, next) => {
		if(req.path.startsWith("/assets/")) {
			return next();
		}

		return projectsLimiterMiddleware(req, res, next);
	}, prefabRoutesV2);
	mountV1Route("/auth", authRoutes);
	mountV1Route("/users", usersRoutes);
	mountV1Route("/subscriptions", subscriptionRoutes);
	mountV1Route("/bans", bansRoutes);
	mountV1Route("/notifications", notificationsRouter);
	mountV1Route("/moderation/users", usersModerationRouter);
	mountV1Route("/api-tokens", ApiTokensRouter);
	mountV1Route("/verification", verificationRoutes);
	mountV1Route("/reports", reportsRoutes);
	mountV1Route("/organizations", organizationsRoutes);
	mountV1Route("/media", mediaRoutes);
	mountV1Route("/tags", tagsRoutes);
	mountV1Route("/analytics", analyticsRoutes);
	mountV1Route("/recommended", recommendedRoutes);
	mountV1Route("/mod-jams", modJamsRoutes);
	app.use(errorHandler);

	const server = app.listen(SERVER_PORT, () => {
		logger.info({ event: "server_started", port: SERVER_PORT }, "Server started");
	});

	server.setTimeout(600000);
	server.keepAliveTimeout = 65000;
	server.headersTimeout = 66000;
	if(typeof server.maxRequestsPerSocket === "number") {
		server.maxRequestsPerSocket = Number(process.env.HTTP_MAX_REQUESTS_PER_SOCKET) || 250;
	}

	const shutdown = async (signal) => {
		logger.info({ event: "server_shutdown", signal }, "Closing resources");
		clearInterval(tokenCachePruneInterval);
		tokenCache.clear();

		server.close(async () => {
			try {
				await db.end();
			} catch (error) {
				logger.warn({ event: "db_close_failed", error }, "Failed to close DB pool");
			}

			try {
				cacheClient.quit();
			} catch (error) {
				logger.warn({ event: "redis_close_failed", error }, "Failed to close cache client");
			}

			try {
				if(clickhouse) {
					await clickhouse.close();
				}
			} catch (error) {
				logger.warn({ event: "clickhouse_close_failed", error }, "Failed to close ClickHouse client");
			}

			process.exit(0);
		});
	};

	process.once("SIGTERM", () => {
		shutdown("SIGTERM");
	});
	process.once("SIGINT", () => {
		shutdown("SIGINT");
	});
};

startServer().catch((error) => {
	logger.error({ event: "server_start_failed", error }, "Server failed to start");
	process.exit(1);
});