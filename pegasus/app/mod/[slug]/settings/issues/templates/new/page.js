import { getLocale, getTranslations } from "next-intl/server";
import IssueTemplateEditorPage from "@/components/project/settings/IssueTemplateEditorPage";
import { getServerApiBase, serverApiFetch } from "@/utils/api/server";
import { getProjectForRequest } from "@/utils/projects/server";

const serverApiBase = getServerApiBase();

export async function generateMetadata({ params }) {
    const { slug } = await params;
    const resolvedLocale = await getLocale();
    const tIssues = await getTranslations({ locale: resolvedLocale, namespace: "IssueSettings" });
	const { project } = await getProjectForRequest(slug);
    return { title: `${project.title} — ${tIssues("template.createTitle")}` };
}

export default async function Page({ params }) {
    const { slug } = await params;
    const { project, authToken } = await getProjectForRequest(slug);

    const labelsRes = await serverApiFetch(`${serverApiBase}/projects/${slug}/issues/labels?include_archived=true`, {
        headers: {
            Accept: "application/json",
            Authorization: authToken ? `Bearer ${authToken}` : undefined,
        },
        cache: "no-store",
    });

    const labelsData = labelsRes.ok ? await labelsRes.json() : { labels: [] };

    return (
        <IssueTemplateEditorPage
            project={project}
            authToken={authToken}
            labels={labelsData.labels || []}
        />
    );
}