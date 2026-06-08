import { cookies } from "next/headers";
import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import IssuesPage from "@/components/pages/IssuesPage";
import { getProjectBasePath } from "@/utils/projectRoutes";

const serverApiBase = process.env.API_BASE || process.env.NEXT_PUBLIC_API_BASE;

export async function generateMetadata({ params }) {
    const { slug } = await params;
    const resolvedLocale = await getLocale();
    const t = await getTranslations({ locale: resolvedLocale, namespace: "ProjectPage" });

    const res = await fetch(`${serverApiBase}/projects/${slug}`, {
        headers: { Accept: "application/json" },
        next: { revalidate: 60, tags: [`project:${slug}`] },
    });

    if(!res.ok) {
        return { title: t("metadata.notFound") };
    }

    const project = await res.json();
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
    const resolvedLocale = await getLocale();
    const t = await getTranslations({ locale: resolvedLocale, namespace: "ProjectPage" });
    const cookieStore = await cookies();
    const authToken = cookieStore.get("authToken")?.value;

    const status = (await searchParams)?.status || "open";
    const sort = (await searchParams)?.sort || "newest";
    const page = (await searchParams)?.page || "1";

    const projectFetchOptions = authToken ? {
        headers: {
            Accept: "application/json",
            Authorization: `Bearer ${authToken}`,
        },
        cache: "no-store",
    } : {
        headers: { Accept: "application/json" },
        next: { revalidate: 60, tags: [`project:${slug}`] },
    };

    let projectRes;
    try {
        projectRes = await fetch(`${serverApiBase}/projects/${slug}`, projectFetchOptions);
    } catch {
        return <div>{t("projectNotFound")}</div>;
    }

    if(!projectRes.ok) {
        return <div>{t("projectNotFound")}</div>;
    }

    const project = await projectRes.json();
    if(!project.issues_enabled) {
        notFound();
    }

    const issuesRes = await fetch(`${serverApiBase}/projects/${slug}/issues?status=${encodeURIComponent(status)}&sort=${encodeURIComponent(sort)}&page=${encodeURIComponent(page)}&limit=20`, {
        headers: {
            Accept: "application/json",
            Authorization: authToken ? `Bearer ${authToken}` : undefined,
        },
        cache: "no-store",
    });

    const templatesRes = await fetch(`${serverApiBase}/projects/${slug}/issues/templates`, {
        headers: { Accept: "application/json" },
        next: { revalidate: 60 },
    });

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