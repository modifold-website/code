import { serverApiFetch } from "@/utils/api/server";
import { getLocale, getTranslations } from "next-intl/server";
import WikiPage from "@/components/pages/WikiPage";
import { getProjectBasePath } from "@/utils/projectRoutes";
import { getProjectForRequest } from "@/utils/projects/server";
import { getProjectMetadata } from "@/utils/projects/metadata";

const serverApiBase = process.env.API_BASE || process.env.NEXT_PUBLIC_API_BASE;

export async function generateMetadata({ params }) {
    const { slug, page_slug } = await params;
	const { project } = await getProjectForRequest(slug);
    const basePath = getProjectBasePath(project.project_type);

    return getProjectMetadata(project, `${basePath}/${project.slug}/wiki/${page_slug}`);
}

export default async function Page({ params }) {
    const { slug, page_slug } = await params;
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
        const wikiRes = await serverApiFetch(`${serverApiBase}/projects/${slug}/wiki/${encodeURIComponent(page_slug)}`, {
			headers: requestHeaders,
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

	return <WikiPage project={project} authToken={authToken} wikiData={wikiData} wikiError={wikiError} />;
}