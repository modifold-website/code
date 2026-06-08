import ModJamCatalog from "@/components/mod-jams/ModJamCards";
import { cookies } from "next/headers";
import { getLocale, getTranslations } from "next-intl/server";

const serverApiBase = process.env.API_BASE || process.env.NEXT_PUBLIC_API_BASE;

export async function generateMetadata() {
	const resolvedLocale = await getLocale();
	const t = await getTranslations({ locale: resolvedLocale, namespace: "ModJamsPage" });

	return {
		title: t("metadata.title"),
		description: t("metadata.description"),
	};
}

export default async function ModJamsPage() {
	const cookieStore = await cookies();
	const authToken = cookieStore.get("authToken")?.value || "";
	let modJams = [];

	try {
		const [activeResponse, completedResponse] = await Promise.all([
			fetch(`${serverApiBase}/mod-jams?status=active`, {
				next: { revalidate: 60 },
			}),
			fetch(`${serverApiBase}/mod-jams?status=completed`, {
				next: { revalidate: 60 },
			}),
		]);

		const activeData = activeResponse.ok ? await activeResponse.json() : { mod_jams: [] };
		const completedData = completedResponse.ok ? await completedResponse.json() : { mod_jams: [] };
		modJams = [...(activeData.mod_jams || []), ...(completedData.mod_jams || [])];
	} catch (error) {
		console.error("Failed to fetch mod jams:", error);
	}

	return <ModJamCatalog initialJams={modJams} authToken={authToken} />;
}