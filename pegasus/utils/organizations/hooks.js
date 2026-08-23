"use client";

import { useMutation } from "@tanstack/react-query";
import { apiClient, getAuthHeaders } from "@/utils/api/client";

export function useTransferOrganizationOwnership({ authToken, organizationSlug }) {
	return useMutation({
		mutationFn: async ({ newOwnerUserId, confirmation, twoFactorCode }) => {
			const response = await apiClient.post(`/organizations/${organizationSlug}/transfer-ownership`, {
				new_owner_user_id: newOwnerUserId,
				confirmation,
				two_factor_code: twoFactorCode || undefined,
			}, {
				headers: getAuthHeaders(authToken),
			});
			return response.data;
		},
	});
}

export function useUpdateOrganizationMemberProjectAccess({ authToken, organizationSlug }) {
	return useMutation({
		mutationFn: async ({ userId, projects }) => {
			const response = await apiClient.put(`/organizations/${organizationSlug}/members/${userId}/project-access`, {
				projects,
			}, {
				headers: getAuthHeaders(authToken),
			});
			return response.data;
		},
	});
}