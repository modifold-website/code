import { getLocale, getTranslations } from "next-intl/server";
import DiscoverProjectsPage from "@/components/pages/discover/DiscoverProjectsPage";

const apiBase = process.env.API_BASE || process.env.NEXT_PUBLIC_API_BASE;

export const dynamic = "force-dynamic";

export async function generateMetadata() {
	const resolvedLocale = await getLocale();
	const t = await getTranslations({ locale: resolvedLocale, namespace: "pageTitle" });

	return {
		title: t("discover"),
	};
}

async function fetchDiscoverData() {
	try {
		const response = await fetch(`${apiBase}/v2/discover`, {
			next: { revalidate: 300 },
		});

		if(!response.ok) {
			console.error("Failed to fetch discover data:", response.status);
			return null;
		}

		return await response.json();
	} catch (error) {
		console.error("Failed to fetch discover data:", error);
		return null;
	}
}

export default async function DiscoverPage() {
	const data = await fetchDiscoverData();

	return <DiscoverProjectsPage data={data} />;
}