import "server-only";

export const getServerApiBase = () => process.env.API_BASE || process.env.NEXT_PUBLIC_API_BASE;

export const withServerApiHeaders = (options = {}) => {
	const headers = new Headers(options.headers);
	const rateLimitKey = String(process.env.RATE_LIMIT_IGNORE_KEY || "").trim();

	if(!headers.has("Accept")) {
		headers.set("Accept", "application/json");
	}

	if(rateLimitKey) {
		headers.set("x-ratelimit-key", rateLimitKey);
	}

	return {
		...options,
		headers,
	};
};

export const serverApiFetch = (input, options = {}) => fetch(input, withServerApiHeaders(options));