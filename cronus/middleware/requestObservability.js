const crypto = require("crypto");

const { logger, requestContext } = require("../packages/shared/logger");

const requestIdPattern = /^[A-Za-z0-9._:-]{1,128}$/;
const clientErrorSampleRate = 0.1;
const successSampleRate = 0;

const getRequestId = (req) => {
	const suppliedRequestId = req.get("x-request-id");
	return suppliedRequestId && requestIdPattern.test(suppliedRequestId) ? suppliedRequestId : crypto.randomUUID();
};

const shouldLogResponse = (statusCode) => {
	if(statusCode >= 500) {
		return true;
	}

	if(statusCode >= 400) {
		return Math.random() < clientErrorSampleRate;
	}

	return Math.random() < successSampleRate;
};

const requestObservability = (req, res, next) => {
	const requestId = getRequestId(req);
	const startedAt = process.hrtime.bigint();
	req.id = requestId;
	res.setHeader("X-Request-ID", requestId);

	const originalJson = res.json.bind(res);
	res.json = (body) => {
		if(res.statusCode >= 500) {
			return originalJson({
				message: "Internal server error",
				code: "internal_error",
				requestId,
			});
		}
		
		return originalJson(body);
	};

	res.once("finish", () => {
		if(!shouldLogResponse(res.statusCode)) {
			return;
		}

		const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
		const fields = {
			event: "http_request",
			requestId,
			method: req.method,
			path: String(req.originalUrl || "").split("?")[0],
			statusCode: res.statusCode,
			durationMs: Number(durationMs.toFixed(2)),
			userId: req.user?.id || null,
		};
		const level = res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info";
		logger[level](fields, "HTTP request completed");
	});

	requestContext.run({ requestId }, next);
};

const errorHandler = (error, req, res, next) => {
	if(res.headersSent) {
		return next(error);
	}

	const statusCode = Number(error?.statusCode);
	const isPublicError = Number.isInteger(statusCode) && statusCode >= 400 && statusCode < 500;
	logger.error({
		event: "unhandled_request_error",
		requestId: req.id,
		method: req.method,
		path: String(req.originalUrl || "").split("?")[0],
		error,
	}, "Unhandled request error");

	if(isPublicError) {
		return res.status(statusCode).json({
			message: error.message,
			code: error.code || "request_error",
			requestId: req.id,
		});
	}

	return res.status(500).json();
};

module.exports = {
	errorHandler,
	requestObservability,
};