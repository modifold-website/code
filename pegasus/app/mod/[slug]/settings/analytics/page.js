import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import ProjectAnalyticsSettingsPage from "@/components/project/settings/ProjectAnalyticsSettingsPage";
import { getProjectBasePath } from "@/utils/projectRoutes";

const serverApiBase = process.env.API_BASE || process.env.NEXT_PUBLIC_API_BASE;

const ALLOWED_TIME_RANGES = new Set(["3d", "7d", "30d", "90d"]);
const ONLINE_RANGE_DAYS = { "3d": 3, "7d": 7, "30d": 30, "90d": 90 };

const getNormalizedTimeRange = (value) => {
    const timeRange = Array.isArray(value) ? value[0] : value;
    return ALLOWED_TIME_RANGES.has(timeRange) ? timeRange : "7d";
};

async function fetchOnlineNow(slug) {
    const response = await fetch(`${serverApiBase}/analytics/${slug}/online-now`, {
        headers: { Accept: "application/json" },
        next: { revalidate: 60 },
    });

    return response;
}

async function fetchOnlineSeries(slug, days) {
    const response = await fetch(`${serverApiBase}/analytics/${slug}/chart/daily-joins?days=${days}`, {
        headers: { Accept: "application/json" },
        next: { revalidate: 60 },
    });

    return response;
}

async function fetchProjectAnalytics(slug, authToken, timeRange) {
    const response = await fetch(`${serverApiBase}/projects/${slug}/analytics?time_range=${timeRange}`, {
        headers: {
            Accept: "application/json",
            Authorization: `Bearer ${authToken}`,
        },
        next: { revalidate: 60 },
    });

    return response;
}


export async function generateMetadata({ params }) {
    const { slug } = await params;
    const resolvedLocale = await getLocale();
    const tProject = await getTranslations({ locale: resolvedLocale, namespace: "ProjectPage" });
    const tSettings = await getTranslations({ locale: resolvedLocale, namespace: "SettingsProjectPage" });

    const res = await fetch(`${serverApiBase}/projects/${slug}`, {
        headers: { Accept: "application/json" },
    });

    if(!res.ok) {
        return { title: tProject("metadata.notFound") };
    }

    const project = await res.json();
    return { title: tSettings("analytics.metadataTitle", { title: project.title }) };
}

export default async function Page({ params, searchParams }) {
    const { slug } = await params;
    const resolvedSearchParams = await searchParams;
    const requestedTimeRange = Array.isArray(resolvedSearchParams?.time_range) ? resolvedSearchParams.time_range[0] : resolvedSearchParams?.time_range;
    const timeRange = getNormalizedTimeRange(resolvedSearchParams?.time_range);
    const resolvedLocale = await getLocale();
    const tNotFound = await getTranslations({ locale: resolvedLocale, namespace: "NotFound" });
    const cookieStore = await cookies();
    const authToken = cookieStore.get("authToken")?.value;

    if(!authToken) {
        redirect("/");
    }

    const [projectResponse, analyticsResponse, onlineNowResponse, onlineSeriesResponse] = await Promise.all([
        fetch(`${serverApiBase}/projects/${slug}`, {
            headers: {
                Accept: "application/json",
                Authorization: authToken ? `Bearer ${authToken}` : undefined,
            },
            next: { revalidate: 60 },
        }),
        
        fetchProjectAnalytics(slug, authToken, timeRange),
        fetchOnlineNow(slug),
        fetchOnlineSeries(slug, ONLINE_RANGE_DAYS[timeRange] || 7),
    ]);

    if(!projectResponse.ok || !analyticsResponse.ok) {
        return (
            <div className="layout">
                <div className="view">
                    <div className="not-found-page__dummy">{tNotFound("message")}</div>
                </div>
            </div>
        );
    }

    const project = await projectResponse.json();
    const analytics = await analyticsResponse.json();
    const onlineNowPayload = onlineNowResponse.ok ? await onlineNowResponse.json() : null;
	const onlineSeriesPayload = onlineSeriesResponse.ok ? await onlineSeriesResponse.json() : null;
	const onlineSeries = Array.isArray(onlineSeriesPayload?.points) ? onlineSeriesPayload.points.map((point) => ({
		date: String(point.day || "").slice(0, 19),
		players: Number(point.players ?? point.joins) || 0,
		servers: Number(point.servers) || 0,
	})).filter((point) => Boolean(point.date)) : [];
	const onlineSummary = {
		playersOnlineNow: Number(onlineNowPayload?.playersOnlineNow ?? onlineNowPayload?.onlineNow) || 0,
		activeServersNow: Number(onlineNowPayload?.activeServersNow) || 0,
	};
	const basePath = getProjectBasePath(project.project_type);

    if(requestedTimeRange === "7d") {
        redirect(`${basePath}/${slug}/settings/analytics`);
    }

    return (
		<ProjectAnalyticsSettingsPage
			project={project}
			analytics={analytics}
			selectedTimeRange={timeRange}
			onlineSummary={onlineSummary}
			onlineSeries={onlineSeries}
		/>
	);
}