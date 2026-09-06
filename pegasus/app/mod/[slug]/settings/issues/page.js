import { getLocale, getTranslations } from "next-intl/server";
import IssuesSettings from "@/components/project/settings/IssuesSettings";
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
    const { project, authToken } = await getProjectForRequest(slug);

    const templatesRequest = serverApiFetch(`${serverApiBase}/projects/${slug}/issues/templates?include_archived=true`, {
        headers: {
            Accept: "application/json",
            Authorization: authToken ? `Bearer ${authToken}` : undefined,
        },
        cache: "no-store",
    });

    const labelsRequest = serverApiFetch(`${serverApiBase}/projects/${slug}/issues/labels?include_archived=true`, {
        headers: {
            Accept: "application/json",
            Authorization: authToken ? `Bearer ${authToken}` : undefined,
        },
        cache: "no-store",
    });
	const [templatesRes, labelsRes] = await Promise.all([templatesRequest, labelsRequest]);

    const templatesData = templatesRes.ok ? await templatesRes.json() : { templates: [] };
    const labelsData = labelsRes.ok ? await labelsRes.json() : { labels: [] };

    return (
        <IssuesSettings
            project={project}
            authToken={authToken}
            initialTemplates={templatesData.templates || []}
            initialLabels={labelsData.labels || []}
        />
    );
}