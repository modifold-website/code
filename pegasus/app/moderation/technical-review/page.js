import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import axios from "axios";
import TechnicalReviewPage from "@/components/pages/TechnicalReviewPage";

const serverApiBase = process.env.API_BASE || process.env.NEXT_PUBLIC_API_BASE;

export async function generateMetadata() {
	const resolvedLocale = await getLocale();
	const t = await getTranslations({ locale: resolvedLocale, namespace: "TechnicalReviewPage" });

	return {
		title: t("metadata.title"),
	};
}

async function fetchVersions(authToken) {
	try {
		const response = await axios.get(`${serverApiBase}/moderation/technical-review`, {
			headers: { Authorization: `Bearer ${authToken}` },
			params: {
				page: 1,
				limit: 20,
				status: "needs_review",
				sort: "oldest",
				search: "",
			},
		});

		return {
			versions: response.data.versions || [],
			totalPages: response.data.totalPages || 1,
		};
	} catch (error) {
		console.error("Error fetching versions for technical review:", error);
		return { versions: [], totalPages: 1 };
	}
}

export default async function TechnicalReviewServer() {
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
		console.error("Error checking technical review access:", error);
		redirect("/");
	}

	const { versions, totalPages } = await fetchVersions(authToken);

	return <TechnicalReviewPage authToken={authToken} initialVersions={versions} initialTotalPages={totalPages} />;
}