const STAGING = process.env.STAGING === "true";

const API_BASE = process.env.API_BASE || (STAGING ? "https://staging-api.modifold.com" : "https://api.modifold.com");

module.exports = {
	API_BASE,
	STAGING,
};