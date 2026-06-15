const crypto = require("crypto");
const express = require("express");
const fs = require("fs/promises");
const multer = require("multer");
const path = require("path");
const sharp = require("sharp");
const slugify = require("slugify");
const { db } = require("../../config/db");
const auth = require("../../middleware/auth");
const { sanitizeExternalUrl, sanitizeMarkdownText, sanitizePlainText } = require("../../utils/sanitize");
const { getSlugValidationMessage, validateSlug } = require("../../utils/slug");
const { bumpProjectCacheVersionById } = require("../../utils/projectCache");

const router = express.Router();

const DATE_FIELDS = ["starts_at", "submissions_start_at", "submissions_end_at", "voting_starts_at", "voting_end_at"];
const MUTABLE_FIELDS = ["title", "slug", "summary", "description", "rules", "external_links", "starts_at", "submissions_start_at", "submissions_end_at", "voting_starts_at", "voting_end_at"];
const PARTICIPANTS_COUNT_SELECT = `(SELECT COUNT(*) FROM mod_jam_participants mjp WHERE mjp.jam_id = mj.id)
		+ (SELECT COUNT(*) FROM mod_jam_submissions mjsp WHERE mjsp.jam_id = mj.id AND mjsp.status = 'submitted' AND NOT EXISTS (
			SELECT 1 FROM mod_jam_participants existing_mjp WHERE existing_mjp.jam_id = mjsp.jam_id AND existing_mjp.user_id = mjsp.submitter_user_id
		))`;

const generateId = () => crypto.randomBytes(6).toString("base64url");

const isModeratorRole = (role) => role === "admin" || role === "moderator";

const ensureModerator = async (req, res) => {
	const [rows] = await db.query("SELECT isRole FROM users WHERE id = ? LIMIT 1", [req.user.id]);
	const role = rows[0]?.isRole;

	if(!isModeratorRole(role)) {
		res.status(403).json({ message: "Unauthorized" });
		return false;
	}

	return true;
};

const sanitizeFilenameStem = (value) => {
	const normalized = String(value || "").replace(/[\u0000-\u001f\u007f]/g, "").replace(/%[0-9a-f]{2}/gi, "").replace(/\.+/g, ".").replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/^[_\-.]+|[_\-.]+$/g, "");
	return normalized || "file";
};

const buildSafeUploadFilename = (originalname) => {
	const parsed = path.parse(path.basename(String(originalname || "")));
	const safeBaseName = sanitizeFilenameStem(parsed.name);
	const safeExtension = sanitizeFilenameStem(parsed.ext.replace(/^\./, "")).toLowerCase();
	const uniqueSuffix = crypto.randomBytes(4).toString("hex");

	return safeExtension ? `${safeBaseName}_${uniqueSuffix}.${safeExtension}` : `${safeBaseName}_${uniqueSuffix}`;
};

const storage = multer.diskStorage({
	destination: async (req, file, cb) => {
		try {
			const destination = path.join(process.env.MEDIA_ROOT, "temp");
			await fs.mkdir(destination, { recursive: true });
			cb(null, destination);
		} catch (error) {
			cb(error);
		}
	},
	filename: (req, file, cb) => {
		cb(null, buildSafeUploadFilename(file.originalname));
	},
});

const upload = multer({
	storage,
	limits: { fileSize: 8 * 1024 * 1024 },
	fileFilter: (req, file, cb) => {
		const mimeType = (file.mimetype || "").toLowerCase();
		const ext = path.extname(path.basename(String(file.originalname || ""))).toLowerCase();
		const isAllowed = ["image/jpeg", "image/png", "image/gif", "image/webp"].includes(mimeType) || (mimeType === "application/octet-stream" && [".jpg", ".jpeg", ".png", ".gif", ".webp"].includes(ext));

		if(isAllowed) {
			cb(null, true);
			return;
		}

		cb(new Error("Invalid file type. Allowed: JPEG, PNG, GIF, WebP."), false);
	},
});

const convertImageToWebp = async (file) => {
	if(!file) {
		return file;
	}

	const mimeType = (file.mimetype || "").toLowerCase();
	if(mimeType === "image/gif") {
		return file;
	}

	if(mimeType === "image/webp") {
		return {
			...file,
			mimetype: "image/webp",
		};
	}

	const fileNameWithoutExt = path.parse(file.filename).name;
	const webpFilename = `${fileNameWithoutExt}.webp`;
	const webpPath = path.join(path.dirname(file.path), webpFilename);

	await sharp(file.path).rotate().webp({ quality: 82, effort: 4 }).toFile(webpPath);
	await fs.unlink(file.path);

	return {
		...file,
		filename: webpFilename,
		path: webpPath,
		mimetype: "image/webp",
	};
};

const rgbToInt = (r, g, b) => ((r & 255) << 16) + ((g & 255) << 8) + (b & 255);

const extractDominantColorInt = async (filePath) => {
	const { data, info } = await sharp(filePath).rotate().resize(1, 1, { fit: "cover" }).removeAlpha().raw().toBuffer({ resolveWithObject: true });

	if(!data || data.length < 3 || !info || info.channels < 3) {
		return null;
	}

	return rgbToInt(data[0], data[1], data[2]);
};

const moveJamImage = async ({ file, jamId, kind }) => {
	if(!file) {
		return null;
	}

	const image = await convertImageToWebp(file);
	const jamDir = path.join(process.env.MEDIA_ROOT, "mod-jams", jamId);
	const finalFilePath = path.join(jamDir, image.filename);

	await fs.mkdir(jamDir, { recursive: true });
	await fs.rename(image.path, finalFilePath);

	return {
		url: `https://media.modifold.com/mod-jams/${jamId}/${image.filename}`,
		filePath: finalFilePath,
	};
};

const parseJsonObject = (value) => {
	if(value === undefined || value === null || value === "") {
		return {};
	}

	if(typeof value === "object" && !Array.isArray(value)) {
		return value;
	}

	try {
		const parsed = JSON.parse(String(value));
		return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
	} catch {
		return {};
	}
};

const normalizeLinks = (value) => {
	const links = parseJsonObject(value);
	const normalized = {};

	for(const [key, url] of Object.entries(links)) {
		const safeKey = sanitizePlainText(key || "").toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 24);
		const safeUrl = sanitizeExternalUrl(url);

		if(safeKey && safeUrl) {
			normalized[safeKey] = safeUrl;
		}
	}

	return normalized;
};

const padDatePart = (value) => String(value).padStart(2, "0");
const DATETIME_STRING_PATTERN = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/;

const parseDateParts = (value) => {
	const match = String(value || "").match(DATETIME_STRING_PATTERN);
	if(!match) {
		return null;
	}

	const [, year, month, day, hour, minute, second = "00"] = match;
	const parts = {
		year: Number(year),
		month: Number(month),
		day: Number(day),
		hour: Number(hour),
		minute: Number(minute),
		second: Number(second),
	};
	const date = new Date(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);

	if(
		Number.isNaN(date.getTime()) ||
		date.getFullYear() !== parts.year ||
		date.getMonth() + 1 !== parts.month ||
		date.getDate() !== parts.day ||
		date.getHours() !== parts.hour ||
		date.getMinutes() !== parts.minute ||
		date.getSeconds() !== parts.second
	) {
		return null;
	}

	return parts;
};

const formatDateParts = (parts, separator = " ") => `${parts.year}-${padDatePart(parts.month)}-${padDatePart(parts.day)}${separator}${padDatePart(parts.hour)}:${padDatePart(parts.minute)}:${padDatePart(parts.second)}`;

const formatLocalDate = (date, separator = " ") => formatDateParts({
	year: date.getFullYear(),
	month: date.getMonth() + 1,
	day: date.getDate(),
	hour: date.getHours(),
	minute: date.getMinutes(),
	second: date.getSeconds(),
}, separator);

const parseDate = (value) => {
	if(!value) {
		return null;
	}

	const parts = parseDateParts(value);
	if(parts) {
		return new Date(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
	}

	const date = new Date(value);
	if(Number.isNaN(date.getTime())) {
		return null;
	}

	return date;
};

const toMysqlDateTime = (value) => {
	const parts = parseDateParts(value);
	if(parts) {
		return formatDateParts(parts);
	}

	const date = value instanceof Date ? value : new Date(value);
	return Number.isNaN(date.getTime()) ? null : formatLocalDate(date);
};

const formatDateForResponse = (value) => {
	if(!value) {
		return null;
	}

	const parts = parseDateParts(value);
	if(parts) {
		return formatDateParts(parts, "T");
	}

	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? null : formatLocalDate(date, "T");
};

const computeLifecycle = (jam) => {
	if(jam.status !== "approved") {
		return jam.status;
	}

	const now = Date.now();
	const startsAt = parseDate(jam.starts_at)?.getTime();
	const submissionsStartAt = parseDate(jam.submissions_start_at || jam.starts_at)?.getTime();
	const submissionsEndAt = parseDate(jam.submissions_end_at)?.getTime();
	const votingStartsAt = parseDate(jam.voting_starts_at || jam.submissions_end_at)?.getTime();
	const votingEndAt = parseDate(jam.voting_end_at)?.getTime();

	if(!Number.isFinite(startsAt) || !Number.isFinite(submissionsStartAt) || !Number.isFinite(submissionsEndAt) || !Number.isFinite(votingStartsAt) || !Number.isFinite(votingEndAt)) {
		return "draft";
	}

	if(now < startsAt) {
		return "upcoming";
	}

	if(now < submissionsStartAt) {
		return "running";
	}

	if(now <= submissionsEndAt) {
		return "submissions_open";
	}

	if(now < votingStartsAt) {
		return "voting_pending";
	}

	if(now <= votingEndAt) {
		return "voting_open";
	}

	return "completed";
};

const formatJam = (jam) => {
	const links = parseJsonObject(jam.external_links);
	return {
		id: jam.id,
		slug: jam.slug,
		title: jam.title,
		summary: jam.summary,
		description: jam.description || "",
		rules: jam.rules || "",
		avatar_url: jam.avatar_url || "https://media.modifold.com/static/no-project-icon.svg",
		cover_url: jam.cover_url || null,
		color: jam.color === null || jam.color === undefined ? null : Number(jam.color),
		external_links: links,
		status: jam.status,
		lifecycle: computeLifecycle(jam),
		starts_at: formatDateForResponse(jam.starts_at),
		submissions_start_at: formatDateForResponse(jam.submissions_start_at || jam.starts_at),
		submissions_end_at: formatDateForResponse(jam.submissions_end_at),
		voting_starts_at: formatDateForResponse(jam.voting_starts_at || jam.submissions_end_at),
		voting_end_at: formatDateForResponse(jam.voting_end_at),
		vote_limit: Number(jam.vote_limit) || 1,
		created_at: formatDateForResponse(jam.created_at),
		updated_at: formatDateForResponse(jam.updated_at),
		rejection_reason: jam.rejection_reason || null,
		participants_count: Number(jam.participants_count) || 0,
		user_joined: Boolean(jam.user_joined),
		owner: jam.owner_slug ? {
			id: jam.owner_user_id,
			username: jam.owner_username,
			slug: jam.owner_slug,
			avatar: jam.owner_avatar,
			isVerified: jam.owner_isVerified,
		} : null,
		submissions_count: Number(jam.submissions_count) || 0,
		votes_count: Number(jam.votes_count) || 0,
	};
};

const getJamBySlug = async (slug) => {
	const [rows] = await db.query(
		`SELECT mj.*, u.username AS owner_username, u.slug AS owner_slug, u.avatar AS owner_avatar, u.isVerified AS owner_isVerified,
		(SELECT COUNT(*) FROM mod_jam_submissions mjs WHERE mjs.jam_id = mj.id AND mjs.status = 'submitted') AS submissions_count,
		${PARTICIPANTS_COUNT_SELECT} AS participants_count,
		(SELECT COALESCE(SUM(COALESCE(mjv.vote_weight, 1)), 0) FROM mod_jam_votes mjv WHERE mjv.jam_id = mj.id) AS votes_count
		FROM mod_jams mj
		LEFT JOIN users u ON u.id = mj.owner_user_id
		WHERE mj.slug = ?
		LIMIT 1`,
		[slug]
	);

	return rows[0] || null;
};

const hasUserJoinedJam = async (jamId, userId) => {
	if(!userId) {
		return false;
	}

	const [[row]] = await db.query(
		`SELECT EXISTS(SELECT 1 FROM mod_jam_participants WHERE jam_id = ? AND user_id = ?) OR EXISTS(SELECT 1 FROM mod_jam_submissions WHERE jam_id = ? AND submitter_user_id = ? AND status = 'submitted') AS is_joined`,
		[jamId, userId, jamId, userId]
	);

	return Boolean(row?.is_joined);
};

const getParticipantsCount = async (jamId) => {
	const [[row]] = await db.query(
		`SELECT
		(SELECT COUNT(*) FROM mod_jam_participants WHERE jam_id = ?)
		+ (SELECT COUNT(*) FROM mod_jam_submissions mjs WHERE mjs.jam_id = ? AND mjs.status = 'submitted' AND NOT EXISTS (
			SELECT 1 FROM mod_jam_participants mjp WHERE mjp.jam_id = mjs.jam_id AND mjp.user_id = mjs.submitter_user_id
		)) AS participants_count`,
		[jamId, jamId]
	);

	return Number(row?.participants_count) || 0;
};

const getJamJury = async (jamId) => {
	const [rows] = await db.query(
		`SELECT mjj.id, mjj.user_id, mjj.created_at, u.username, u.slug, u.avatar, u.isVerified
		FROM mod_jam_jury mjj
		LEFT JOIN users u ON u.id = mjj.user_id
		WHERE mjj.jam_id = ?
		ORDER BY mjj.created_at ASC`,
		[jamId]
	);

	return rows.map((row) => ({
		id: row.id,
		user_id: row.user_id,
		created_at: formatDateForResponse(row.created_at),
		user: {
			id: row.user_id,
			username: row.username,
			slug: row.slug,
			avatar: row.avatar,
			isVerified: row.isVerified,
		},
	}));
};

const getJamNominations = async (jamId) => {
	const [rows] = await db.query(
		`SELECT id, jam_id, title, description, sort_order, created_at, updated_at
		FROM mod_jam_nominations
		WHERE jam_id = ?
		ORDER BY sort_order ASC, created_at ASC`,
		[jamId]
	);

	return rows.map((row) => ({
		id: row.id,
		jam_id: row.jam_id,
		title: row.title,
		description: row.description || "",
		sort_order: Number(row.sort_order) || 0,
		created_at: formatDateForResponse(row.created_at),
		updated_at: formatDateForResponse(row.updated_at),
	}));
};

const requireJamOwner = (req, res, jam) => {
	if(!jam) {
		res.status(404).json({ message: "Mod jam not found" });
		return false;
	}

	if(Number(jam.owner_user_id) !== Number(req.user.id) && !isModeratorRole(req.user.isRole)) {
		res.status(403).json({ message: "Unauthorized" });
		return false;
	}

	return true;
};

const findProjectForSubmission = async ({ projectSlug, projectId, userId }) => {
	const params = [userId];
	let lookupClause = "p.slug = ?";
	let lookupValue = projectSlug;

	if(projectId) {
		lookupClause = "p.id = ?";
		lookupValue = projectId;
	}

	const [rows] = await db.query(
		`SELECT p.id, p.slug, p.title, p.summary, p.icon_url, p.status, p.project_type, p.user_id
		FROM projects p
		LEFT JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = ? AND pm.status IN ('accept','accepted')
		WHERE ${lookupClause}
		AND p.project_type = 'mod'
		AND p.status = 'approved'
		AND (p.user_id = ? OR pm.user_id IS NOT NULL)
		LIMIT 1`,
		[...params, lookupValue, userId]
	);

	return rows[0] || null;
};

const getSubmissions = async ({ jamId, userId, resultsOnly = false }) => {
	const [rows] = await db.query(
		`SELECT mjs.id, mjs.jam_id, mjs.project_id, mjs.submitter_user_id, mjs.status, mjs.created_at,
		p.slug AS project_slug, p.title AS project_title, p.summary AS project_summary, p.icon_url AS project_icon_url,
		p.downloads AS project_downloads, p.followers AS project_followers, p.updated_at AS project_updated_at, p.tags AS project_tags,
		p.color AS project_color,
		u.username AS submitter_username, u.slug AS submitter_slug, u.avatar AS submitter_avatar, u.isVerified AS submitter_isVerified,
		COALESCE(SUM(COALESCE(mjv.vote_weight, 1)), 0) AS votes_count,
		(SELECT user_vote.submission_id FROM mod_jam_votes user_vote WHERE user_vote.jam_id = mjs.jam_id AND user_vote.user_id = ? AND COALESCE(user_vote.nomination_id, 0) = 0 LIMIT 1) AS user_voted_submission_id
		FROM mod_jam_submissions mjs
		LEFT JOIN projects p ON p.id = mjs.project_id
		LEFT JOIN users u ON u.id = mjs.submitter_user_id
		LEFT JOIN mod_jam_votes mjv ON mjv.submission_id = mjs.id
		WHERE mjs.jam_id = ? AND mjs.status = 'submitted'
		GROUP BY mjs.id
		ORDER BY ${resultsOnly ? "votes_count DESC, mjs.created_at ASC" : "mjs.created_at ASC"}`,
		[userId || null, jamId]
	);
	const userVotesBySubmissionId = new Map();
	const nominationScoresBySubmissionId = new Map();

	const [nominationVoteRows] = await db.query(
		`SELECT submission_id, COALESCE(nomination_id, 0) AS nomination_id, COALESCE(SUM(COALESCE(vote_weight, 1)), 0) AS votes_count
		FROM mod_jam_votes
		WHERE jam_id = ?
		GROUP BY submission_id, COALESCE(nomination_id, 0)`,
		[jamId]
	);

	for(const vote of nominationVoteRows) {
		const submissionId = Number(vote.submission_id);
		const nominationId = Number(vote.nomination_id) || 0;
		const scores = nominationScoresBySubmissionId.get(submissionId) || {};
		scores[nominationId] = Number(vote.votes_count) || 0;
		nominationScoresBySubmissionId.set(submissionId, scores);
	}

	if(userId) {
		const [userVoteRows] = await db.query(
			"SELECT submission_id, COALESCE(nomination_id, 0) AS nomination_id FROM mod_jam_votes WHERE jam_id = ? AND user_id = ?",
			[jamId, userId]
		);

		for(const vote of userVoteRows) {
			const submissionId = Number(vote.submission_id);
			const nominationId = Number(vote.nomination_id) || 0;
			const currentVotes = userVotesBySubmissionId.get(submissionId) || [];
			currentVotes.push({ nomination_id: nominationId });
			userVotesBySubmissionId.set(submissionId, currentVotes);
		}
	}

	return rows.map((row) => ({
		id: row.id,
		project_id: row.project_id,
		project: {
			id: row.project_id,
			slug: row.project_slug,
			title: row.project_title,
			summary: row.project_summary,
			icon_url: row.project_icon_url || "https://media.modifold.com/static/no-project-icon.svg",
			downloads: Number(row.project_downloads) || 0,
			followers: Number(row.project_followers) || Number(row.votes_count) || 0,
			updated_at: formatDateForResponse(row.project_updated_at),
			tags: row.project_tags ? String(row.project_tags).split(",").map((tag) => tag.trim()).filter(Boolean) : [],
			color: row.project_color,
		},
		submitter: {
			id: row.submitter_user_id,
			username: row.submitter_username,
			slug: row.submitter_slug,
			avatar: row.submitter_avatar,
			isVerified: row.submitter_isVerified,
		},
		votes_count: Number(row.votes_count) || 0,
		nomination_votes: nominationScoresBySubmissionId.get(Number(row.id)) || {},
		user_voted_submission_id: row.user_voted_submission_id || null,
		user_votes: userVotesBySubmissionId.get(Number(row.id)) || [],
		user_voted_this_submission: Boolean(userVotesBySubmissionId.has(Number(row.id)) || (row.user_voted_submission_id && Number(row.user_voted_submission_id) === Number(row.id))),
		has_user_vote_in_jam: Boolean(userId && userVotesBySubmissionId.size > 0),
		created_at: formatDateForResponse(row.created_at),
	}));
};

const getUserBySlug = async (slug) => {
	const normalizedSlug = sanitizePlainText(slug || "").trim().toLowerCase();
	if(!normalizedSlug) {
		return null;
	}

	const [rows] = await db.query(
		"SELECT id, username, slug, avatar, isVerified FROM users WHERE slug = ? LIMIT 1",
		[normalizedSlug]
	);

	return rows[0] || null;
};

const buildJamPayload = async ({ body, files, existingJam = null, jamId }) => {
	const updates = {};

	if(body.title !== undefined) {
		updates.title = sanitizePlainText(body.title);
	}

	if(body.slug !== undefined) {
		const validation = validateSlug(body.slug, { minLength: 4, maxLength: 80 });
		if(!validation.valid) {
			const error = new Error(getSlugValidationMessage(validation.reason));
			error.statusCode = 400;
			throw error;
		}
		updates.slug = validation.normalized;
	} else if(!existingJam && body.title) {
		updates.slug = slugify(sanitizePlainText(body.title), { replacement: "-", lower: true, strict: true, remove: /[^a-zA-Z0-9\s]/g }).slice(0, 80);
	}

	if(body.summary !== undefined) {
		updates.summary = sanitizePlainText(body.summary);
	}

	if(body.description !== undefined) {
		updates.description = sanitizeMarkdownText(body.description || "");
	}

	if(body.rules !== undefined) {
		updates.rules = sanitizeMarkdownText(body.rules || "");
	}

	if(body.external_links !== undefined) {
		updates.external_links = JSON.stringify(normalizeLinks(body.external_links));
	}

	for(const field of DATE_FIELDS) {
		if(body[field] !== undefined) {
			const date = parseDate(body[field]);
			if(!date) {
				const error = new Error(`Invalid ${field}`);
				error.statusCode = 400;
				throw error;
			}
			updates[field] = toMysqlDateTime(body[field]);
		}
	}

	if(body.vote_limit !== undefined) {
		const voteLimit = Number(body.vote_limit);
		if(!Number.isInteger(voteLimit) || voteLimit < 1 || voteLimit > 20) {
			const error = new Error("vote_limit must be an integer from 1 to 20");
			error.statusCode = 400;
			throw error;
		}
		updates.vote_limit = voteLimit;
	}

	if(files?.avatar?.[0]) {
		const avatarImage = await moveJamImage({ file: files.avatar[0], jamId, kind: "avatar" });
		updates.avatar_url = avatarImage.url;
		updates.color = await extractDominantColorInt(avatarImage.filePath);
	}

	if(files?.cover?.[0]) {
		const coverImage = await moveJamImage({ file: files.cover[0], jamId, kind: "cover" });
		updates.cover_url = coverImage.url;
	}

	return updates;
};

const validateJamReadyForReview = (jam) => {
	if(!jam.title || !jam.slug || !jam.summary || !jam.description || !jam.rules) {
		return "Mod jam requires title, slug, summary, description and rules";
	}

	if(String(jam.summary).length < 30 || String(jam.summary).length > 280) {
		return "Summary must be 30-280 characters";
	}

	const startsAt = parseDate(jam.starts_at);
	const submissionsStartAt = parseDate(jam.submissions_start_at || jam.starts_at);
	const submissionsEndAt = parseDate(jam.submissions_end_at);
	const votingStartsAt = parseDate(jam.voting_starts_at);
	const votingEndAt = parseDate(jam.voting_end_at);

	if(!startsAt || !submissionsStartAt || !submissionsEndAt || !votingStartsAt || !votingEndAt) {
		return "Dates are required";
	}

	if(startsAt > submissionsStartAt) {
		return "Submissions must open after mod jam starts";
	}

	if(submissionsStartAt >= submissionsEndAt) {
		return "Submissions open date must be before submissions deadline";
	}

	if(submissionsEndAt > votingStartsAt) {
		return "Community voting must open after submissions close";
	}

	if(votingStartsAt > votingEndAt) {
		return "Winners announcement must be after community voting opens";
	}

	return null;
};

const validateJamDraftFields = (jam) => {
	if(!jam.title || !jam.slug || !jam.summary) {
		return "Mod jam requires title, slug and summary";
	}

	if(String(jam.summary).length < 30 || String(jam.summary).length > 280) {
		return "Summary must be 30-280 characters";
	}

	const startsAt = parseDate(jam.starts_at);
	const submissionsStartAt = parseDate(jam.submissions_start_at || jam.starts_at);
	const submissionsEndAt = parseDate(jam.submissions_end_at);
	const votingStartsAt = parseDate(jam.voting_starts_at);
	const votingEndAt = parseDate(jam.voting_end_at);

	if(startsAt && submissionsStartAt && startsAt > submissionsStartAt) {
		return "Submissions must open after mod jam starts";
	}

	if(submissionsStartAt && submissionsEndAt && submissionsStartAt >= submissionsEndAt) {
		return "Submissions open date must be before submissions deadline";
	}

	if(submissionsEndAt && votingStartsAt && submissionsEndAt > votingStartsAt) {
		return "Community voting must open after submissions close";
	}

	if(votingStartsAt && votingEndAt && votingStartsAt > votingEndAt) {
		return "Winners announcement must be after community voting opens";
	}

	return null;
};

const getDefaultJamDates = () => {
	const now = Date.now();

	return {
		starts_at: toMysqlDateTime(new Date(now + 24 * 60 * 60 * 1000)),
		submissions_start_at: toMysqlDateTime(new Date(now + 7 * 24 * 60 * 60 * 1000)),
		submissions_end_at: toMysqlDateTime(new Date(now + 14 * 24 * 60 * 60 * 1000)),
		voting_starts_at: toMysqlDateTime(new Date(now + 14 * 24 * 60 * 60 * 1000)),
		voting_end_at: toMysqlDateTime(new Date(now + 21 * 24 * 60 * 60 * 1000)),
	};
};

router.get("/moderation", auth, async (req, res) => {
	if(!(await ensureModerator(req, res))) {
		return;
	}

	try {
		const [rows] = await db.query(
			`SELECT mj.*, u.username AS owner_username, u.slug AS owner_slug, u.avatar AS owner_avatar, u.isVerified AS owner_isVerified
			FROM mod_jams mj
			LEFT JOIN users u ON u.id = mj.owner_user_id
			WHERE mj.status = 'pending_review'
			ORDER BY mj.updated_at ASC`
		);

		res.json({ mod_jams: rows.map(formatJam) });
	} catch (error) {
		console.error("Error fetching mod jams for moderation:", error);
		res.status(500).json({ message: "Error fetching mod jams", error: error.message });
	}
});

router.get("/mine", auth, async (req, res) => {
	try {
		const [rows] = await db.query(
			`SELECT mj.*, u.username AS owner_username, u.slug AS owner_slug, u.avatar AS owner_avatar, u.isVerified AS owner_isVerified,
			(SELECT COUNT(*) FROM mod_jam_submissions mjs WHERE mjs.jam_id = mj.id AND mjs.status = 'submitted') AS submissions_count,
			${PARTICIPANTS_COUNT_SELECT} AS participants_count,
			(SELECT COALESCE(SUM(COALESCE(mjv.vote_weight, 1)), 0) FROM mod_jam_votes mjv WHERE mjv.jam_id = mj.id) AS votes_count
			FROM mod_jams mj
			LEFT JOIN users u ON u.id = mj.owner_user_id
			WHERE mj.owner_user_id = ?
			ORDER BY mj.updated_at DESC`,
			[req.user.id]
		);

		res.json({ mod_jams: rows.map(formatJam) });
	} catch (error) {
		console.error("Error fetching user mod jams:", error);
		res.status(500).json({ message: "Error fetching user mod jams", error: error.message });
	}
});

router.get("/", async (req, res) => {
	try {
		const { status = "active", page = 1, limit = 20, search = "" } = req.query;

		if(isNaN(page) || page < 1 || isNaN(limit) || limit < 1) {
			return res.status(400).json({ message: "Invalid pagination" });
		}

		const offset = (Number(page) - 1) * Number(limit);
		const params = [];
		const countParams = [];
		let whereClause = "WHERE mj.status = 'approved'";

		if(status === "active") {
			whereClause += " AND mj.voting_end_at >= NOW()";
		} else if(status === "completed") {
			whereClause += " AND mj.voting_end_at < NOW()";
		} else {
			return res.status(400).json({ message: "Invalid status filter" });
		}

		if(search) {
			whereClause += " AND mj.title LIKE ?";
			params.push(`%${search}%`);
			countParams.push(`%${search}%`);
		}

		const [rows] = await db.query(
			`SELECT mj.*, u.username AS owner_username, u.slug AS owner_slug, u.avatar AS owner_avatar, u.isVerified AS owner_isVerified,
			(SELECT COUNT(*) FROM mod_jam_submissions mjs WHERE mjs.jam_id = mj.id AND mjs.status = 'submitted') AS submissions_count,
			${PARTICIPANTS_COUNT_SELECT} AS participants_count,
			(SELECT COALESCE(SUM(COALESCE(mjv.vote_weight, 1)), 0) FROM mod_jam_votes mjv WHERE mjv.jam_id = mj.id) AS votes_count
			FROM mod_jams mj
			LEFT JOIN users u ON u.id = mj.owner_user_id
			${whereClause}
			ORDER BY mj.starts_at DESC
			LIMIT ? OFFSET ?`,
			[...params, Number(limit), Number(offset)]
		);

		const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total FROM mod_jams mj ${whereClause}`, countParams);

		res.json({
			mod_jams: rows.map(formatJam),
			totalPages: Math.ceil(total / Number(limit)),
			currentPage: Number(page),
		});
	} catch (error) {
		console.error("Error fetching mod jams:", error);
		res.status(500).json({ message: "Error fetching mod jams", error: error.message });
	}
});

router.post("/", auth, upload.fields([{ name: "avatar", maxCount: 1 }, { name: "cover", maxCount: 1 }]), async (req, res) => {
	const jamId = generateId();

	try {
		const payload = await buildJamPayload({ body: req.body, files: req.files, jamId });

		if(!payload.slug && payload.title) {
			const validation = validateSlug(slugify(payload.title, { replacement: "-", lower: true, strict: true, remove: /[^a-zA-Z0-9\s]/g }).slice(0, 80), { minLength: 4, maxLength: 80 });
			if(validation.valid) {
				payload.slug = validation.normalized;
			}
		}

		if(!payload.slug) {
			return res.status(400).json({ message: "Slug is required" });
		}

		const [existing] = await db.query("SELECT id FROM mod_jams WHERE slug = ? LIMIT 1", [payload.slug]);
		if(existing.length) {
			return res.status(400).json({ message: "Slug is already taken" });
		}

		const defaultDates = getDefaultJamDates();
		const jam = {
			id: jamId,
			owner_user_id: req.user.id,
			title: payload.title,
			slug: payload.slug,
			summary: payload.summary,
			description: payload.description || "",
			rules: payload.rules || "",
			avatar_url: payload.avatar_url || "https://media.modifold.com/static/no-project-icon.svg",
			cover_url: payload.cover_url || null,
			color: payload.color === undefined ? null : payload.color,
			external_links: payload.external_links || "{}",
			starts_at: payload.starts_at || defaultDates.starts_at,
			submissions_start_at: payload.submissions_start_at || defaultDates.submissions_start_at,
			submissions_end_at: payload.submissions_end_at || defaultDates.submissions_end_at,
			voting_starts_at: payload.voting_starts_at || defaultDates.voting_starts_at,
			voting_end_at: payload.voting_end_at || defaultDates.voting_end_at,
			vote_limit: payload.vote_limit || 1,
		};

		const validationError = validateJamDraftFields(jam);
		if(validationError) {
			return res.status(400).json({ message: validationError });
		}

		await db.query("INSERT INTO mod_jams SET ?", [jam]);

		res.json({ success: true, mod_jam: formatJam({ ...jam, status: "draft", created_at: new Date(), updated_at: new Date() }) });
	} catch (error) {
		console.error("Error creating mod jam:", error);
		res.status(error.statusCode || 500).json({ message: error.message || "Error creating mod jam" });
	}
});

router.get("/:slug", async (req, res) => {
	try {
		const jam = await getJamBySlug(req.params.slug);
		if(!jam) {
			return res.status(404).json({ message: "Mod jam not found" });
		}

		const canViewDraft = req.user && (Number(req.user.id) === Number(jam.owner_user_id) || isModeratorRole(req.user.isRole));
		if(jam.status !== "approved" && !canViewDraft) {
			return res.status(404).json({ message: "Mod jam not found" });
		}

		const submissions = await getSubmissions({ jamId: jam.id, userId: req.user?.id, resultsOnly: computeLifecycle(jam) === "completed" });
		const jury = await getJamJury(jam.id);
		const nominations = await getJamNominations(jam.id);
		const lifecycle = computeLifecycle(jam);
		const userJoined = await hasUserJoinedJam(jam.id, req.user?.id);

		res.json({
			mod_jam: formatJam({ ...jam, user_joined: userJoined }),
			submissions,
			jury,
			nominations,
			permissions: {
				can_edit: Boolean(canViewDraft),
				can_join: Boolean(req.user && lifecycle === "running" && !userJoined),
				can_submit: Boolean(req.user && lifecycle === "submissions_open"),
				can_vote: Boolean(req.user && lifecycle === "voting_open"),
			},
		});
	} catch (error) {
		console.error("Error fetching mod jam:", error);
		res.status(500).json({ message: "Error fetching mod jam", error: error.message });
	}
});

router.post("/:slug/nominations", auth, async (req, res) => {
	try {
		const jam = await getJamBySlug(req.params.slug);
		if(!requireJamOwner(req, res, jam)) {
			return;
		}

		const title = sanitizePlainText(req.body.title || "").trim();
		const description = sanitizePlainText(req.body.description || "", { preserveNewlines: true }).trim();

		if(title.length < 3 || title.length > 80) {
			return res.status(400).json({ message: "Nomination title must be 3-80 characters" });
		}

		if(description.length > 280) {
			return res.status(400).json({ message: "Nomination description must be less than 280 characters" });
		}

		const [[{ next_order: nextOrder }]] = await db.query(
			"SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_order FROM mod_jam_nominations WHERE jam_id = ?",
			[jam.id]
		);

		await db.query(
			"INSERT INTO mod_jam_nominations (jam_id, title, description, sort_order) VALUES (?, ?, ?, ?)",
			[jam.id, title, description || null, Number(nextOrder) || 1]
		);

		const nominations = await getJamNominations(jam.id);
		res.json({ success: true, nominations });
	} catch (error) {
		if(error?.code === "ER_DUP_ENTRY") {
			return res.status(400).json({ message: "Nomination already exists" });
		}

		console.error("Error adding mod jam nomination:", error);
		res.status(500).json({ message: "Error adding nomination", error: error.message });
	}
});

router.put("/:slug/nominations/:nominationId", auth, async (req, res) => {
	try {
		const jam = await getJamBySlug(req.params.slug);
		if(!requireJamOwner(req, res, jam)) {
			return;
		}

		const title = sanitizePlainText(req.body.title || "").trim();
		const description = sanitizePlainText(req.body.description || "", { preserveNewlines: true }).trim();

		if(title.length < 3 || title.length > 80) {
			return res.status(400).json({ message: "Nomination title must be 3-80 characters" });
		}

		if(description.length > 280) {
			return res.status(400).json({ message: "Nomination description must be less than 280 characters" });
		}

		const [result] = await db.query(
			"UPDATE mod_jam_nominations SET title = ?, description = ? WHERE id = ? AND jam_id = ?",
			[title, description || null, req.params.nominationId, jam.id]
		);

		if(result.affectedRows === 0) {
			return res.status(404).json({ message: "Nomination not found" });
		}

		const nominations = await getJamNominations(jam.id);
		res.json({ success: true, nominations });
	} catch (error) {
		if(error?.code === "ER_DUP_ENTRY") {
			return res.status(400).json({ message: "Nomination already exists" });
		}

		console.error("Error updating mod jam nomination:", error);
		res.status(500).json({ message: "Error updating nomination", error: error.message });
	}
});

router.delete("/:slug/nominations/:nominationId", auth, async (req, res) => {
	try {
		const jam = await getJamBySlug(req.params.slug);
		if(!requireJamOwner(req, res, jam)) {
			return;
		}

		const [voteRows] = await db.query(
			"SELECT id FROM mod_jam_votes WHERE jam_id = ? AND nomination_id = ? LIMIT 1",
			[jam.id, req.params.nominationId]
		);
		if(voteRows.length > 0) {
			return res.status(400).json({ message: "Nomination already has votes" });
		}

		await db.query(
			"DELETE FROM mod_jam_nominations WHERE id = ? AND jam_id = ?",
			[req.params.nominationId, jam.id]
		);

		const nominations = await getJamNominations(jam.id);
		res.json({ success: true, nominations });
	} catch (error) {
		console.error("Error deleting mod jam nomination:", error);
		res.status(500).json({ message: "Error deleting nomination", error: error.message });
	}
});

router.post("/:slug/jury", auth, async (req, res) => {
	try {
		const jam = await getJamBySlug(req.params.slug);
		if(!requireJamOwner(req, res, jam)) {
			return;
		}

		const user = await getUserBySlug(req.body.user_slug);
		if(!user) {
			return res.status(404).json({ message: "User not found" });
		}

		if(Number(user.id) === Number(jam.owner_user_id)) {
			return res.status(400).json({ message: "Organizer is already shown on the jury panel" });
		}

		await db.query(
			"INSERT INTO mod_jam_jury (jam_id, user_id, created_by) VALUES (?, ?, ?)",
			[jam.id, user.id, req.user.id]
		);

		const jury = await getJamJury(jam.id);
		res.json({ success: true, jury });
	} catch (error) {
		if(error?.code === "ER_DUP_ENTRY") {
			return res.status(400).json({ message: "User is already a jury member" });
		}

		console.error("Error adding mod jam jury member:", error);
		res.status(500).json({ message: "Error adding jury member", error: error.message });
	}
});

router.delete("/:slug/jury/:userId", auth, async (req, res) => {
	try {
		const jam = await getJamBySlug(req.params.slug);
		if(!requireJamOwner(req, res, jam)) {
			return;
		}

		await db.query(
			"DELETE FROM mod_jam_jury WHERE jam_id = ? AND user_id = ?",
			[jam.id, req.params.userId]
		);

		const jury = await getJamJury(jam.id);
		res.json({ success: true, jury });
	} catch (error) {
		console.error("Error removing mod jam jury member:", error);
		res.status(500).json({ message: "Error removing jury member", error: error.message });
	}
});

router.put("/:slug", auth, upload.fields([{ name: "avatar", maxCount: 1 }, { name: "cover", maxCount: 1 }]), async (req, res) => {
	try {
		const jam = await getJamBySlug(req.params.slug);
		if(!requireJamOwner(req, res, jam)) {
			return;
		}

		const payload = await buildJamPayload({ body: req.body, files: req.files, existingJam: jam, jamId: jam.id });
		if(Object.keys(payload).length === 0) {
			return res.status(400).json({ message: "No data to update" });
		}

		if(payload.slug && payload.slug !== jam.slug) {
			const [existing] = await db.query("SELECT id FROM mod_jams WHERE slug = ? AND id != ? LIMIT 1", [payload.slug, jam.id]);
			if(existing.length) {
				return res.status(400).json({ message: "Slug is already taken" });
			}
		}

		const nextJam = { ...jam, ...payload };
		const validationError = validateJamDraftFields(nextJam);
		if(validationError) {
			return res.status(400).json({ message: validationError });
		}

		await db.query("UPDATE mod_jams SET ? WHERE id = ?", [payload, jam.id]);
		await db.query(
			"INSERT INTO mod_jam_moderation_logs (jam_id, action, moderator_id, reason) VALUES (?, 'edited', NULL, NULL)",
			[jam.id]
		);

		const updated = await getJamBySlug(payload.slug || jam.slug);
		res.json({ success: true, mod_jam: formatJam(updated) });
	} catch (error) {
		console.error("Error updating mod jam:", error);
		res.status(error.statusCode || 500).json({ message: error.message || "Error updating mod jam" });
	}
});

router.post("/:slug/submit-review", auth, async (req, res) => {
	try {
		const jam = await getJamBySlug(req.params.slug);
		if(!requireJamOwner(req, res, jam)) {
			return;
		}

		const validationError = validateJamReadyForReview(jam);
		if(validationError) {
			return res.status(400).json({ message: validationError });
		}

		await db.query("UPDATE mod_jams SET status = 'pending_review', rejection_reason = NULL WHERE id = ?", [jam.id]);
		await db.query(
			"INSERT INTO mod_jam_moderation_logs (jam_id, action, moderator_id, reason) VALUES (?, 'submitted', NULL, NULL)",
			[jam.id]
		);

		res.json({ success: true });
	} catch (error) {
		console.error("Error submitting mod jam:", error);
		res.status(500).json({ message: "Error submitting mod jam", error: error.message });
	}
});

router.post("/:id/moderate", auth, async (req, res) => {
	if(!(await ensureModerator(req, res))) {
		return;
	}

	const { status, reason } = req.body;
	if(!["approved", "rejected"].includes(status)) {
		return res.status(400).json({ message: "Invalid status" });
	}

	try {
		const [rows] = await db.query("SELECT id FROM mod_jams WHERE id = ? LIMIT 1", [req.params.id]);
		if(!rows.length) {
			return res.status(404).json({ message: "Mod jam not found" });
		}

		await db.query(
			"UPDATE mod_jams SET status = ?, rejection_reason = ?, reviewed_by = ?, reviewed_at = NOW() WHERE id = ?",
			[status, status === "rejected" ? sanitizePlainText(reason || "", { preserveNewlines: true }) : null, req.user.id, req.params.id]
		);
		await db.query(
			"INSERT INTO mod_jam_moderation_logs (jam_id, action, moderator_id, reason) VALUES (?, ?, ?, ?)",
			[req.params.id, status, req.user.id, reason ? sanitizePlainText(reason, { preserveNewlines: true }) : null]
		);

		res.json({ success: true });
	} catch (error) {
		console.error("Error moderating mod jam:", error);
		res.status(500).json({ message: "Error moderating mod jam", error: error.message });
	}
});

router.post("/:slug/participants", auth, async (req, res) => {
	try {
		const jam = await getJamBySlug(req.params.slug);
		if(!jam || jam.status !== "approved") {
			return res.status(404).json({ message: "Mod jam not found" });
		}

		if(computeLifecycle(jam) !== "running") {
			return res.status(400).json({ message: "Joining is closed" });
		}

		await db.query(
			"INSERT IGNORE INTO mod_jam_participants (jam_id, user_id) VALUES (?, ?)",
			[jam.id, req.user.id]
		);

		const participantsCount = await getParticipantsCount(jam.id);

		res.json({ success: true, user_joined: true, participants_count: participantsCount });
	} catch (error) {
		console.error("Error joining mod jam:", error);
		res.status(500).json({ message: "Error joining mod jam", error: error.message });
	}
});

router.post("/:slug/submissions", auth, async (req, res) => {
	try {
		const jam = await getJamBySlug(req.params.slug);
		if(!jam || jam.status !== "approved") {
			return res.status(404).json({ message: "Mod jam not found" });
		}

		if(computeLifecycle(jam) !== "submissions_open") {
			return res.status(400).json({ message: "Submissions are closed" });
		}

		const project = await findProjectForSubmission({
			projectSlug: req.body.project_slug,
			projectId: req.body.project_id,
			userId: req.user.id,
		});

		if(!project) {
			return res.status(400).json({ message: "Approved mod owned by you is required" });
		}

		const [existingSubmissionRows] = await db.query(
			"SELECT id FROM mod_jam_submissions WHERE jam_id = ? AND submitter_user_id = ? AND status = 'submitted' LIMIT 1",
			[jam.id, req.user.id]
		);
		if(existingSubmissionRows.length > 0) {
			return res.status(400).json({ message: "You already submitted a project to this mod jam" });
		}

		await db.query(
			"INSERT INTO mod_jam_submissions (jam_id, project_id, submitter_user_id, status) VALUES (?, ?, ?, 'submitted')",
			[jam.id, project.id, req.user.id]
		);
		await db.query(
			"INSERT IGNORE INTO mod_jam_participants (jam_id, user_id) VALUES (?, ?)",
			[jam.id, req.user.id]
		);

		res.json({ success: true });
	} catch (error) {
		console.error("Error submitting project to mod jam:", error);
		res.status(500).json({ message: "Error submitting project", error: error.message });
	}
});

router.delete("/:slug/submissions/me", auth, async (req, res) => {
	try {
		const jam = await getJamBySlug(req.params.slug);
		if(!jam) {
			return res.status(404).json({ message: "Mod jam not found" });
		}

		if(computeLifecycle(jam) !== "submissions_open") {
			return res.status(400).json({ message: "Submissions are closed" });
		}

		await db.query(
			"UPDATE mod_jam_submissions SET status = 'withdrawn', updated_at = NOW() WHERE jam_id = ? AND submitter_user_id = ?",
			[jam.id, req.user.id]
		);

		res.json({ success: true });
	} catch (error) {
		console.error("Error withdrawing mod jam submission:", error);
		res.status(500).json({ message: "Error withdrawing submission", error: error.message });
	}
});

router.post("/:slug/votes", auth, async (req, res) => {
	try {
		const jam = await getJamBySlug(req.params.slug);
		if(!jam || jam.status !== "approved") {
			return res.status(404).json({ message: "Mod jam not found" });
		}

		if(computeLifecycle(jam) !== "voting_open") {
			return res.status(400).json({ message: "Voting is closed" });
		}

		const submissionId = Number(req.body.submission_id);
		if(!Number.isInteger(submissionId)) {
			return res.status(400).json({ message: "submission_id is required" });
		}

		const [submissionRows] = await db.query(
			"SELECT id, project_id, submitter_user_id FROM mod_jam_submissions WHERE id = ? AND jam_id = ? AND status = 'submitted' LIMIT 1",
			[submissionId, jam.id]
		);
		const submission = submissionRows[0];
		if(!submission) {
			return res.status(404).json({ message: "Submission not found" });
		}

		if(Number(submission.submitter_user_id) === Number(req.user.id)) {
			return res.status(400).json({ message: "You cannot vote for your own submission" });
		}

		const nominations = await getJamNominations(jam.id);
		let nominationId = 0;

		if(nominations.length > 0) {
			nominationId = Number(req.body.nomination_id);
			if(!Number.isInteger(nominationId) || !nominations.some((nomination) => Number(nomination.id) === nominationId)) {
				return res.status(400).json({ message: "Valid nomination_id is required" });
			}
		}

		const [existingVotes] = await db.query(
			"SELECT submission_id FROM mod_jam_votes WHERE jam_id = ? AND user_id = ? AND COALESCE(nomination_id, 0) = ? LIMIT 1",
			[jam.id, req.user.id, nominationId]
		);

		if(existingVotes.length) {
			return res.status(400).json({ message: nominations.length > 0 ? "You already voted in this nomination" : "You already voted in this mod jam" });
		}

		const [juryRows] = await db.query(
			"SELECT user_id FROM mod_jam_jury WHERE jam_id = ? AND user_id = ? LIMIT 1",
			[jam.id, req.user.id]
		);
		const voteWeight = juryRows.length > 0 ? 3 : 1;

		await db.query(
			"INSERT INTO mod_jam_votes (jam_id, submission_id, user_id, nomination_id, vote_weight, created_at) VALUES (?, ?, ?, ?, ?, NOW())",
			[jam.id, submissionId, req.user.id, nominationId, voteWeight]
		);
		await bumpProjectCacheVersionById(db, submission.project_id);

		res.json({ success: true });
	} catch (error) {
		if(error?.code === "ER_DUP_ENTRY") {
			return res.status(400).json({ message: "You already voted in this mod jam" });
		}

		console.error("Error voting in mod jam:", error);
		res.status(500).json({ message: "Error voting", error: error.message });
	}
});

router.delete("/:slug/votes/:submissionId", auth, async (req, res) => {
	res.status(405).json({ message: "Votes cannot be removed" });
});

router.get("/:slug/results", async (req, res) => {
	try {
		const jam = await getJamBySlug(req.params.slug);
		if(!jam || jam.status !== "approved") {
			return res.status(404).json({ message: "Mod jam not found" });
		}

		if(computeLifecycle(jam) !== "completed") {
			return res.status(400).json({ message: "Results are available after voting ends" });
		}

		const submissions = await getSubmissions({ jamId: jam.id, userId: req.user?.id, resultsOnly: true });
		res.json({ mod_jam: formatJam(jam), results: submissions });
	} catch (error) {
		console.error("Error fetching mod jam results:", error);
		res.status(500).json({ message: "Error fetching results", error: error.message });
	}
});

module.exports = router;