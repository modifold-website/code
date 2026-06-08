require("dotenv").config();

const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const swaggerUi = require("swagger-ui-express");

const specs = require("./swagger");
const { db } = require("./config/db");
const { clickhouse } = require("./config/clickhouse");
const { cacheClient } = require("./config/cache");
const { createRateLimiter } = require("./middleware/rateLimit");
const authRoutes = require("./routes/auth");
const usersRoutes = require("./routes/users");
const subscriptionRoutes = require("./routes/subscriptions");
const bansRoutes = require("./routes/bans");
const notificationsRouter = require("./routes/notifications");
const projectRoutes = require("./routes/projects");
const moderationTags = require("./routes/moderation");
const usersModerationRouter = require("./routes/users_moderation");
const ApiTokensRouter = require("./routes/api-tokens");
const verificationRoutes = require("./routes/verification");
const reportsRoutes = require("./routes/reports");
const organizationsRoutes = require("./routes/organizations");
const mediaRoutes = require("./routes/media");
const tagsRoutes = require("./routes/tags");
const analyticsRoutes = require("./routes/analytics");
const SERVER_PORT = Number(process.env.SERVER_PORT) || 4000;
const recommendedRoutes = require("./routes/recommended");
const modJamsRoutes = require("./routes/mod-jams");

const startServer = () => {
	const app = express();

	app.disable("x-powered-by");
	app.set("trust proxy", true);

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
		],
		exposedHeaders: ["Content-Length", "Content-Range"],
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
			} catch (err) {
				console.error("Invalid token:", err.message);
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

	app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(specs, {
		customCss: ".swagger-ui .topbar { display: none }",
		customSiteTitle: "Modifold API Documentation",
	}));

	app.get("/api-docs.json", (req, res) => {
		res.setHeader("Content-Type", "application/json");
		res.send(specs);
	});

	app.use("/moderation", moderationTags);
	app.use("/projects", rateLimitEnabled ? projectsRateLimiter : (req, res, next) => next(), projectRoutes);
	app.use("/auth", authRoutes);
	app.use("/users", usersRoutes);
	app.use("/subscriptions", subscriptionRoutes);
	app.use("/bans", bansRoutes);
	app.use("/notifications", notificationsRouter);
	app.use("/moderation/users", usersModerationRouter);
	app.use("/api-tokens", ApiTokensRouter);
	app.use("/verification", verificationRoutes);
	app.use("/reports", reportsRoutes);
	app.use("/organizations", organizationsRoutes);
	app.use("/media", mediaRoutes);
	app.use("/tags", tagsRoutes);
	app.use("/analytics", analyticsRoutes);
	app.use("/recommended", recommendedRoutes);
	app.use("/mod-jams", modJamsRoutes);

	const server = app.listen(SERVER_PORT, () => {
		console.log(`Server running on http://localhost:${SERVER_PORT}`);
		console.log(`Swagger UI http://localhost:${SERVER_PORT}/api-docs`);
	});

	server.setTimeout(600000);
	server.keepAliveTimeout = 65000;
	server.headersTimeout = 66000;
	if(typeof server.maxRequestsPerSocket === "number") {
		server.maxRequestsPerSocket = Number(process.env.HTTP_MAX_REQUESTS_PER_SOCKET) || 250;
	}

	const shutdown = async (signal) => {
		console.log(`Received ${signal}, closing resources...`);
		clearInterval(tokenCachePruneInterval);
		tokenCache.clear();

		server.close(async () => {
			try {
				await db.end();
			} catch (error) {
				console.warn("Failed to close DB pool:", error.message);
			}

			try {
				cacheClient.quit();
			} catch (error) {
				console.warn("Failed to close cache client:", error.message);
			}

			try {
				if(clickhouse) {
					await clickhouse.close();
				}
			} catch (error) {
				console.warn("Failed to close ClickHouse client:", error.message);
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

startServer();
