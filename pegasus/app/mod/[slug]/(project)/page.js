import { headers } from "next/headers";
import ProjectPage from "@/components/pages/ProjectPage";
import { getLocale } from "next-intl/server";
import Script from "next/script";
import { getApplicationCategory, getProjectForRequest, recordProjectView } from "@/utils/projects/server";
import { getProjectMetadata } from "@/utils/projects/metadata";
import { getProjectBasePath } from "@/utils/projectRoutes";
import { getPrefabPreviewBySlug } from "@/utils/prefabs/server";

export async function generateMetadata({ params }) {
	const { slug } = await params;
	const { project } = await getProjectForRequest(slug);

    return getProjectMetadata(project);
}

export default async function Page({ params }) {
    const { slug } = await params;

    const h = await headers();
    const xff = h.get("x-forwarded-for");
    const realIp = h.get("x-real-ip");
    const clientIp = (xff?.split(",")[0] || realIp || "").trim();

    const resolvedLocale = await getLocale();
	const { project, authToken } = await getProjectForRequest(slug);
    const basePath = getProjectBasePath(project.project_type);
    const applicationCategory = getApplicationCategory(project.project_type);

    recordProjectView(slug, clientIp);

	const prefabPreview = project.project_type === "prefab" ? await getPrefabPreviewBySlug(slug) : null;

    return (
        <>
            <Script id="schema-markup" type="application/ld+json">
                {JSON.stringify({
                    "@context": "https://schema.org",
                    "@type": "SoftwareApplication",
                    "name": project.title,
                    "applicationCategory": applicationCategory,
                    "operatingSystem": "Hytale",
                    "author": {
                        "@type": project.owner?.type === "organization" ? "Organization" : "Person",
                        "name": project.owner.username,
                        "url": `https://modifold.com${project.owner?.profile_url || `/user/${project.owner.slug}`}`,
                    },
                    "description": project.summary,
                    "datePublished": project.created_at,
                    "url": `https://modifold.com${basePath}/${project.slug}`,
                    "image": project.icon_url || "https://cdn.modifold.com/static/no-project-icon.svg",
                    "inLanguage": resolvedLocale,
                })}
            </Script>

            <link rel="alternate" hrefLang="x-default" href={`https://modifold.com${basePath}/${project.slug}`} />

			<ProjectPage project={project} authToken={authToken} showInlineGallery={true} prefabPreview={prefabPreview} />
        </>
    );
}