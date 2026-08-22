"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient, getAuthHeaders } from "@/utils/api/client";
import { authProviderQueryKeys } from "@/utils/authProviders/queryKeys";

export function useAuthProviders({ authToken, initialData = null }) {
	return useQuery({
		queryKey: authProviderQueryKeys.status(),
		queryFn: async () => {
			const response = await apiClient.get("/auth/providers", {
				headers: getAuthHeaders(authToken),
			});
			return response.data;
		},
		initialData: initialData || undefined,
		enabled: Boolean(authToken),
		staleTime: 30 * 1000,
	});
}

export function useStartAuthProviderLink({ authToken }) {
	return useMutation({
		mutationFn: async ({ provider, next }) => {
			const response = await apiClient.post(`/auth/providers/${provider}/link/start`, { next }, {
				headers: getAuthHeaders(authToken),
			});
			return response.data;
		},
	});
}

export function useDisconnectAuthProvider({ authToken }) {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async ({ provider }) => {
			const response = await apiClient.delete(`/auth/providers/${provider}`, {
				headers: getAuthHeaders(authToken),
			});
			return response.data;
		},
		onSuccess: (data) => {
			queryClient.setQueryData(authProviderQueryKeys.status(), data);
		},
	});
}