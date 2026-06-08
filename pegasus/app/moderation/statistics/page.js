const serverApiBase = process.env.API_BASE || process.env.NEXT_PUBLIC_API_BASE;

﻿import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import StatisticsModerationPage from "@/components/pages/StatisticsModerationPage";

export async function generateMetadata() {
    const resolvedLocale = await getLocale();
    const t = await getTranslations({ locale: resolvedLocale, namespace: "ModerationPage" });

    return {
        title: `${t("tabs.statistics")} — Modifold`,
    };
}

async function fetchAnalytics(authToken) {
    try {
        const response = await fetch(`${serverApiBase}/moderation/analytics?time_range=30d`, {
            headers: { Authorization: `Bearer ${authToken}` },
            next: { revalidate: 60 },
        });

        if(!response.ok) {
            throw new Error(`Failed to fetch analytics: ${response.status}`);
        }

        return response.json();
    } catch (err) {
        console.error("Error fetching analytics data:", err);

        return {
            approvedProjects: [],
            pendingProjects: [],
            userRegistrations: [],
            totalApproved: 0,
            totalPending: 0,
            totalUsers: 0,
            totalProjectVersions: 0,
            totalProjectDownloads: 0,
            totalUnpublishedProjects: 0,
            totalPlayersOnlineNow: 0,
            totalActiveServersNow: 0,
            onlineSummary: {
                playersOnlineNow: 0,
                activeServersNow: 0,
            },
            globalOnlineSeries: [],
        };
    }
}

export default async function StatisticsModerationServer() {
    const cookieStore = await cookies();
    const authToken = cookieStore.get("authToken")?.value;

    if(!authToken) {
        redirect("/403");
    }

    try {
        const response = await fetch(`${serverApiBase}/auth/user`, {
            headers: { Authorization: `Bearer ${authToken}` },
            cache: "no-store",
        });

        if(!response.ok) {
            redirect("/");
        }

        const data = await response.json().catch(() => ({}));
        const role = data?.user?.isRole;

        if(role !== "admin" && role !== "moderator") {
            redirect("/403");
        }
    } catch (error) {
        console.error("Error checking moderation access:", error);
        redirect("/");
    }

    const analytics = await fetchAnalytics(authToken);

    return <StatisticsModerationPage initialAnalytics={analytics} />;
}