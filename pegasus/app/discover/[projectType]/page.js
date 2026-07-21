import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import DiscoverProjectsPage from "@/components/pages/discover/DiscoverProjectsPage";

const apiBase = process.env.API_BASE || process.env.NEXT_PUBLIC_API_BASE;
const PROJECT_TYPES = {
	mods: "mod",
	worlds: "world",
	modpacks: "modpack",
};

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }) {
	const resolvedParams = await params;
	const projectType = PROJECT_TYPES[resolvedParams?.projectType];

	if(!projectType) {
		return {};
	}

	const resolvedLocale = await getLocale();
	const t = await getTranslations({ locale: resolvedLocale, namespace: "pageTitle" });

	return {
		title: t(resolvedParams.projectType),
	};
}

async function fetchDiscoverData(projectType) {
	try {
		const response = await fetch(`${apiBase}/v2/discover/${projectType}`, {
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

export default async function DiscoverProjectTypePage({ params }) {
	const resolvedParams = await params;
	const projectType = PROJECT_TYPES[resolvedParams?.projectType];

	if(!projectType) {
		notFound();
	}

	const data = await fetchDiscoverData(projectType);

	return <DiscoverProjectsPage data={data} projectType={projectType} />;
}