const asObject = (value) => (value && typeof value === "object" && !Array.isArray(value) ? value : {});

export const parseFeatureFlagsCookieValue = (rawValue) => {
	if(!rawValue || typeof rawValue !== "string") {
		return {};
	}

	try {
		return asObject(JSON.parse(rawValue));
	} catch (error) {
		try {
			return asObject(JSON.parse(decodeURIComponent(rawValue)));
		} catch (decodeError) {
			return {};
		}
	}
};

export const isDeveloperModeEnabledFromCookieValue = (rawValue) => {
	const flags = parseFeatureFlagsCookieValue(rawValue);
	return flags.developerMode === true;
};

export const getCookieValue = (cookieString, cookieName) => {
	if(!cookieString || !cookieName) {
		return null;
	}

	const cookies = cookieString.split("; ");

	for(const cookie of cookies) {
		const [rawName, ...rest] = cookie.split("=");
		if(rawName?.trim() === cookieName) {
			return decodeURIComponent(rest.join("=") || "");
		}
	}

	return null;
};