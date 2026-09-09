const { AsyncLocalStorage } = require("async_hooks");
const pino = require("pino");

const requestContext = new AsyncLocalStorage();
const sensitiveKeyPattern = /(?:authorization|cookie|password|passwd|secret|token|api[-_]?key|access[-_]?key|credential|session|code_verifier)/i;
const emailPattern = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const bearerPattern = /\bBearer\s+[A-Za-z0-9._~+\/-]+=*/gi;
const jwtPattern = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g;
const apiTokenPattern = /\bmf_[A-Za-z0-9_-]+\b/g;
const urlCredentialPattern = /:\/\/[^\s/:@]+:[^\s/@]+@/g;
const sensitiveQueryParameterPattern = /([?&](?:access_token|api_key|key|password|secret|signature|token)=)[^&\s]+/gi;

const sanitizeString = (value) => String(value)
	.replace(bearerPattern, "Bearer [Redacted]")
	.replace(jwtPattern, "[Redacted]")
	.replace(apiTokenPattern, "[Redacted]")
	.replace(urlCredentialPattern, "://[Redacted]@")
	.replace(sensitiveQueryParameterPattern, "$1[Redacted]")
	.replace(emailPattern, "[Redacted]");

const sanitizeValue = (value, seen = new WeakSet(), depth = 0) => {
	if(value === null || value === undefined || typeof value === "number" || typeof value === "boolean") {
		return value;
	}

	if(typeof value === "string") {
		return sanitizeString(value);
	}

	if(value instanceof Error) {
		const sanitizedError = {
			type: value.name,
			message: sanitizeString(value.message || "Unexpected error"),
		};
		if(value.code) {
			sanitizedError.code = String(value.code);
		}
		if(process.env.NODE_ENV !== "production" && value.stack) {
			sanitizedError.stack = sanitizeString(value.stack);
		}
		return sanitizedError;
	}

	if(typeof value !== "object" || depth >= 6) {
		return "[Unsupported]";
	}
	if(seen.has(value)) {
		return "[Circular]";
	}
	seen.add(value);

	if(Array.isArray(value)) {
		return value.slice(0, 50).map((item) => sanitizeValue(item, seen, depth + 1));
	}

	const sanitized = {};
	for(const [key, item] of Object.entries(value).slice(0, 100)) {
		const redactStack = key === "stack" && process.env.NODE_ENV === "production";
		const redactSensitiveValue = sensitiveKeyPattern.test(key) && typeof item !== "boolean" && typeof item !== "number";
		sanitized[key] = redactSensitiveValue || redactStack ? "[Redacted]" : sanitizeValue(item, seen, depth + 1);
	}
	return sanitized;
};

const baseLogger = pino({
	name: "cronus",
	level: "info",
	base: {
		service: "cronus",
		environment: process.env.NODE_ENV || "development",
	},
	redact: {
		paths: [
			"authorization",
			"cookie",
			"password",
			"secret",
			"token",
			"accessToken",
			"refreshToken",
			"req.headers.authorization",
			"req.headers.cookie",
		],
		censor: "[Redacted]",
	},
	timestamp: pino.stdTimeFunctions.isoTime,
});

const normalizeLogArguments = (args) => {
	const fields = {};
	const messages = [];
	const extra = [];

	for(const argument of args) {
		if(argument instanceof Error) {
			fields.error = sanitizeValue(argument);
		} else if(argument && typeof argument === "object" && !Array.isArray(argument)) {
			Object.assign(fields, sanitizeValue(argument));
		} else if(typeof argument === "string") {
			messages.push(sanitizeString(argument));
		} else if(argument !== undefined) {
			extra.push(sanitizeValue(argument));
		}
	}

	if(extra.length) {
		fields.args = extra;
	}

	return { fields, message: messages.join(" ") || undefined };
};

const writeLog = (level, bindings, args) => {
	const { fields, message } = normalizeLogArguments(args);
	const context = requestContext.getStore();
	baseLogger[level]({
		...(context || {}),
		...(bindings || {}),
		...fields,
	}, message);
};

const createLogger = (scope) => {
	const bindings = scope ? { scope } : null;
	return {
		debug: (...args) => writeLog("debug", bindings, args),
		info: (...args) => writeLog("info", bindings, args),
		warn: (...args) => writeLog("warn", bindings, args),
		error: (...args) => writeLog("error", bindings, args),
	};
};

const logger = createLogger();

module.exports = {
	createLogger,
	logger,
	requestContext,
	sanitizeValue,
};