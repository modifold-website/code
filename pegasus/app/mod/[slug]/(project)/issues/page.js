import { serverApiFetch } from "@/utils/api/server";
import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import IssuesPage from "@/components/pages/IssuesPage";
import { getProjectBasePath } from "@/utils/projectRoutes";
import { getProjectForRequest } from "@/utils/projects/server";

const serverApiBase = process.env.API_BASE || process.env.NEXT_PUBLIC_API_BASE;

export async function generateMetadata({ params }) {
    const { slug } = await params;
    const resolvedLocale = await getLocale();
    const t = await getTranslations({ locale: resolvedLocale, namespace: "ProjectPage" });

	const { project } = await getProjectForRequest(slug);
    if(!project.issues_enabled) {
        return { title: t("metadata.notFound") };
    }

    const basePath = getProjectBasePath(project.project_type);
    return {
        title: `${project.title} — Issues — Modifold`,
        description: project.summary,
        openGraph: {
            title: project.title,
            description: project.summary,
            images: [project.icon_url],
            url: `https://modifold.com${basePath}/${project.slug}/issues`,
        },
    };
}

export default async function Page({ params, searchParams }) {
    const { slug } = await params;
	const { project, authToken } = await getProjectForRequest(slug);

    const status = (await searchParams)?.status || "open";
    const sort = (await searchParams)?.sort || "newest";
    const page = (await searchParams)?.page || "1";

    if(!project.issues_enabled) {
        notFound();
    }

	const requestHeaders = {
		Accept: "application/json",
		...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
	};
	const [issuesRes, templatesRes] = await Promise.all([
		serverApiFetch(`${serverApiBase}/projects/${slug}/issues?status=${encodeURIComponent(status)}&sort=${encodeURIComponent(sort)}&page=${encodeURIComponent(page)}&limit=20`, {
			headers: requestHeaders,
			cache: "no-store",
		}),
		serverApiFetch(`${serverApiBase}/projects/${slug}/issues/templates`, {
			headers: requestHeaders,
			cache: "no-store",
		}),
	]);

    const issuesData = issuesRes.ok ? await issuesRes.json() : { issues: [], openCount: 0, closedCount: 0, totalPages: 1, page: 1 };
    const templatesData = templatesRes.ok ? await templatesRes.json() : { templates: [] };

    return (
        <IssuesPage
            project={project}
            initialIssues={{ ...issuesData, status, sort }}
            templates={templatesData.templates || []}
        />
    );
}