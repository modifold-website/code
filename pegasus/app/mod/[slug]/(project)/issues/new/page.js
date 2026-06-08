import { cookies } from "next/headers";
import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import IssueCreatePage from "@/components/pages/IssueCreatePage";
import { getProjectBasePath } from "@/utils/projectRoutes";

const serverApiBase = process.env.API_BASE || process.env.NEXT_PUBLIC_API_BASE;

export async function generateMetadata({ params, searchParams }) {
    const { slug } = await params;
    const resolvedLocale = await getLocale();
    const tProject = await getTranslations({ locale: resolvedLocale, namespace: "ProjectPage" });
    const tIssues = await getTranslations({ locale: resolvedLocale, namespace: "Issues" });

    const res = await fetch(`${serverApiBase}/projects/${slug}`, {
        headers: { Accept: "application/json" },
    });

    if(!res.ok) {
        return { title: tProject("metadata.notFound") };
    }

    const project = await res.json();
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
    const resolvedLocale = await getLocale();
    const tNotFound = await getTranslations({ locale: resolvedLocale, namespace: "NotFound" });
    const cookieStore = await cookies();
    const authToken = cookieStore.get("authToken")?.value;
    const templateId = (await searchParams)?.template;

    const resProject = await fetch(`${serverApiBase}/projects/${slug}`, {
        headers: {
            Accept: "application/json",
            Authorization: authToken ? `Bearer ${authToken}` : undefined,
        },
        cache: "no-store",
    });

    if(!resProject.ok) {
        return (
            <div className="layout">
                <div className="view">
                    <div className="not-found-page__dummy">{tNotFound("message")}</div>
                </div>
            </div>
        );
    }

    const project = await resProject.json();
    if(!project.issues_enabled) {
        notFound();
    }

    const templatesRes = await fetch(`${serverApiBase}/projects/${slug}/issues/templates`, {
        headers: {
            Accept: "application/json",
            Authorization: authToken ? `Bearer ${authToken}` : undefined,
        },
        cache: "no-store",
    });

    const labelsRes = await fetch(`${serverApiBase}/projects/${slug}/issues/labels`, {
        headers: {
            Accept: "application/json",
            Authorization: authToken ? `Bearer ${authToken}` : undefined,
        },
        cache: "no-store",
    });

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