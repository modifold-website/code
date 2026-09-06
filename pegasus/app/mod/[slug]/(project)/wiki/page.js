import { serverApiFetch } from "@/utils/api/server";
import { getLocale, getTranslations } from "next-intl/server";
import WikiPage from "@/components/pages/WikiPage";
import { getProjectBasePath } from "@/utils/projectRoutes";
import { getProjectForRequest } from "@/utils/projects/server";
import { getProjectMetadata } from "@/utils/projects/metadata";

const serverApiBase = process.env.API_BASE || process.env.NEXT_PUBLIC_API_BASE;

export async function generateMetadata({ params }) {
    const { slug } = await params;
	const { project } = await getProjectForRequest(slug);
    const basePath = getProjectBasePath(project.project_type);

    return getProjectMetadata(project, `${basePath}/${project.slug}/wiki`, { titleSuffix: "Wiki" });
}

export default async function Page({ params }) {
    const { slug } = await params;
    const resolvedLocale = await getLocale();
    const t = await getTranslations({ locale: resolvedLocale, namespace: "ProjectPage" });
	const { project, authToken } = await getProjectForRequest(slug);
	const requestHeaders = {
		Accept: "application/json",
		...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
	};

    let wikiData = null;
    let wikiError = null;

    try {
        const wikiRes = await serverApiFetch(`${serverApiBase}/projects/${slug}/wiki`, {
			headers: requestHeaders,
            cache: "no-store",
        });

        if(wikiRes.ok) {
            const wikiIndexData = await wikiRes.json();
            const firstPageSlug = wikiIndexData?.selected_page_slug || wikiIndexData?.pages?.[0]?.slug;

            if(firstPageSlug) {
                const firstPageRes = await serverApiFetch(`${serverApiBase}/projects/${slug}/wiki/${encodeURIComponent(firstPageSlug)}`, {
					headers: requestHeaders,
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

	return <WikiPage project={project} authToken={authToken} wikiData={wikiData} wikiError={wikiError} />;
}