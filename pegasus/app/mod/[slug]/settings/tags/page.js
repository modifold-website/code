const serverApiBase = process.env.API_BASE || process.env.NEXT_PUBLIC_API_BASE;

﻿import { cookies } from "next/headers";
import { getLocale, getTranslations } from "next-intl/server";
import TagsSettings from "@/components/project/settings/TagsSettings";
import { getProjectForRequest } from "@/utils/projects/server";

export async function generateMetadata({ params }) {
    const { slug } = await params;
    const resolvedLocale = await getLocale();
    const tSettings = await getTranslations({ locale: resolvedLocale, namespace: "SettingsProjectPage" });
	const { project } = await getProjectForRequest(slug);
    return { title: tSettings("metadata.title", { title: project.title }) };
}

export default async function Page({ params }) {
    const { slug } = await params;
    const resolvedLocale = await getLocale();
    const tNotFound = await getTranslations({ locale: resolvedLocale, namespace: "NotFound" });
    const cookieStore = await cookies();
    const authToken = cookieStore.get("authToken")?.value;
    let availableTags = [];

    const resProject = await fetch(`${serverApiBase}/projects/${slug}`, {
        headers: {
            Accept: "application/json",
            Authorization: authToken ? `Bearer ${authToken}` : undefined,
        },
    });

    if(!resProject.ok) {
        return (
            <div className="layout">
                <div className="view">
                    <div className="not-found-page__dummy">{tNotFound("message")}</div>
                </div>
            </div>
        );
    }

    const project = await resProject.json();

    try {
        const tagsResponse = await fetch(`${serverApiBase}/tags/${project.project_type}`, {
            next: { revalidate: 300 },
        });
        if(tagsResponse.ok) {
            const data = await tagsResponse.json();
            availableTags = Array.isArray(data?.tags) ? data.tags : [];
        }
    } catch (error) {
        console.error("Failed to fetch tags:", error);
    }

    return <TagsSettings project={project} authToken={authToken} availableTags={availableTags} />;
}