const serverApiBase = process.env.API_BASE || process.env.NEXT_PUBLIC_API_BASE;

﻿import { cookies } from "next/headers";
import { getLocale, getTranslations } from "next-intl/server";
import VersionsPage from "@/components/pages/VersionsPage";
import { getProjectBasePath } from "@/utils/projectRoutes";
import { fetchGameVersions } from "@/utils/gameVersions";
import { getProjectBySlug, getProjectMembersBySlug } from "@/utils/projects/server";

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
    const basePath = getProjectBasePath(project.project_type);
    return {
        title: `${project.title} — Modifold`,
        description: project.summary,
        openGraph: {
            title: project.title,
            description: project.summary,
            images: [project.icon_url],
            url: `https://modifold.com${basePath}/${project.slug}/versions`,
        },
    };
}

export default async function Page({ params }) {
    const { slug } = await params;
    const cookieStore = await cookies();
    const authToken = cookieStore.get("authToken")?.value;

    const project = await getProjectBySlug(slug, authToken || "");
    const members = await getProjectMembersBySlug(slug, authToken || "");

    const gameVersions = await fetchGameVersions();

    return <VersionsPage project={{ ...project, members }} authToken={authToken} gameVersions={gameVersions} />;
}