const CURSEFORGE_API_BASE = "https://api.curseforge.com/v1";
const MAX_ATTEMPTS = 3;

let requestTail = Promise.resolve();
let nextRequestAt = 0;

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

const getConfiguration = () => {
	const apiKey = String(process.env.CURSEFORGE_API_KEY || "").trim();
	const gameId = Number(process.env.CURSEFORGE_HYTALE_GAME_ID);
	if(!apiKey || !Number.isInteger(gameId) || gameId <= 0) {
		const error = new Error("CurseForge import is not configured");
		error.statusCode = 503;
		throw error;
	}

	return { apiKey, gameId };
};

const getRetryDelay = (response, attempt) => {
	const retryAfter = Number(response?.headers?.get("retry-after"));
	if(Number.isFinite(retryAfter) && retryAfter > 0) {
		return Math.min(60000, retryAfter * 1000);
	}

	return Math.min(10000, (2 ** attempt) * 500) + Math.floor(Math.random() * 250);
};

const scheduleRequest = (operation) => {
	const minimumInterval = Math.max(100, Number(process.env.CURSEFORGE_REQUEST_INTERVAL_MS) || 350);
	const scheduled = requestTail.then(async () => {
		const wait = Math.max(0, nextRequestAt - Date.now());
		if(wait) {
			await delay(wait);
		}

		nextRequestAt = Date.now() + minimumInterval;
		return operation();
	});

	requestTail = scheduled.catch(() => undefined);
	return scheduled;
};

const request = async (pathname, { searchParams } = {}) => {
	const { apiKey } = getConfiguration();
	const url = new URL(`${CURSEFORGE_API_BASE}${pathname}`);
	for(const [key, value] of Object.entries(searchParams || {})) {
		if(value !== undefined && value !== null && value !== "") {
			url.searchParams.set(key, String(value));
		}
	}

	let lastError;
	for(let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
		let response;
		try {
			response = await scheduleRequest(() => fetch(url, {
				headers: { "x-api-key": apiKey, Accept: "application/json" },
				signal: AbortSignal.timeout(Math.max(5000, Number(process.env.CURSEFORGE_REQUEST_TIMEOUT_MS) || 20000)),
			}));
		} catch(error) {
			lastError = error;
			if(attempt < MAX_ATTEMPTS) {
				await delay(getRetryDelay(null, attempt));
				continue;
			}

			throw error;
		}

		if(response.ok) {
			return response.json();
		}

		const responseBody = await response.text().catch(() => "");
		const error = new Error(`CurseForge API request failed (${response.status})${responseBody ? `: ${responseBody.slice(0, 300)}` : ""}`);
		error.statusCode = response.status === 404 ? 404 : response.status === 429 ? 503 : 502;
		lastError = error;
		if(attempt >= MAX_ATTEMPTS || (response.status < 500 && response.status !== 429)) {
			throw error;
		}

		await delay(getRetryDelay(response, attempt));
	}

	throw lastError;
};

const parseCurseForgeUrl = (value, expectedType) => {
	let url;
	try {
		url = new URL(String(value || "").trim());
	} catch {
		return null;
	}

	const hostname = url.hostname.replace(/^www\./, "").toLowerCase();
	if(url.protocol !== "https:" || !["curseforge.com", "legacy.curseforge.com"].includes(hostname)) {
		return null;
	}

	const parts = url.pathname.split("/").filter(Boolean);
	if(expectedType === "profile") {
		const memberIndex = parts.findIndex((part) => part.toLowerCase() === "members");
		const username = memberIndex >= 0 ? parts[memberIndex + 1] : null;
		return username ? { username, url: `https://www.curseforge.com/members/${encodeURIComponent(username)}` } : null;
	}

	if(parts[0]?.toLowerCase() !== "hytale" || parts.length < 3) {
		return null;
	}

	return {
		classSlug: parts[1].toLowerCase(),
		slug: parts[2].toLowerCase(),
		url: `https://www.curseforge.com/hytale/${encodeURIComponent(parts[1])}/${encodeURIComponent(parts[2])}`,
	};
};

const searchMods = async (parameters) => {
	const { gameId } = getConfiguration();
	return request("/mods/search", { searchParams: { gameId, ...parameters } });
};

const getMod = async (modId) => (await request(`/mods/${Number(modId)}`)).data;
const getModDescription = async (modId) => (await request(`/mods/${Number(modId)}/description`)).data;
const getModFiles = async (modId) => (await request(`/mods/${Number(modId)}/files`, { searchParams: { index: 0, pageSize: 50 } })).data || [];
const getFileDownloadUrl = async (modId, fileId) => (await request(`/mods/${Number(modId)}/files/${Number(fileId)}/download-url`)).data;

const normalizeCandidate = (mod) => ({
	id: Number(mod.id),
	name: String(mod.name || mod.slug || "Untitled project"),
	slug: String(mod.slug || ""),
	summary: String(mod.summary || ""),
	iconUrl: mod.logo?.thumbnailUrl || mod.logo?.url || null,
	websiteUrl: mod.links?.websiteUrl || null,
	classId: Number(mod.classId) || null,
	categories: Array.isArray(mod.categories) ? mod.categories.map((category) => ({ id: category.id, name: category.name, slug: category.slug })) : [],
	authors: Array.isArray(mod.authors) ? mod.authors.map((author) => ({ id: Number(author.id), name: author.name, url: author.url })) : [],
});

const findProfileProjects = async (profileUrl) => {
	const parsed = parseCurseForgeUrl(profileUrl, "profile");
	if(!parsed) {
		const error = new Error("Invalid CurseForge member profile URL");
		error.statusCode = 400;
		throw error;
	}

	const discovery = await searchMods({ searchFilter: parsed.username, pageSize: 50, index: 0 });
	const matchingAuthor = (discovery.data || []).flatMap((mod) => mod.authors || []).find((author) => {
		const authorUrl = parseCurseForgeUrl(author.url, "profile");
		return authorUrl?.username.toLowerCase() === parsed.username.toLowerCase();
	});

	if(!matchingAuthor) {
		const error = new Error("No Hytale projects were found for this CurseForge profile");
		error.statusCode = 404;
		throw error;
	}

	const projects = [];
	for(let index = 0; index < 10000; index += 50) {
		const page = await searchMods({ primaryAuthorId: matchingAuthor.id, pageSize: 50, index });
		projects.push(...(page.data || []));
		if((page.data || []).length < 50) {
			break;
		}
	}

	return {
		profile: { ...parsed, authorId: Number(matchingAuthor.id), name: matchingAuthor.name || parsed.username },
		projects: projects.map(normalizeCandidate).filter((project) => project.websiteUrl),
	};
};

const findProjectByUrl = async (projectUrl) => {
	const parsed = parseCurseForgeUrl(projectUrl, "project");
	if(!parsed) {
		const error = new Error("Invalid Hytale CurseForge project URL");
		error.statusCode = 400;
		throw error;
	}

	const response = await searchMods({ slug: parsed.slug, pageSize: 50, index: 0 });
	const mod = (response.data || []).find((candidate) => {
		const candidateUrl = parseCurseForgeUrl(candidate.links?.websiteUrl, "project");
		return candidateUrl?.slug === parsed.slug && candidateUrl?.classSlug === parsed.classSlug;
	});

	if(!mod) {
		const error = new Error(`CurseForge project not found: ${parsed.slug}`);
		error.statusCode = 404;
		throw error;
	}

	return normalizeCandidate(mod);
};

module.exports = {
	findProfileProjects,
	findProjectByUrl,
	getFileDownloadUrl,
	getMod,
	getModDescription,
	getModFiles,
	normalizeCandidate,
	parseCurseForgeUrl,
	request,
};