import { serverApiFetch } from "@/utils/api/server";
const serverApiBase = process.env.API_BASE || process.env.NEXT_PUBLIC_API_BASE;

import { cookies } from "next/headers";
import { redirect, forbidden, unstable_rethrow } from "next/navigation";
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
        const response = await serverApiFetch(`${serverApiBase}/moderation/analytics?time_range=30d`, {
            headers: { Authorization: `Bearer ${authToken}` },
            next: { revalidate: 60 },
        });

        if(!response.ok) {
            throw new Error(`Failed to fetch analytics: ${response.status}`);
        }

        return response.json();
    } catch (err) {
        console.error("Error fetching analytics data:", err);

		return null;
    }
}

export default async function StatisticsModerationServer() {
    const cookieStore = await cookies();
    const authToken = cookieStore.get("authToken")?.value;

    if(!authToken) {
        forbidden();
    }

    try {
        const response = await serverApiFetch(`${serverApiBase}/auth/user`, {
            headers: { Authorization: `Bearer ${authToken}` },
            cache: "no-store",
        });

        if(!response.ok) {
            redirect("/");
        }

        const data = await response.json().catch(() => ({}));
        const role = data?.user?.isRole;

        if(role !== "admin" && role !== "moderator") {
            forbidden();
        }
    } catch (error) {
		unstable_rethrow(error);
        console.error("Error checking moderation access:", error);
        redirect("/");
    }

    const analytics = await fetchAnalytics(authToken);

	return <StatisticsModerationPage initialAnalytics={analytics} authToken={authToken} />;
}