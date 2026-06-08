import { cookies } from "next/headers";
import { getLocale, getTranslations } from "next-intl/server";
import WikiPage from "@/components/pages/WikiPage";

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
    return {
        title: `${project.title} Wiki — Modifold`,
        description: project.summary,
    };
}

export default async function Page({ params }) {
    const { slug } = await params;
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
        const wikiRes = await fetch(`${serverApiBase}/projects/${slug}/wiki`, {
            headers: { Accept: "application/json" },
            cache: "no-store",
        });

        if(wikiRes.ok) {
            const wikiIndexData = await wikiRes.json();
            const firstPageSlug = wikiIndexData?.selected_page_slug || wikiIndexData?.pages?.[0]?.slug;

            if(firstPageSlug) {
                const firstPageRes = await fetch(`${serverApiBase}/projects/${slug}/wiki/${encodeURIComponent(firstPageSlug)}`, {
                    headers: { Accept: "application/json" },
                    cache: "no-store",
                });

                if(firstPageRes.ok) {
                    wikiData = await firstPageRes.json();
                } else {
                    wikiData = wikiIndexData;
                }
            } else {
                wikiData = wikiIndexData;
            }
        } else {
            wikiError = t("versionNotFound");
        }
    } catch {
        wikiError = t("errorOccurred");
    }

    return <WikiPage project={{ ...project, members }} authToken={authToken} wikiData={wikiData} wikiError={wikiError} />;
}