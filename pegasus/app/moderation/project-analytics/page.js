import { cookies } from "next/headers";
import { forbidden, redirect, unstable_rethrow } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { serverApiFetch } from "@/utils/api/server";
import ProjectAnalyticsModerationPage from "@/components/pages/ProjectAnalyticsModerationPage";
import { defaultDateRange } from "@/utils/moderation/projectAnalytics";

export async function generateMetadata() {
	const t = await getTranslations("ModerationProjectAnalytics");

	return {
		title: `${t("title")} — Modifold`,
		robots: {
			index: false,
			follow: false
		}
	};
}

export default async function ProjectAnalyticsModerationServer() {
	const cookieStore = await cookies();
	const authToken = cookieStore.get("authToken")?.value;
	if(!authToken) {
		forbidden();
	}

	try {
		const apiBase = process.env.API_BASE || process.env.NEXT_PUBLIC_API_BASE;
		const response = await serverApiFetch(`${apiBase}/auth/user`, {
			headers: { Authorization: `Bearer ${authToken}` },
			cache: "no-store",
		});

		if(!response.ok) {
			redirect("/");
		}

		const { user } = await response.json();
		if(user?.isRole !== "admin" && user?.isRole !== "moderator") {
			forbidden();
		}
	} catch(error) {
		unstable_rethrow(error);
		redirect("/");
	}
	
	return <ProjectAnalyticsModerationPage authToken={authToken} initialRange={defaultDateRange()} />;
}