import { getLocale, getTranslations } from "next-intl/server";
import ModerationProjectPage from "@/components/project/settings/ModerationProjectPage";
import { getServerApiBase, serverApiFetch } from "@/utils/api/server";
import { getProjectForRequest } from "@/utils/projects/server";

const serverApiBase = getServerApiBase();

export async function generateMetadata({ params }) {
    const { slug } = await params;
    const resolvedLocale = await getLocale();
    const tSettings = await getTranslations({ locale: resolvedLocale, namespace: "SettingsProjectPage" });
	const { project } = await getProjectForRequest(slug);
    return { title: tSettings("metadata.title", { title: project.title }) };
}

export default async function Page({ params }) {
    const { slug } = await params;
    const { project, authToken } = await getProjectForRequest(slug, 100);

    let initialModerationHistory = [];

    try {
        const historyRes = await serverApiFetch(`${serverApiBase}/projects/${slug}/moderation-history`, {
            headers: {
                Accept: "application/json",
                Authorization: `Bearer ${authToken}`,
            },
            cache: "no-store",
        });

        if(historyRes.ok) {
            const historyData = await historyRes.json();
            if(Array.isArray(historyData?.history)) {
                initialModerationHistory = historyData.history;
            }
        }
    } catch {}

    return <ModerationProjectPage project={project} authToken={authToken} initialModerationHistory={initialModerationHistory} />;
}