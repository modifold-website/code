import { serverApiFetch } from "@/utils/api/server";
const serverApiBase = process.env.API_BASE || process.env.NEXT_PUBLIC_API_BASE;

import { cookies } from "next/headers";
import { redirect, forbidden, unstable_rethrow } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import ModerationPage from "@/components/pages/ModerationPage";

export async function generateMetadata() {
    const resolvedLocale = await getLocale();
    const t = await getTranslations({ locale: resolvedLocale, namespace: "ModerationPage" });

    return {
        title: t("metadata.title"),
    };
}

async function fetchProjects(authToken) {
    try {
        const params = {
            search: "",
            type: undefined,
            sort: "oldest",
            page: 1,
            limit: 20,
        };

        const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value !== undefined));
        const response = await serverApiFetch(`${serverApiBase}/moderation?${query}`, {
            headers: { Authorization: `Bearer ${authToken}` },
            cache: "no-store",
        });
		if(!response.ok) {
			throw new Error(`Moderation API returned ${response.status}`);
		}
		const data = await response.json();

        return {
            projects: data.projects,
            totalPages: data.totalPages,
        };
    } catch (err) {
        console.error("Error fetching projects for moderation:", err);
        return { projects: [], totalPages: 1 };
    }
}

export default async function ModerationServer() {
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

    const { projects, totalPages } = await fetchProjects(authToken);
    return <ModerationPage authToken={authToken} initialProjects={projects} initialTotalPages={totalPages} />;
}