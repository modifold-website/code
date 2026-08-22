export const authProviderQueryKeys = {
	all: ["auth-providers"],
	status: () => [...authProviderQueryKeys.all, "status"],
};