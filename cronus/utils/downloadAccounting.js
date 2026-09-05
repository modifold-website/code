const path = require("path");

const { db } = require("../config/db");
const { DOWNLOAD_DEDUPE_LIMIT, DOWNLOAD_DEDUPE_TTL_SECONDS, enqueueDownload } = require("./downloadQueue");

const DOWNLOAD_FILE_EXTENSIONS = new Set([".jar", ".zip", ".rar"]);
const DEFAULT_DOWNLOAD_PAGE_ORIGINS = [
	"https://modifold.com",
	"http://localhost:3000",
	"http://127.0.0.1:3000",
];

const BOT_USER_AGENT_PATTERN = /(bot|crawler|spider|preview|facebookexternalhit|discordbot|telegrambot|slackbot|semrush|ahrefs|mj12|dotbot|blexbot|bytespider|petalbot|curl|wget|python-requests|go-http-client)/i;

const getHeaderValue = (value) => {
	if(Array.isArray(value)) {
		return value[0] || "";
	}

	return typeof value === "string" ? value : "";
};

const getTrustedDownloadPageOrigins = () => {
	const configuredOrigins = String(process.env.DOWNLOAD_PAGE_ORIGINS || "")
		.split(",")
		.map((value) => value.trim())
		.filter(Boolean);

	return new Set([...configuredOrigins, ...DEFAULT_DOWNLOAD_PAGE_ORIGINS].map((value) => value.replace(/\/+$/, "")));
};

const getUrlOrigin = (value) => {
	const rawValue = getHeaderValue(value).trim();
	if(!rawValue) {
		return null;
	}

	try {
		return new URL(rawValue).origin.replace(/\/+$/, "");
	} catch {
		return null;
	}
};

const getRequestOrigin = (req) => getUrlOrigin(req.headers.origin);

const getRequestRefererOrigin = (req) => getUrlOrigin(req.headers.referer || req.headers.referrer);

const hasTrustedDownloadPageOrigin = (req) => {
	const trustedOrigins = getTrustedDownloadPageOrigins();
	const origin = getRequestOrigin(req);
	const refererOrigin = getRequestRefererOrigin(req);

	return Boolean(origin && trustedOrigins.has(origin)) || Boolean(refererOrigin && trustedOrigins.has(refererOrigin));
};

const hasTrustedDownloadPageReferer = (req) => {
	const trustedOrigins = getTrustedDownloadPageOrigins();
	const refererOrigin = getRequestRefererOrigin(req);

	return Boolean(refererOrigin && trustedOrigins.has(refererOrigin));
};

const extractIpAddress = (value) => {
	if(Array.isArray(value)) {
		for(const entry of value) {
			const extracted = extractIpAddress(entry);
			if(extracted) {
				return extracted;
			}
		}

		return null;
	}

	if(typeof value !== "string") {
		return null;
	}

	const firstValue = value.split(",")[0]?.trim();
	if(!firstValue || firstValue.toLowerCase() === "unknown") {
		return null;
	}

	return firstValue.replace(/^::ffff:/i, "") || null;
};

const getRequestIpAddress = (req) => {
	const useCloudflareIp = String(process.env.CLOUDFLARE_INTEGRATION || "").toLowerCase() === "true";
	const candidates = useCloudflareIp
		? [
			req.headers["cf-connecting-ip"],
			req.headers["x-real-ip"],
			req.headers["x-forwarded-for"],
			req.headers["true-client-ip"],
			req.ip,
			req.socket?.remoteAddress,
		]
		: [
			req.headers["x-real-ip"],
			req.headers["x-forwarded-for"],
			req.headers["cf-connecting-ip"],
			req.headers["true-client-ip"],
			req.ip,
			req.socket?.remoteAddress,
		];

	for(const candidate of candidates) {
		const ipAddress = extractIpAddress(candidate);
		if(ipAddress) {
			return ipAddress;
		}
	}

	return null;
};

const getRequestCountryCode = (req) => {
	const countryCode = getHeaderValue(req.headers["cf-ipcountry"]).trim().toLowerCase();
	return /^[a-z]{2}$/.test(countryCode) ? countryCode : null;
};

const getIpPrefix = (ipAddress) => {
	const normalizedIp = String(ipAddress || "").trim().toLowerCase();
	if(!normalizedIp) {
		return null;
	}

	const ipv4Match = normalizedIp.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.\d{1,3}$/);
	if(ipv4Match) {
		return `${ipv4Match[1]}.${ipv4Match[2]}.${ipv4Match[3]}.0/24`;
	}

	if(normalizedIp.includes(":")) {
		const parts = normalizedIp.split(":");
		return `${parts.slice(0, 4).join(":")}::/64`;
	}

	return normalizedIp;
};

const getPublicMediaBases = () => {
	return ["https://cdn.modifold.com"];
};

const getSafeDownloadUrl = (fileUrl) => {
	try {
		const parsedUrl = new URL(String(fileUrl || ""));
		if(parsedUrl.protocol !== "https:" || !getPublicMediaBases().includes(parsedUrl.origin)) {
			return null;
		}
		return parsedUrl.toString();
	} catch {
		return null;
	}
};

const getOriginalPath = (req) => {
	const originalUri = getHeaderValue(req.headers["x-original-uri"]) || req.originalUrl || req.url;
	if(!originalUri) {
		return null;
	}

	try {
		const parsedUrl = new URL(originalUri, "https://cdn.modifold.com");
		return parsedUrl.pathname || null;
	} catch {
		return String(originalUri).split("?")[0] || null;
	}
};

const isDownloadFilePath = (filePath) => {
	const extension = path.extname(String(filePath || "").split("?")[0]).toLowerCase();
	return DOWNLOAD_FILE_EXTENSIONS.has(extension);
};

const getFileUrlCandidates = (filePath) => {
	if(!filePath || !filePath.startsWith("/")) {
		return [];
	}

	return getPublicMediaBases().map((base) => `${base}${filePath}`);
};

const findApprovedVersionByFilePath = async (filePath) => {
	const fileUrlCandidates = getFileUrlCandidates(filePath);
	if(!fileUrlCandidates.length) {
		return null;
	}

	const [rows] = await db.query(
		`SELECT
		v.id,
		v.file_url,
		v.moderation_status,
		p.id AS project_id,
		p.slug AS project_slug,
		p.user_id AS project_user_id,
		p.downloads AS project_downloads
		FROM project_versions v
		INNER JOIN projects p ON p.id = v.project_id
		WHERE v.file_url IN (?)
		AND v.moderation_status = 'approved'
		LIMIT 1`,
		[fileUrlCandidates]
	);

	return rows[0] || null;
};

const findApprovedVersionByProjectVersionId = async ({ slug, versionId }) => {
	const normalizedSlug = String(slug || "").trim();
	const normalizedVersionId = String(versionId || "").trim();
	if(!normalizedSlug || !normalizedVersionId) {
		return null;
	}

	const [rows] = await db.query(
		`SELECT
		v.id,
		v.file_url,
		v.moderation_status,
		p.id AS project_id,
		p.slug AS project_slug,
		p.user_id AS project_user_id,
		p.downloads AS project_downloads
		FROM project_versions v
		INNER JOIN projects p ON p.id = v.project_id
		WHERE p.slug = ?
		AND v.id = ?
		AND v.file_url IS NOT NULL
		AND v.file_url != ''
		AND v.moderation_status = 'approved'
		LIMIT 1`,
		[normalizedSlug, normalizedVersionId]
	);

	return rows[0] || null;
};

const hasInternalSecret = (req) => {
	const expectedSecret = process.env.INTERNAL_DOWNLOADS_SECRET;
	const providedSecret = getHeaderValue(req.headers["x-internal-secret"]);

	return Boolean(expectedSecret && providedSecret && providedSecret === expectedSecret);
};

const getBotCheckResult = (req) => {
	const userAgent = getHeaderValue(req.headers["user-agent"]);
	if(BOT_USER_AGENT_PATTERN.test(userAgent)) {
		return { status: 200, body: { success: true, counted: false, reason: "bot" } };
	}

	return null;
};

const countApprovedVersionDownload = async ({ req, version }) => {
	const ipAddress = getRequestIpAddress(req);
	const ipPrefix = getIpPrefix(ipAddress);
	if(!ipAddress || !ipPrefix) {
		return { status: 200, body: { success: true, counted: false, reason: "no_ip" } };
	}

	const queued = await enqueueDownload({
		version,
		ipAddress,
		ipPrefix,
		countryCode: getRequestCountryCode(req),
	});

	if(!queued.accepted) {
		return {
			status: 200,
			body: {
				success: true,
				counted: false,
				reason: "deduped",
				limit: DOWNLOAD_DEDUPE_LIMIT,
				ttlSeconds: DOWNLOAD_DEDUPE_TTL_SECONDS,
			},
		};
	}

	return {
		status: 200,
		body: {
			success: true,
			counted: true,
			totalDownloads: Number(version.project_downloads || 0) + 1,
			limit: DOWNLOAD_DEDUPE_LIMIT,
			ttlSeconds: DOWNLOAD_DEDUPE_TTL_SECONDS,
		},
	};
};

const countCdnDownload = async (req) => {
	if(!hasInternalSecret(req)) {
		return { status: 403, body: { success: false, counted: false, reason: "forbidden" } };
	}

	const originalMethod = (getHeaderValue(req.headers["x-original-method"]) || req.method || "").toUpperCase();
	if(originalMethod !== "GET") {
		return { status: 200, body: { success: true, counted: false, reason: originalMethod === "HEAD" ? "head" : "method" } };
	}

	const botCheckResult = getBotCheckResult(req);
	if(botCheckResult) {
		return botCheckResult;
	}

	if(hasTrustedDownloadPageReferer(req)) {
		return { status: 200, body: { success: true, counted: false, reason: "site_page_click" } };
	}

	const originalPath = getOriginalPath(req);
	if(!isDownloadFilePath(originalPath)) {
		return { status: 200, body: { success: true, counted: false, reason: "not_download_file" } };
	}

	const version = await findApprovedVersionByFilePath(originalPath);
	if(!version) {
		return { status: 404, body: { success: false, counted: false, reason: "version_not_found" } };
	}

	return countApprovedVersionDownload({ req, version });
};

const countProjectVersionDownload = async (req, { slug, versionId }) => {
	if(!hasTrustedDownloadPageOrigin(req)) {
		return { status: 403, body: { success: false, counted: false, reason: "untrusted_origin" } };
	}

	const botCheckResult = getBotCheckResult(req);
	if(botCheckResult) {
		return botCheckResult;
	}

	const version = await findApprovedVersionByProjectVersionId({ slug, versionId });
	if(!version) {
		return { status: 404, body: { success: false, counted: false, reason: "version_not_found" } };
	}

	return countApprovedVersionDownload({ req, version });
};

const prepareProjectVersionDownloadRedirect = async (req, { slug, versionId }) => {
	if(!hasTrustedDownloadPageOrigin(req)) {
		return { status: 403, body: { success: false, counted: false, reason: "untrusted_origin" } };
	}

	const version = await findApprovedVersionByProjectVersionId({ slug, versionId });
	if(!version) {
		return { status: 404, body: { success: false, counted: false, reason: "version_not_found" } };
	}

	const downloadUrl = getSafeDownloadUrl(version.file_url);
	if(!downloadUrl) {
		return { status: 409, body: { success: false, counted: false, reason: "unsafe_download_url" } };
	}

	if(req.method === "HEAD") {
		return { status: 302, downloadUrl, body: { success: true, counted: false, reason: "head" } };
	}

	const botCheckResult = getBotCheckResult(req);
	if(botCheckResult) {
		return { ...botCheckResult, downloadUrl };
	}

	const result = await countApprovedVersionDownload({ req, version });
	return { ...result, downloadUrl };
};

module.exports = {
	countCdnDownload,
	countProjectVersionDownload,
	prepareProjectVersionDownloadRedirect,
};