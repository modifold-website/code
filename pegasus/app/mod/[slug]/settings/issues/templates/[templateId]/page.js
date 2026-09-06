import { getLocale, getTranslations } from "next-intl/server";
import IssueTemplateEditorPage from "@/components/project/settings/IssueTemplateEditorPage";
import { getServerApiBase, serverApiFetch } from "@/utils/api/server";
import { getProjectForRequest } from "@/utils/projects/server";

const serverApiBase = getServerApiBase();

export async function generateMetadata({ params }) {
    const { slug, templateId } = await params;
    const resolvedLocale = await getLocale();
    const tIssues = await getTranslations({ locale: resolvedLocale, namespace: "IssueSettings" });
	const { project } = await getProjectForRequest(slug);
    return { title: `${project.title} — ${tIssues("template.editTitle")} #${templateId}` };
}

export default async function Page({ params }) {
    const { slug, templateId } = await params;
    const resolvedLocale = await getLocale();
    const tNotFound = await getTranslations({ locale: resolvedLocale, namespace: "NotFound" });
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
    const template = (templatesData.templates || []).find((item) => String(item.id) === String(templateId)) || null;

    if(!template) {
        return (
            <div className="layout">
                <div className="view">
                    <div className="not-found-page__dummy">{tNotFound("message")}</div>
                </div>
            </div>
        );
    }

    return (
        <IssueTemplateEditorPage
            project={project}
            authToken={authToken}
            labels={labelsData.labels || []}
            template={template}
        />
    );
}