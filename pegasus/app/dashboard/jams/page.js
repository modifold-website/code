import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import ModJamsDashboardPage from "@/components/mod-jams/ModJamsDashboardPage";

const serverApiBase = process.env.API_BASE || process.env.NEXT_PUBLIC_API_BASE;

export async function generateMetadata() {
	const resolvedLocale = await getLocale();
	const t = await getTranslations({ locale: resolvedLocale, namespace: "ModJamsDashboard" });

	return {
		title: `${t("title")} — Modifold`,
	};
}

export default async function DashboardJamsRoute() {
	const cookieStore = await cookies();
	const authToken = cookieStore.get("authToken")?.value;

	if(!authToken) {
		redirect("/403");
	}

	let modJams = [];
	try {
		const response = await fetch(`${serverApiBase}/mod-jams/mine`, {
			headers: {
				Authorization: `Bearer ${authToken}`,
				Accept: "application/json",
			},
			cache: "no-store",
		});

		if(response.ok) {
			const data = await response.json();
			modJams = Array.isArray(data?.mod_jams) ? data.mod_jams : [];
		}
	} catch (error) {
		console.error("Error fetching user mod jams:", error);
	}

	return <ModJamsDashboardPage authToken={authToken} initialJams={modJams} />;
}