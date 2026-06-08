import { cookies } from "next/headers";
import { getLocale, getTranslations } from "next-intl/server";
import WikiPage from "@/components/pages/WikiPage";

const serverApiBase = process.env.API_BASE || process.env.NEXT_PUBLIC_API_BASE;

const formatWikiTitleFromSlug = (slug) => slug.split("-").filter(Boolean).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");

export async function generateMetadata({ params }) {
    const { slug, page_slug } = await params;
    const resolvedLocale = await getLocale();
    const t = await getTranslations({ locale: resolvedLocale, namespace: "ProjectPage" });

    const projectRes = await fetch(`${serverApiBase}/projects/${slug}`, {
        headers: { Accept: "application/json" },
        next: { revalidate: 60, tags: [`project:${slug}`] },
    });

    if(!projectRes.ok) {
        return { title: t("metadata.notFound") };
    }

    const project = await projectRes.json();
    let wikiPageTitle = formatWikiTitleFromSlug(page_slug);

    try {
        const wikiRes = await fetch(`${serverApiBase}/projects/${slug}/wiki/${encodeURIComponent(page_slug)}`, {
            headers: { Accept: "application/json" },
            cache: "no-store",
        });

        if(wikiRes.ok) {
            const wikiData = await wikiRes.json();
            wikiPageTitle = wikiData?.selected_page?.title || wikiPageTitle;
        }
    } catch {}

    return {
        title: `${wikiPageTitle} — ${project.title} Wiki — Modifold`,
        description: project.summary,
    };
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