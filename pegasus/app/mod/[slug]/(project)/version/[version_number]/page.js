import { cookies } from "next/headers";
import { getLocale, getTranslations } from "next-intl/server";
import VersionPage from "@/components/pages/VersionPage";
import { getProjectBasePath } from "@/utils/projectRoutes";
import { fetchGameVersionItems } from "@/utils/gameVersions";
import { getProjectBySlug, getProjectMembersBySlug } from "@/utils/projects/server";
import { getProjectMetadata } from "@/utils/projects/metadata";

const serverApiBase = process.env.API_BASE || process.env.NEXT_PUBLIC_API_BASE;

export async function generateMetadata({ params }) {
    const { slug, version_number } = await params;
    const [project, versionRes] = await Promise.all([
        getProjectBySlug(slug),
        fetch(`${serverApiBase}/projects/${slug}/version/${version_number}`, {
            headers: { Accept: "application/json" },
        }),
    ]);
    const basePath = getProjectBasePath(project.project_type);
    const version = versionRes.ok ? await versionRes.json() : null;
    const versionNumber = typeof version?.version_number === "string" ? version.version_number.trim() : "";

    return getProjectMetadata(project, `${basePath}/${project.slug}/version/${version_number}`, {
        title: versionNumber ? `${versionNumber} — ${project.title} — Modifold` : undefined,
    });
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

    const project = await getProjectBySlug(slug, authToken || "");
    const members = await getProjectMembersBySlug(slug, authToken || "");
    const settingsAccessRes = authToken ? await fetch(`${serverApiBase}/projects/${slug}/settings`, {
        headers: {
            Accept: "application/json",
            Authorization: `Bearer ${authToken}`,
        },
    }) : null;
    const canEditVersion = Boolean(settingsAccessRes?.ok);

    const gameVersions = await fetchGameVersionItems();

    return <VersionPage project={{ ...project, members }} version={version} authToken={authToken} gameVersions={gameVersions} canEditVersion={canEditVersion} />;
}