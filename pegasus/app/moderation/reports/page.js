import { serverApiFetch } from "@/utils/api/server";
import { cookies } from "next/headers";
import { redirect, forbidden, unstable_rethrow } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import ReportsModerationPage from "@/components/pages/ReportsModerationPage";

const serverApiBase = process.env.API_BASE || process.env.NEXT_PUBLIC_API_BASE;

export async function generateMetadata() {
    const resolvedLocale = await getLocale();
    const t = await getTranslations({ locale: resolvedLocale, namespace: "ReportsModerationPage" });

    return {
        title: t("metadata.title"),
    };
}

async function fetchReports(authToken) {
    try {
        const query = new URLSearchParams({
			page: "1",
			limit: "20",
			status: "open",
			reason: "all",
			sort: "newest",
			search: "",
		});
        const response = await serverApiFetch(`${serverApiBase}/moderation/reports?${query}`, {
            headers: { Authorization: `Bearer ${authToken}` },
            cache: "no-store",
        });
		if(!response.ok) {
			throw new Error(`Moderation reports API returned ${response.status}`);
		}
		const data = await response.json();

        return {
            reports: data.reports || [],
            totalPages: data.totalPages || 1,
        };
    } catch (error) {
        console.error("Error fetching reports for moderation:", error);
        return { reports: [], totalPages: 1 };
    }
}

export default async function ReportsModerationServer() {
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

    const { reports, totalPages } = await fetchReports(authToken);

    return <ReportsModerationPage authToken={authToken} initialReports={reports} initialTotalPages={totalPages} />;
}