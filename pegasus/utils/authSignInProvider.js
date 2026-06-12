export const LAST_SIGN_IN_PROVIDER_KEY = "modifold:last-sign-in-provider";
export const PENDING_SIGN_IN_PROVIDER_KEY = "modifold:pending-sign-in-provider";

const SIGN_IN_PROVIDERS = new Set(["github", "discord", "telegram", "email"]);

export function isSignInProvider(provider) {
	return SIGN_IN_PROVIDERS.has(provider);
}

export function getLastSignInProvider() {
	if(typeof window === "undefined") {
		return "";
	}

	const provider = window.localStorage.getItem(LAST_SIGN_IN_PROVIDER_KEY);
	return isSignInProvider(provider) ? provider : "";
}

export function setLastSignInProvider(provider) {
	if(typeof window === "undefined" || !isSignInProvider(provider)) {
		return;
	}

	window.localStorage.setItem(LAST_SIGN_IN_PROVIDER_KEY, provider);
	window.sessionStorage.removeItem(PENDING_SIGN_IN_PROVIDER_KEY);
}

export function setPendingSignInProvider(provider) {
	if(typeof window === "undefined" || !isSignInProvider(provider)) {
		return;
	}

	window.sessionStorage.setItem(PENDING_SIGN_IN_PROVIDER_KEY, provider);
}

export function commitPendingSignInProvider(fallbackProvider = "") {
	if(typeof window === "undefined") {
		return;
	}

	const provider = window.sessionStorage.getItem(PENDING_SIGN_IN_PROVIDER_KEY) || fallbackProvider;
	setLastSignInProvider(provider);
}