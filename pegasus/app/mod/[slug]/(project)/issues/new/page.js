import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import IssueCreatePage from "@/components/pages/IssueCreatePage";
import { getProjectBasePath } from "@/utils/projectRoutes";
import { getProjectForRequest } from "@/utils/projects/server";

const serverApiBase = process.env.API_BASE || process.env.NEXT_PUBLIC_API_BASE;

export async function generateMetadata({ params, searchParams }) {
    const { slug } = await params;
    const resolvedLocale = await getLocale();
    const tProject = await getTranslations({ locale: resolvedLocale, namespace: "ProjectPage" });
    const tIssues = await getTranslations({ locale: resolvedLocale, namespace: "Issues" });

	const { project } = await getProjectForRequest(slug);
    if(!project.issues_enabled) {
        return { title: tProject("metadata.notFound") };
    }

    const basePath = getProjectBasePath(project.project_type);
    const templateId = (await searchParams)?.template;

    return {
        title: templateId ? `${project.title} — ${tIssues("newIssue.createTitle")} — Modifold` : `${project.title} — ${tIssues("newIssue.createTitle")} — Modifold`,
        openGraph: {
            title: `${project.title} — ${tIssues("newIssue.createTitle")}`,
            url: `https://modifold.com${basePath}/${project.slug}/issues/new${templateId ? `?template=${encodeURIComponent(templateId)}` : ""}`,
        },
    };
}

export default async function Page({ params, searchParams }) {
    const { slug } = await params;
	const { project, authToken } = await getProjectForRequest(slug);
    const templateId = (await searchParams)?.template;

    if(!project.issues_enabled) {
        notFound();
    }

	const requestHeaders = {
		Accept: "application/json",
		...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
	};
	const [templatesRes, labelsRes] = await Promise.all([
		fetch(`${serverApiBase}/projects/${slug}/issues/templates`, {
			headers: requestHeaders,
			cache: "no-store",
		}),
		fetch(`${serverApiBase}/projects/${slug}/issues/labels`, {
			headers: requestHeaders,
			cache: "no-store",
		}),
	]);

    const templatesData = templatesRes.ok ? await templatesRes.json() : { templates: [] };
    const labelsData = labelsRes.ok ? await labelsRes.json() : { labels: [] };
    const template = templateId ? (templatesData.templates || []).find((item) => String(item.id) === String(templateId)) || null : null;

    return (
        <IssueCreatePage
            project={project}
            authToken={authToken}
            template={template}
            labels={labelsData.labels || []}
        />
    );
}