"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/components/providers/AuthProvider";
import { apiClient, getAuthHeaders } from "@/utils/api/client";
import { moderationStatisticsQueryKeys, userModerationQueryKeys } from "./queryKeys";

export function useModerationStatistics({ authToken, timeRange, initialAnalytics }) {
	const { user } = useAuth();

	return useQuery({
		queryKey: moderationStatisticsQueryKeys.analytics(user?.id, timeRange),
		queryFn: async ({ signal }) => {
			const response = await apiClient.get("/moderation/analytics", {
				headers: getAuthHeaders(authToken),
				params: { time_range: timeRange },
				signal,
			});

			return response.data;
		},
		initialData: timeRange === "30d" ? initialAnalytics || undefined : undefined,
		enabled: Boolean(authToken),
	});
}

export function useModerationUsers({ authToken, page, search, initialData }) {
	const { user } = useAuth();

	return useQuery({
		queryKey: userModerationQueryKeys.list(user?.id, page, search),
		queryFn: async ({ signal }) => {
			const response = await apiClient.get("/moderation/users", {
				headers: getAuthHeaders(authToken),
				params: {
					page,
					limit: 15,
					search,
				},
				signal,
			});

			return {
				...response.data,
				users: Array.isArray(response.data?.users) ? response.data.users : [],
			};
		},
		initialData: page === 1 && !search ? initialData || undefined : undefined,
		enabled: Boolean(authToken),
	});
}

export function useUserModerationActions({ authToken, userId }) {
	const { user } = useAuth();
	const queryClient = useQueryClient();
	const invalidate = () => queryClient.invalidateQueries({ queryKey: userModerationQueryKeys.root(user?.id) });

	const saveUser = useMutation({
		mutationFn: async (data) => (
			await apiClient.put(`/moderation/users/${userId}`, data, {
				headers: getAuthHeaders(authToken),
			})
		).data,
		onSuccess: invalidate,
	});

	const updateAchievement = useMutation({
		mutationFn: async ({ code, earned }) => (
			await apiClient.put(`/moderation/users/${userId}/achievements/${encodeURIComponent(code)}`, { earned }, {
				headers: getAuthHeaders(authToken),
			})
		).data,
		onSuccess: invalidate,
	});

	return { saveUser, updateAchievement };
}

export function useModerationAchievements({ authToken, userId, enabled }) {
	const { user } = useAuth();

	return useQuery({
		queryKey: userModerationQueryKeys.achievements(user?.id, userId),
		queryFn: async ({ signal }) => {
			const response = await apiClient.get(`/moderation/users/${userId}/achievements`, {
				headers: getAuthHeaders(authToken),
				signal,
			});

			return Array.isArray(response.data?.achievements) ? response.data.achievements : [];
		},
		enabled: Boolean(enabled && userId && authToken),
		staleTime: 0,
	});
}