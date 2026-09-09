const crypto = require("crypto");

const DEFAULT_MAX_PAGE = 500;
const DEFAULT_MAX_OFFSET = 10000;
const DEFAULT_SEARCH_LENGTH = 80;
const DEFAULT_FILTER_ITEMS = 8;
const DEFAULT_FILTER_ITEM_LENGTH = 64;

class QueryValidationError extends Error {
	constructor(message) {
		super(message);
		this.name = "QueryValidationError";
		this.statusCode = 400;
	}
}

const getScalar = (value) => Array.isArray(value) ? value[0] : value;

const parseInteger = (value, { name, minimum, maximum, fallback, clampMaximum = false }) => {
	const scalar = getScalar(value);
	if(scalar === undefined || scalar === null || scalar === "") {
		return fallback;
	}

	const normalized = String(scalar).trim();
	if(!/^\d+$/.test(normalized)) {
		throw new QueryValidationError(`Invalid ${name}`);
	}

	const parsed = Number(normalized);
	if(!Number.isSafeInteger(parsed) || parsed < minimum) {
		throw new QueryValidationError(`Invalid ${name}`);
	}

	if(parsed > maximum) {
		if(clampMaximum) {
			return maximum;
		}
		
		throw new QueryValidationError(`${name} is too large`);
	}

	return parsed;
};

const parsePagination = (query = {}, { defaultLimit = 20, maxLimit = 100, maxPage = DEFAULT_MAX_PAGE, maxOffset = DEFAULT_MAX_OFFSET, allowOffset = false } = {}) => {
	const limit = parseInteger(query.limit, {
		name: "limit",
		minimum: 1,
		maximum: maxLimit,
		fallback: defaultLimit,
		clampMaximum: true,
	});

	const page = parseInteger(query.page, {
		name: "page",
		minimum: 1,
		maximum: maxPage,
		fallback: 1,
	});

	const explicitOffset = allowOffset && query.offset !== undefined ? parseInteger(query.offset, {
		name: "offset",
		minimum: 0,
		maximum: maxOffset,
		fallback: 0,
	}) : null;
	const offset = explicitOffset === null ? (page - 1) * limit : explicitOffset;

	if(offset > maxOffset) {
		throw new QueryValidationError("offset is too large");
	}

	return {
		limit,
		page,
		offset,
		usesOffset: query.cursor === undefined || query.cursor === null || query.cursor === "",
	};
};

const normalizeEnum = (value, allowed, fallback, { name = "value", rejectInvalid = false } = {}) => {
	const scalar = getScalar(value);
	const normalized = scalar === undefined || scalar === null || scalar === "" ? fallback : String(scalar).trim().toLowerCase();
	if(allowed.includes(normalized)) {
		return normalized;
	}

	if(rejectInvalid) {
		throw new QueryValidationError(`Invalid ${name}`);
	}

	return fallback;
};

const normalizeSearch = (value, { maxLength = DEFAULT_SEARCH_LENGTH } = {}) => {
	const scalar = getScalar(value);
	return String(scalar || "").trim().replace(/\s+/g, " ").slice(0, maxLength);
};

const buildBooleanFullTextSearch = (value) => {
	const tokens = normalizeSearch(value).toLowerCase().match(/[\p{L}\p{N}]+/gu) || [];
	const searchableTokens = [...new Set(tokens.filter((token) => token.length >= 3).slice(0, 8))];
	return searchableTokens.length > 0 ? searchableTokens.map((token) => `+${token}*`).join(" ") : null;
};

const normalizeCsvFilter = (value, { maxItems = DEFAULT_FILTER_ITEMS, maxItemLength = DEFAULT_FILTER_ITEM_LENGTH, name = "filter" } = {}) => {
	const scalar = getScalar(value);
	if(scalar === undefined || scalar === null || scalar === "") {
		return [];
	}

	const values = String(scalar).split(",").map((item) => item.trim()).filter(Boolean);
	if(values.length > maxItems || values.some((item) => item.length > maxItemLength)) {
		throw new QueryValidationError(`Invalid ${name}`);
	}

	return [...new Set(values)].sort((left, right) => left.localeCompare(right));
};

const stableJson = (value) => {
	if(Array.isArray(value)) {
		return `[${value.map(stableJson).join(",")}]`;
	}

	if(value && typeof value === "object") {
		return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
	}

	return JSON.stringify(value);
};

const createCanonicalCacheKey = (namespace, normalizedQuery) => {
	const digest = crypto.createHash("sha256").update(stableJson(normalizedQuery)).digest("base64url").slice(0, 32);
	return `${namespace}_${digest}`;
};

const getCursorSecret = (secret) => secret || process.env.PAGINATION_CURSOR_SECRET || process.env.JWT_SECRET;

const encodeCursor = (payload, secret) => {
	const signingSecret = getCursorSecret(secret);
	if(!signingSecret) {
		throw new Error("Pagination cursor secret is not configured");
	}

	const body = Buffer.from(stableJson({ v: 1, ...payload })).toString("base64url");
	const signature = crypto.createHmac("sha256", signingSecret).update(body).digest("base64url");
	return `${body}.${signature}`;
};

const decodeCursor = (cursor, { secret, sort, context } = {}) => {
	if(!cursor) {
		return null;
	}

	const signingSecret = getCursorSecret(secret);
	if(!signingSecret) {
		throw new Error("Pagination cursor secret is not configured");
	}

	const [body, signature, extra] = String(cursor).split(".");
	if(!body || !signature || extra || !/^[A-Za-z0-9_-]+$/.test(body) || !/^[A-Za-z0-9_-]+$/.test(signature)) {
		throw new QueryValidationError("Invalid cursor");
	}

	const expected = crypto.createHmac("sha256", signingSecret).update(body).digest();
	let actual;
	let bodyBuffer;
	try {
		actual = Buffer.from(signature, "base64url");
		bodyBuffer = Buffer.from(body, "base64url");
	} catch(error) {
		throw new QueryValidationError("Invalid cursor");
	}

	if(actual.toString("base64url") !== signature || bodyBuffer.toString("base64url") !== body || actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) {
		throw new QueryValidationError("Invalid cursor");
	}

	let payload;
	try {
		payload = JSON.parse(bodyBuffer.toString("utf8"));
	} catch(error) {
		throw new QueryValidationError("Invalid cursor");
	}

	if(payload?.v !== 1 || !payload.id || payload.value === undefined || payload.sort !== sort || payload.context !== context) {
		throw new QueryValidationError("Invalid cursor");
	}

	return payload;
};

const getCursorContext = (filters) => crypto.createHash("sha256").update(stableJson(filters)).digest("base64url").slice(0, 20);

const normalizeCursorValue = (value) => value instanceof Date ? value.toISOString().slice(0, 23).replace("T", " ") : value;

const buildCursorPage = ({ rows, limit, sort, sortColumn, idColumn = "id", context, secret }) => {
	const hasMore = rows.length > limit;
	const items = hasMore ? rows.slice(0, limit) : rows;
	const last = items[items.length - 1];
	const nextCursor = hasMore && last ? encodeCursor({
		sort,
		value: normalizeCursorValue(last[sortColumn]),
		id: String(last[idColumn]),
		context,
	}, secret) : null;

	return { items, hasMore, nextCursor };
};

module.exports = {
	DEFAULT_MAX_OFFSET,
	DEFAULT_MAX_PAGE,
	QueryValidationError,
	buildBooleanFullTextSearch,
	buildCursorPage,
	createCanonicalCacheKey,
	decodeCursor,
	encodeCursor,
	getCursorContext,
	normalizeCsvFilter,
	normalizeEnum,
	normalizeSearch,
	parsePagination,
};