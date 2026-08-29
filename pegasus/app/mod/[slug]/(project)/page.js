import { cookies, headers } from "next/headers";
import ProjectPage from "@/components/pages/ProjectPage";
import { getLocale } from "next-intl/server";
import Script from "next/script";
import { getApplicationCategory, getProjectBySlug, getProjectMembersBySlug, recordProjectView } from "@/utils/projects/server";
import { getProjectMetadata } from "@/utils/projects/metadata";
import { getProjectBasePath } from "@/utils/projectRoutes";

export async function generateMetadata({ params }) {
    const { slug } = await params;
    const project = await getProjectBySlug(slug);

    return getProjectMetadata(project);
}

export default async function Page({ params }) {
    const { slug } = await params;

    const h = await headers();
    const xff = h.get("x-forwarded-for");
    const realIp = h.get("x-real-ip");
    const clientIp = (xff?.split(",")[0] || realIp || "").trim();

    const resolvedLocale = await getLocale();
    const cookieStore = await cookies();
    const authToken = cookieStore.get("authToken")?.value;
    const project = await getProjectBySlug(slug, authToken || "");
    const basePath = getProjectBasePath(project.project_type);
    const applicationCategory = getApplicationCategory(project.project_type);

    recordProjectView(slug, clientIp);

    const members = await getProjectMembersBySlug(slug, authToken || "");

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
                    "image": project.icon_url || "https://media.modifold.com/static/no-project-icon.svg",
                    "inLanguage": resolvedLocale,
                })}
            </Script>

            <link rel="alternate" hrefLang="x-default" href={`https://modifold.com${basePath}/${project.slug}`} />

            <ProjectPage project={{ ...project, members }} authToken={authToken} showInlineGallery={true} />
        </>
    );
}