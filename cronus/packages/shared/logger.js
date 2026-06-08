const createLogger = (scope) => {
	const prefix = scope ? `[${scope}]` : "[cronus]";

	return {
		info: (...args) => console.log(prefix, ...args),
		warn: (...args) => console.warn(prefix, ...args),
		error: (...args) => console.error(prefix, ...args),
	};
};

module.exports = {
	createLogger,
};