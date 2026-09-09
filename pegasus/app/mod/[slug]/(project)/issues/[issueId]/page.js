import { serverApiFetch } from "@/utils/api/server";
import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import IssueDetailPage from "@/components/pages/IssueDetailPage";
import { getProjectBasePath } from "@/utils/projectRoutes";
import { getProjectForRequest } from "@/utils/projects/server";

const serverApiBase = process.env.API_BASE || process.env.NEXT_PUBLIC_API_BASE;

export async function generateMetadata({ params }) {
    const { slug, issueId } = await params;
    const resolvedLocale = await getLocale();
    const t = await getTranslations({ locale: resolvedLocale, namespace: "ProjectPage" });

	const { project } = await getProjectForRequest(slug);
    if(!project.issues_enabled) {
        return { title: t("metadata.notFound") };
    }

    const basePath = getProjectBasePath(project.project_type);
    return {
        title: `${project.title} — Issue #${issueId} — Modifold`,
        description: project.summary,
        openGraph: {
            title: `${project.title} — Issue #${issueId} — Modifold`,
            description: project.summary,
            images: [project.icon_url],
            url: `https://modifold.com${basePath}/${project.slug}/issues/${issueId}`,
        },
    };
}

export default async function Page({ params }) {
    const { slug, issueId } = await params;
    const resolvedLocale = await getLocale();
    const t = await getTranslations({ locale: resolvedLocale, namespace: "ProjectPage" });
	const { project, authToken } = await getProjectForRequest(slug);
    if(!project.issues_enabled) {
        notFound();
    }

    const issueRes = await serverApiFetch(`${serverApiBase}/projects/${slug}/issues/${issueId}`, {
        headers: {
            Accept: "application/json",
			...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        cache: "no-store",
    });

    if(!issueRes.ok) {
        return <div>{t("projectNotFound")}</div>;
    }

    const issueData = await issueRes.json();

    return (
        <IssueDetailPage
            project={project}
            authToken={authToken}
            initialIssue={issueData.issue}
            initialComments={issueData.comments}
            initialEvents={issueData.events}
            initialCanManage={issueData.canManage}
            initialAvailableLabels={issueData.availableLabels}
        />
    );
}