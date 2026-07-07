const crypto = require("crypto");
const axios = require("axios");
const { getCacheJson, setCacheJson } = require("./cache");

// example state management
const HYTALE_OAUTH_STATE_TTL_SECONDS = 5 * 60;
const hytaleOAuthStates = new Map();

const trimTrailingSlash = (value) => String(value || "").replace(/\/+$/, "");
const getPublicApiBase = () => trimTrailingSlash(process.env.PUBLIC_API_BASE || process.env.NEXT_PUBLIC_API_BASE || "https://api.modifold.com");
const getHytaleRedirectUri = () => process.env.HYTALE_REDIRECT_URI || `${getPublicApiBase()}/auth/hytale-callback`;
const getHytaleOAuthStateKey = (state) => `hytale_oauth_state:${state}`;
const base64Url = (buffer) => Buffer.from(buffer).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

const getHytaleConfig = () => {
	const clientId = process.env.HYTALE_CLIENT_ID;
	const clientSecret = process.env.HYTALE_CLIENT_SECRET;

	if(!clientId || !clientSecret) {
		throw new Error("Hytale OAuth is not configured");
	}

	return { clientId, clientSecret };
};

const saveHytaleOAuthState = async (state, payload) => {
	const statePayload = {
		...payload,
		expiresAt: Date.now() + HYTALE_OAUTH_STATE_TTL_SECONDS * 1000,
	};

	hytaleOAuthStates.set(state, statePayload);
	await setCacheJson(getHytaleOAuthStateKey(state), statePayload, HYTALE_OAUTH_STATE_TTL_SECONDS);
};

const consumeHytaleOAuthState = async (state) => {
	if(!state) {
		return null;
	}

	const cachedPayload = await getCacheJson(getHytaleOAuthStateKey(state));
	const memoryPayload = hytaleOAuthStates.get(state);
	hytaleOAuthStates.delete(state);

	const payload = cachedPayload || memoryPayload;
	if(!payload || Number(payload.expiresAt || 0) < Date.now()) {
		return null;
	}

	return payload;
};

const createHytaleAuthorizationUrl = async ({ mode = "login", next = "/", userId = null }) => {
	const { clientId } = getHytaleConfig();
	const state = base64Url(crypto.randomBytes(32));
	const codeVerifier = base64Url(crypto.randomBytes(48));
	const codeChallenge = base64Url(crypto.createHash("sha256").update(codeVerifier).digest());

	await saveHytaleOAuthState(state, {
		mode,
		next,
		userId,
		codeVerifier,
	});

	const params = new URLSearchParams({
		response_type: "code",
		client_id: clientId,
		redirect_uri: getHytaleRedirectUri(),
		scope: "openid hytale:profile",
		state,
		code_challenge: codeChallenge,
		code_challenge_method: "S256",
	});

	return `https://connect.accounts.hytale.com/oauth2/auth?${params.toString()}`;
};

const exchangeHytaleCode = async ({ code, codeVerifier }) => {
	const { clientId, clientSecret } = getHytaleConfig();
	const tokenResponse = await axios.post(
		`https://connect.accounts.hytale.com/oauth2/token`,
		new URLSearchParams({
			grant_type: "authorization_code",
			code,
			redirect_uri: getHytaleRedirectUri(),
			code_verifier: codeVerifier,
		}),
		{
			headers: {
				"Content-Type": "application/x-www-form-urlencoded",
				Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
			},
		}
	);

	const accessToken = tokenResponse.data?.access_token;
	if(!accessToken) {
		throw new Error(tokenResponse.data?.error_description || "Unable to obtain Hytale access token");
	}

	const userInfoResponse = await axios.get(`https://connect.accounts.hytale.com/userinfo`, {
		headers: { Authorization: `Bearer ${accessToken}` },
	});

	console.log("userinfo:", userInfoResponse.data);

	const userInfo = userInfoResponse.data || {};
	const hytaleSub = String(userInfo.sub || "").trim();
	const hytaleProfileUuid = String(userInfo.profile?.uuid || "").trim() || null;
	const hytaleProfileUsername = String(userInfo.profile?.username || "").trim().slice(0, 100) || null;

	if(!hytaleSub) {
		throw new Error("Hytale account identifier is missing");
	}

	if(!hytaleProfileUuid || !hytaleProfileUsername) {
		throw new Error("Hytale game profile is missing");
	}

	return {
		hytaleSub,
		hytaleProfileUuid,
		hytaleProfileUsername,
	};
};

module.exports = {
	consumeHytaleOAuthState,
	createHytaleAuthorizationUrl,
	exchangeHytaleCode,
	getHytaleRedirectUri,
};