const getGameVersionBranch = (value) => {
	const version = String(value || "").trim();
	const match = version.match(/^(\d+\.\d+)(?:\.\d+|\.x)?$/);
	return match ? `${match[1]}.x` : version;
};

const normalizeGameVersionBranches = (versions) => [
	...new Set(versions.map(getGameVersionBranch).filter(Boolean)),
];

module.exports = { getGameVersionBranch, normalizeGameVersionBranches };