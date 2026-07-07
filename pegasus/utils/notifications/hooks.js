"use client";

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient, getAuthHeaders, getAuthToken } from "@/utils/api/client";
import { notificationQueryKeys } from "@/utils/notifications/queryKeys";

const NOTIFICATIONS_PAGE_SIZE = 20;

export const getNotificationUserKey = (user) => user?.id || user?.slug || user?.username || "current";

async function fetchUnreadNotificationsCount({ authToken, signal }) {
    const token = getAuthToken(authToken);
    if(!token) {
        return 0;
    }

    const response = await apiClient.get("/notifications/unread-count", {
        headers: getAuthHeaders(token),
        signal,
    });

    return Math.max(0, Number(response.data?.unreadCount || 0));
}

async function fetchNotificationsPage({ authToken, pageParam = 1, signal, tzOffset }) {
    const token = getAuthToken(authToken);
    if(!token) {
        return {
            notifications: [],
            pagination: {
                page: 1,
                totalPages: 1,
            },
        };
    }

    const response = await apiClient.get("/notifications", {
        headers: getAuthHeaders(token),
        params: {
            page: pageParam,
            limit: NOTIFICATIONS_PAGE_SIZE,
            ...(Number.isFinite(tzOffset) ? { tzOffset } : {}),
        },
        signal,
    });

    return {
        notifications: Array.isArray(response.data?.notifications) ? response.data.notifications : [],
        pagination: {
            page: Number(response.data?.pagination?.page) || pageParam,
            totalPages: Number(response.data?.pagination?.totalPages) || 1,
        },
    };
}

const removeNotificationFromPages = (oldData, notificationId) => {
    if(!oldData?.pages) {
        return oldData;
    }

    return {
        ...oldData,
        pages: oldData.pages.map((page) => ({
            ...page,
            notifications: Array.isArray(page?.notifications) ? page.notifications.filter((item) => item.id !== notificationId) : [],
        })),
    };
};

export function useUnreadNotificationsCount({ authToken, enabled = true, isLoggedIn, user }) {
    const userKey = getNotificationUserKey(user);

    return useQuery({
        queryKey: notificationQueryKeys.unreadCount(userKey),
        queryFn: ({ signal }) => fetchUnreadNotificationsCount({ authToken, signal }),
        enabled: Boolean(isLoggedIn && enabled),
        refetchInterval: 60 * 1000,
        staleTime: 30 * 1000,
        placeholderData: (previousData) => previousData ?? 0,
    });
}

export function useNotificationsFeed({ authToken, initialDataLoaded, initialNotifications, initialPage, initialTotalPages, isLoggedIn, tzOffset, user }) {
    const userKey = getNotificationUserKey(user);

    return useInfiniteQuery({
        queryKey: notificationQueryKeys.list({ userKey, tzOffset }),
        queryFn: ({ pageParam, signal }) => fetchNotificationsPage({ authToken, pageParam, signal, tzOffset }),
        enabled: Boolean(isLoggedIn),
        initialPageParam: 1,
        getNextPageParam: (lastPage) => {
            const page = Number(lastPage?.pagination?.page) || 1;
            const totalPages = Number(lastPage?.pagination?.totalPages) || 1;
            return page < totalPages ? page + 1 : undefined;
        },
        initialData: initialDataLoaded ? {
            pages: [
                {
                    notifications: Array.isArray(initialNotifications) ? initialNotifications : [],
                    pagination: {
                        page: Number(initialPage) || 1,
                        totalPages: Number(initialTotalPages) || 1,
                    },
                },
            ],
            pageParams: [Number(initialPage) || 1],
        } : undefined,
        initialDataUpdatedAt: initialDataLoaded ? 0 : undefined,
    });
}

export function useMarkNotificationsRead({ authToken, user }) {
    const queryClient = useQueryClient();
    const userKey = getNotificationUserKey(user);

    return useMutation({
        mutationFn: () => apiClient.post("/notifications/mark-all-read", {}, {
            headers: getAuthHeaders(authToken),
        }),
        onSuccess: () => {
            queryClient.setQueryData(notificationQueryKeys.unreadCount(userKey), 0);
        },
    });
}

export function useOrganizationInviteAction({ authToken }) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ inviteId, action }) => apiClient.post(`/organizations/invites/${inviteId}/${action}`, {}, {
            headers: getAuthHeaders(authToken),
        }),
        onSuccess: (_data, variables) => {
            queryClient.setQueriesData(
                { queryKey: notificationQueryKeys.listRoot },
                (oldData) => removeNotificationFromPages(oldData, variables.notificationId)
            );
            queryClient.invalidateQueries({ queryKey: notificationQueryKeys.unreadCountRoot });
        },
    });
}