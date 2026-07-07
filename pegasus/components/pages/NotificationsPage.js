"use client";

import { useEffect, useMemo, useRef } from "react";
import { useAuth } from "../providers/AuthProvider";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import UserSettingsSidebar from "@/components/ui/UserSettingsSidebar";
import NotificationItem from "@/components/ui/NotificationItem";
import { useMarkNotificationsRead, useNotificationsFeed, useOrganizationInviteAction } from "@/utils/notifications/hooks";

const getDayKey = (date) => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;

export default function NotificationsPage({ authToken, initialNotifications = [], initialPage = 1, initialTotalPages = 1, initialDataLoaded = false }) {
    const t = useTranslations("NotificationsPage");
    const tSidebar = useTranslations("SettingsBlogPage.sidebar");
    const locale = useLocale();
    const { isLoggedIn, user } = useAuth();
    const router = useRouter();
    const hasMarkedInitialRead = useRef(false);
    const tzOffset = useMemo(() => (
        typeof window === "undefined" ? null : new Date().getTimezoneOffset()
    ), []);

    const dateFormatter = useMemo(() => (
        new Intl.DateTimeFormat(locale || undefined, {
            day: "numeric",
            month: "short",
            year: "numeric",
        })
    ), [locale]);

    const timeFormatter = useMemo(() => (
        new Intl.DateTimeFormat(locale || undefined, {
            hour: "2-digit",
            minute: "2-digit",
        })
    ), [locale]);
    const notificationsQuery = useNotificationsFeed({
        authToken,
        initialDataLoaded,
        initialNotifications,
        initialPage,
        initialTotalPages,
        isLoggedIn,
        tzOffset,
        user,
    });
    const markReadMutation = useMarkNotificationsRead({ authToken, user });
    const inviteActionMutation = useOrganizationInviteAction({ authToken });
    const notifications = useMemo(() => (
        notificationsQuery.data?.pages?.flatMap((pageData) => pageData.notifications || []) || []
    ), [notificationsQuery.data]);
    const loading = notificationsQuery.isPending;
    const loadingMore = notificationsQuery.isFetchingNextPage;
    const error = notificationsQuery.isError || inviteActionMutation.isError ? t("errors.fetch") : "";

    useEffect(() => {
        if(!isLoggedIn) {
            router.push("/403");
        }
    }, [isLoggedIn, router]);

    useEffect(() => {
        if(!isLoggedIn || hasMarkedInitialRead.current || !notificationsQuery.isSuccess) {
            return;
        }

        hasMarkedInitialRead.current = true;
        markReadMutation.mutate();
    }, [isLoggedIn, markReadMutation, notificationsQuery.isSuccess]);

    const sections = useMemo(() => {
        const now = new Date();
        const todayKey = getDayKey(now);
        const yesterday = new Date(now);
        yesterday.setDate(now.getDate() - 1);
        const yesterdayKey = getDayKey(yesterday);

        const grouped = [];
        const indexByLabel = new Map();

        for(const notification of notifications) {
            const date = new Date((notification.latestAt || 0) * 1000);
            const dayKey = getDayKey(date);
            let label = dateFormatter.format(date);

            if(dayKey === todayKey) {
                label = t("sections.today");
            } else if(dayKey === yesterdayKey) {
                label = t("sections.yesterday");
            }

            if(!indexByLabel.has(label)) {
                indexByLabel.set(label, grouped.length);
                grouped.push({ label, items: [] });
            }

            grouped[indexByLabel.get(label)].items.push(notification);
        }

        return grouped;
    }, [notifications, dateFormatter, t]);

    const canLoadMore = notificationsQuery.hasNextPage;

    const handleOrganizationInviteAction = (notification, action) => {
        if(!notification?.inviteId) {
            return;
        }

        inviteActionMutation.mutate({
            action,
            inviteId: notification.inviteId,
            notificationId: notification.id,
        });
    };

    return (
        <div className="layout">
            <div className="page-content settings-page">
                <UserSettingsSidebar
                    user={user}
                    profileIconAlt={t("sidebarAvatarAlt", { username: user?.username || "" })}
                    mode="dashboard"
                    labels={{
                        projects: tSidebar("projects"),
                        analytics: tSidebar("analytics"),
                        likes: tSidebar("likes"),
                        organizations: tSidebar("organizations"),
                        jams: tSidebar("jams"),
                        notifications: tSidebar("notifications"),
                        settings: tSidebar("settings"),
                        apiTokens: tSidebar("apiTokens"),
                        verification: tSidebar("verification"),
                    }}
                />

                <div className="notifications settings-wrapper--narrow">
                    <span className="notifications__header-text">{t("title")}</span>

                    {loading ? (
                        <div className="subsite-empty-feed">
                            <p className="subsite-empty-feed__title">{t("loading")}</p>
                        </div>
                    ) : error ? (
                        <div className="subsite-empty-feed">
                            <p className="subsite-empty-feed__title">{error}</p>
                        </div>
                    ) : sections.length === 0 ? (
                        <div className="subsite-empty-feed">
                            <p className="subsite-empty-feed__title">{t("empty")}</p>
                        </div>
                    ) : (
                        <div className="notifications-feed">
                            {sections.map((section) => (
                                <section key={section.label} className="notifications-day-group">
                                    <h3 className="notifications-day-group__title">{section.label}</h3>

                                    <div className="notifications-day-group__items">
                                        {section.items.map((notification) => (
                                            <NotificationItem
                                                key={notification.id}
                                                notification={notification}
                                                timeFormatter={timeFormatter}
                                                t={t}
                                                onOrganizationInviteAction={handleOrganizationInviteAction}
                                                isInviteActionPending={inviteActionMutation.isPending}
                                            />
                                        ))}
                                    </div>
                                </section>
                            ))}

                            {canLoadMore && (
                                <div className="notifications-feed__load-more">
                                    <button className="button button--size-m button--type-secondary" onClick={() => notificationsQuery.fetchNextPage()} disabled={loadingMore}>
                                        {loadingMore ? t("loadingMore") : t("loadMore")}
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}