const serverApiBase = process.env.API_BASE || process.env.NEXT_PUBLIC_API_BASE;

﻿import { cookies } from "next/headers";
import { getLocale, getTranslations } from "next-intl/server";
import VersionPage from "@/components/pages/VersionPage";
import { getProjectBasePath } from "@/utils/projectRoutes";

export async function generateMetadata({ params }) {
    const { slug, version_number } = await params;
    const resolvedLocale = await getLocale();
    const t = await getTranslations({ locale: resolvedLocale, namespace: "ProjectPage" });

    const res = await fetch(`${serverApiBase}/projects/${slug}/version/${version_number}`, {
        headers: { Accept: "application/json" },
    });

    if(!res.ok) {
        return { title: t("metadata.version.notFound") };
    }

    const version = await res.json();
    const projectRes = await fetch(`${serverApiBase}/projects/${slug}`, {
        headers: { Accept: "application/json" },
    });

    const project = projectRes.ok ? await projectRes.json() : {};
    const basePath = getProjectBasePath(project.project_type);
    const projectTitle = project.title || t("metadata.version.unknownProject");

    return {
        title: t("metadata.version.title", { version: version.version_number, project: projectTitle }),
        description: version.changelog || t("metadata.version.description", { version: version.version_number, project: projectTitle }),
        openGraph: {
            title: t("metadata.version.title", { version: version.version_number, project: projectTitle }),
            description: version.changelog || t("metadata.version.description", { version: version.version_number, project: projectTitle }),
            images: [project.icon_url || "https://media.modifold.com/static/no-project-icon.svg"],
            url: `https://modifold.com${basePath}/${slug}/version/${version_number}`,
        },
    };
}

export default async function Page({ params }) {
    const { slug, version_number } = await params;
    const resolvedLocale = await getLocale();
    const t = await getTranslations({ locale: resolvedLocale, namespace: "ProjectPage" });
    const cookieStore = await cookies();
    const authToken = cookieStore.get("authToken")?.value;

    const versionRes = await fetch(`${serverApiBase}/projects/${slug}/version/${version_number}`, {
        headers: {
            Accept: "application/json",
            Authorization: authToken ? `Bearer ${authToken}` : undefined,
        },
    });

    if(!versionRes.ok) {
        return <div>{t("versionNotFound")}</div>;
    }

    const version = await versionRes.json();

    const projectRes = await fetch(`${serverApiBase}/projects/${slug}`, {
        headers: {
            Accept: "application/json",
            Authorization: authToken ? `Bearer ${authToken}` : undefined,
        },
    });

    if(!projectRes.ok) {
        return <div>{t("projectNotFound")}</div>;
    }

    const project = await projectRes.json();

    const membersRes = await fetch(`${serverApiBase}/projects/${slug}/members`, {
        headers: { Accept: "application/json", Authorization: `Bearer ${authToken}` },
    });

    const members = membersRes.ok ? await membersRes.json() : [];

    return <VersionPage project={{ ...project, members }} version={version} authToken={authToken} />;
}