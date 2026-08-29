import { cookies } from "next/headers";
import { getLocale, getTranslations } from "next-intl/server";
import WikiPage from "@/components/pages/WikiPage";
import { getProjectBasePath } from "@/utils/projectRoutes";
import { getProjectBySlug } from "@/utils/projects/server";
import { getProjectMetadata } from "@/utils/projects/metadata";

const serverApiBase = process.env.API_BASE || process.env.NEXT_PUBLIC_API_BASE;

export async function generateMetadata({ params }) {
    const { slug, page_slug } = await params;
    const project = await getProjectBySlug(slug);
    const basePath = getProjectBasePath(project.project_type);

    return getProjectMetadata(project, `${basePath}/${project.slug}/wiki/${page_slug}`);
}

export default async function Page({ params }) {
    const { slug, page_slug } = await params;
    const resolvedLocale = await getLocale();
    const t = await getTranslations({ locale: resolvedLocale, namespace: "ProjectPage" });
    const cookieStore = await cookies();
    const authToken = cookieStore.get("authToken")?.value;

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

    const membersFetchOptions = authToken ? {
        headers: {
            Accept: "application/json",
            Authorization: `Bearer ${authToken}`,
        },
        cache: "no-store",
    } : {
        headers: { Accept: "application/json" },
        next: { revalidate: 60, tags: [`project:${slug}:members`] },
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

    let members = [];
    try {
        const membersRes = await fetch(`${serverApiBase}/projects/${slug}/members`, membersFetchOptions);
        if(membersRes.ok) {
            members = await membersRes.json();
        }
    } catch {}

    let wikiData = null;
    let wikiError = null;

    try {
        const wikiRes = await fetch(`${serverApiBase}/projects/${slug}/wiki/${encodeURIComponent(page_slug)}`, {
            headers: { Accept: "application/json" },
            cache: "no-store",
        });

        if(wikiRes.ok) {
            wikiData = await wikiRes.json();
        } else {
            wikiError = t("versionNotFound");
        }
    } catch {
        wikiError = t("errorOccurred");
    }

    return <WikiPage project={{ ...project, members }} authToken={authToken} wikiData={wikiData} wikiError={wikiError} />;
}