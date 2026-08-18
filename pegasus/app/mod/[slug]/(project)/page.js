import { cookies, headers } from "next/headers";
import ProjectPage from "@/components/pages/ProjectPage";
import { getLocale } from "next-intl/server";
import Script from "next/script";
import { getApplicationCategory, getProjectBySlug, getProjectMembersBySlug, getProjectTypeTitle, recordProjectView } from "@/utils/projects/server";
import { getProjectBasePath } from "@/utils/projectRoutes";

export async function generateMetadata({ params }) {
    const { slug } = await params;
    const project = await getProjectBySlug(slug);
    const basePath = getProjectBasePath(project.project_type);
    const projectTypeTitle = getProjectTypeTitle(project.project_type);
    const summary = project.summary || "";
    const description = summary.length > 160 ? `${summary.substring(0, 157)}...` : summary;
    const iconImage = project.icon_url || "https://media.modifold.com/static/no-project-icon.svg";

    return {
        title: `${project.title} — ${projectTypeTitle} — Modifold`,
        description,
        keywords: `${project.title}, Hytale, mods, shaders, resource packs, modpacks, worlds, maps, download Hytale maps, Modifold`,
        author: project.owner.username,
        robots: "index, follow",
        alternates: {
            canonical: `https://modifold.com${basePath}/${project.slug}`,
            "x-default": `https://modifold.com${basePath}/${project.slug}`,
        },
        openGraph: {
            title: `${project.title} — ${projectTypeTitle} — Modifold`,
            description,
            images: [
                {
                    url: iconImage,
                    alt: `${project.title} ${projectTypeTitle}`,
                },
            ],
            url: `https://modifold.com${basePath}/${project.slug}`,
            type: "website",
            locale: "en_US",
        },
        twitter: {
            card: "summary",
            title: `${project.title} — ${projectTypeTitle} — Modifold`,
            description,
            images: [iconImage],
        },
    };
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