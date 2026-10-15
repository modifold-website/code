"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/components/providers/AuthProvider";
import { apiClient, getAuthHeaders } from "@/utils/api/client";
import { projectAnalyticsQueryKeys } from "./queryKeys";

export function useProjectAnalytics({ authToken, project, from, to }) {
	const { user } = useAuth();
	return useQuery({
		queryKey: projectAnalyticsQueryKeys.report(user?.id, project, from, to),
		queryFn: async ({ signal }) =>
			(
				await apiClient.get(`/moderation/project-analytics/projects/${encodeURIComponent(project)}/report`, {
					params: { from, to },
					signal,
					headers: getAuthHeaders(authToken),
				})
			).data,
		enabled: Boolean(authToken && user?.id && project),
		staleTime: 30000,
		retry: (count, error) => count < 1 && ![400, 401, 403, 404].includes(error.response?.status),
	});
}