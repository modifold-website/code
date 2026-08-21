"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { apiClient, getAuthHeaders } from "@/utils/api/client";
import { collaboratorQueryKeys } from "@/utils/collaborators/queryKeys";

export function useCollaboratorUserSearch({ authToken, query, enabled = true }) {
	const normalizedQuery = String(query || "").trim();

	return useQuery({
		queryKey: collaboratorQueryKeys.userSearch(normalizedQuery),
		queryFn: async ({ signal }) => {
			const response = await apiClient.get("/users/search", {
				headers: getAuthHeaders(authToken),
				params: { q: normalizedQuery },
				signal,
			});
			return Array.isArray(response.data?.users) ? response.data.users : [];
		},
		enabled: Boolean(enabled && normalizedQuery.length >= 2),
		staleTime: 30 * 1000,
	});
}

export function useInviteProjectCollaborator({ authToken, projectSlug }) {
	return useMutation({
		mutationFn: async ({ userId }) => {
			const response = await apiClient.post(`/projects/${projectSlug}/collaborators/invitations`, {
				user_id: userId,
			}, {
				headers: getAuthHeaders(authToken),
			});
			return response.data;
		},
	});
}

export function useUpdateProjectCollaborator({ authToken, projectSlug }) {
	return useMutation({
		mutationFn: async ({ userId, role, showAsAuthor, permissions }) => {
			const response = await apiClient.patch(`/projects/${projectSlug}/collaborators/${userId}`, {
				role,
				show_as_author: showAsAuthor,
				permissions,
			}, {
				headers: getAuthHeaders(authToken),
			});
			return response.data;
		},
	});
}

export function useUpdateProjectOwnerAttribution({ authToken, projectSlug }) {
	return useMutation({
		mutationFn: async ({ role, showAsAuthor }) => {
			const response = await apiClient.patch(`/projects/${projectSlug}/owner-attribution`, {
				role,
				show_as_author: showAsAuthor,
			}, {
				headers: getAuthHeaders(authToken),
			});
			return response.data;
		},
	});
}

export function useRemoveProjectCollaborator({ authToken, projectSlug }) {
	return useMutation({
		mutationFn: async ({ userId }) => {
			const response = await apiClient.delete(`/projects/${projectSlug}/collaborators/${userId}`, {
				headers: getAuthHeaders(authToken),
			});
			return response.data;
		},
	});
}

export function useUpdateProjectOrganization({ authToken, projectSlug }) {
	return useMutation({
		mutationFn: async ({ organizationSlug }) => {
			const response = await apiClient.put(`/projects/${projectSlug}/organization`, {
				organization_slug: organizationSlug || null,
			}, {
				headers: getAuthHeaders(authToken),
			});
			return response.data;
		},
	});
}