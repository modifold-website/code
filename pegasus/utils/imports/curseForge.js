import { apiClient, getAuthHeaders } from "@/utils/api/client";

export const prepareCurseForgeProfile = async ({ authToken, profileUrl }) => {
	const response = await apiClient.post("/v2/imports/curseforge/profile", { profile_url: profileUrl }, { headers: getAuthHeaders(authToken) });
	return response.data;
};

export const verifyCurseForgeImport = async ({ authToken, importId, code }) => {
	const response = await apiClient.post(`/v2/imports/curseforge/${importId}/verify`, { code }, { headers: getAuthHeaders(authToken) });
	return response.data;
};

export const prepareCurseForgeProjects = async ({ authToken, projectUrls }) => {
	const response = await apiClient.post("/v2/imports/curseforge/projects", { project_urls: projectUrls }, { headers: getAuthHeaders(authToken) });
	return response.data;
};

export const startCurseForgeImport = async ({ authToken, importId, projectIds }) => {
	const response = await apiClient.post(`/v2/imports/curseforge/${importId}/start`, { project_ids: projectIds }, { headers: getAuthHeaders(authToken) });
	return response.data;
};

export const retryCurseForgeImportItem = async ({ authToken, importId, itemId }) => {
	const response = await apiClient.post(`/v2/imports/curseforge/${importId}/items/${itemId}/retry`, {}, { headers: getAuthHeaders(authToken) });
	return response.data;
};

export const getCurseForgeImport = async ({ authToken, importId }) => {
	const response = await apiClient.get(`/v2/imports/curseforge/${importId}`, { headers: getAuthHeaders(authToken) });
	return response.data;
};