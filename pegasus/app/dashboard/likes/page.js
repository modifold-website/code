import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import DashboardLikesClient from "@/components/pages/DashboardLikesClient";

const serverApiBase = process.env.API_BASE || process.env.NEXT_PUBLIC_API_BASE;

export async function generateMetadata() {
	const resolvedLocale = await getLocale();
	const t = await getTranslations({ locale: resolvedLocale, namespace: "LikesDashboardClient" });

	return {
		title: t("metadata.title"),
		description: t("metadata.description"),
		openGraph: {
			title: t("metadata.title"),
			description: t("metadata.description"),
			url: "https://modifold.com/dashboard/likes",
		},
	};
}

export default async function DashboardLikesPage() {
	const cookieStore = await cookies();
	const authToken = cookieStore.get("authToken")?.value;

	if(!authToken) {
		redirect("/");
	}

	const initialPage = 1;
	const limit = 20;
	let projects = [];
	let totalPages = 1;

	try {
		const res = await fetch(`${serverApiBase}/users/me/likes?page=${initialPage}&limit=${limit}`, {
			headers: {
				Accept: "application/json",
				Authorization: `Bearer ${authToken}`,
			},
			cache: "no-store",
		});

		if(res.ok) {
			const data = await res.json();
			projects = data.projects || [];
			totalPages = data.totalPages || 1;
		}
	} catch (err) {
		console.error("Error fetching liked projects:", err);
	}

	return <DashboardLikesClient initialProjects={projects} initialTotalPages={totalPages} initialPage={initialPage} authToken={authToken} />;
}