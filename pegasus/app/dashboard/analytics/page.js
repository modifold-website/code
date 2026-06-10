import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import DashboardAnalyticsPage from "@/components/pages/DashboardAnalyticsPage";

const serverApiBase = process.env.API_BASE || process.env.NEXT_PUBLIC_API_BASE;

const isValidDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));

const getSearchValue = (value) => Array.isArray(value) ? value[0] : value;

const getDefaultDateRange = () => {
	const endDate = new Date();
	endDate.setUTCHours(0, 0, 0, 0);
	const startDate = new Date(endDate);
	startDate.setUTCMonth(endDate.getUTCMonth() - 1);

	return {
		from: startDate.toISOString().slice(0, 10),
		to: endDate.toISOString().slice(0, 10),
	};
};

export async function generateMetadata() {
	const resolvedLocale = await getLocale();
	const t = await getTranslations({ locale: resolvedLocale, namespace: "DashboardAnalyticsPage" });

	return {
		title: t("metadata.title"),
		description: t("metadata.description"),
		openGraph: {
			title: t("metadata.title"),
			description: t("metadata.description"),
			url: "https://modifold.com/dashboard/analytics",
		},
	};
}

export default async function DashboardAnalyticsRoute({ searchParams }) {
	const resolvedSearchParams = await searchParams;
	const defaultRange = getDefaultDateRange();
	const fromParam = getSearchValue(resolvedSearchParams?.from);
	const toParam = getSearchValue(resolvedSearchParams?.to);
	const projectIdsParam = getSearchValue(resolvedSearchParams?.project_ids);
	const from = isValidDate(fromParam) ? fromParam : defaultRange.from;
	const to = isValidDate(toParam) ? toParam : defaultRange.to;
	const cookieStore = await cookies();
	const authToken = cookieStore.get("authToken")?.value;

	if(!authToken) {
		redirect("/");
	}

	let analytics = null;

	try {
		const params = new URLSearchParams({ from, to });
		if(projectIdsParam) {
			params.set("project_ids", projectIdsParam);
		}

		const response = await fetch(`${serverApiBase}/analytics/user?${params.toString()}`, {
			headers: {
				Accept: "application/json",
				Authorization: `Bearer ${authToken}`,
			},
			next: { revalidate: 60 },
		});

		if(response.ok) {
			analytics = await response.json();
		}
	} catch (error) {
		console.error("Error fetching dashboard analytics:", error);
	}

	return (
		<DashboardAnalyticsPage
			initialAnalytics={analytics}
			initialFrom={from}
			initialTo={to}
			initialProjectIds={projectIdsParam || ""}
		/>
	);
}