const serverApiBase = process.env.API_BASE || process.env.NEXT_PUBLIC_API_BASE;

﻿import { cookies, headers } from "next/headers";
import { notFound } from "next/navigation";
import ProjectPage from "@/components/pages/ProjectPage";
import { getLocale } from "next-intl/server";
import Script from "next/script";
import { getProjectBasePath } from "@/utils/projectRoutes";

export async function generateMetadata({ params }) {
    const { slug } = await params;

    const res = await fetch(`${serverApiBase}/projects/${slug}`, {
        headers: { Accept: "application/json" },
        next: { revalidate: 60, tags: [`project:${slug}`] },
    });

    if(!res.ok) {
        notFound();
    }

    const project = await res.json();
    const basePath = getProjectBasePath(project.project_type);
    const projectTypeTitle = project.project_type === "modpack" ? "Hytale Modpack" : "Hytale Mod";

    const description = project.summary.length > 160 ? `${project.summary.substring(0, 157)}...` : project.summary;

    return {
        title: `${project.title} — ${projectTypeTitle} — Modifold`,
        description,
        keywords: `${project.title}, Hytale, mods, shaders, resource packs, modpacks, download mods Hytale, Modifold`,
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
                    url: project.icon_url || "https://media.modifold.com/static/no-project-icon.svg",
                    width: 1200,
                    height: 630,
                    alt: `${project.title} Hytale Mod`,
                },
            ],
            url: `https://modifold.com${basePath}/${project.slug}`,
            type: "website",
            locale: "en_US",
        },
        twitter: {
            card: "summary_large_image",
            title: `${project.title} — ${projectTypeTitle} — Modifold`,
            description,
            images: [project.icon_url || "https://media.modifold.com/static/no-project-icon.svg"],
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

    let res;
    try {
        res = await fetch(`${serverApiBase}/projects/${slug}`, projectFetchOptions);
    } catch {
        notFound();
    }

    if(!res.ok) {
        notFound();
    }

    const project = await res.json();
    const basePath = getProjectBasePath(project.project_type);

    fetch(`${serverApiBase}/projects/${slug}/view`, {
        method: "POST",
        headers: {
            ...(clientIp ? { "x-forwarded-for": clientIp } : {}),
        },
        cache: "no-store",
    }).catch(console.error);

    let members = [];
    try {
        const membersRes = await fetch(`${serverApiBase}/projects/${slug}/members`, membersFetchOptions);
        if(membersRes.ok) {
            members = await membersRes.json();
        }
    } catch {}

    return (
        <>
            <Script id="schema-markup" type="application/ld+json">
                {JSON.stringify({
                    "@context": "https://schema.org",
                    "@type": "SoftwareApplication",
                    "name": project.title,
                    "applicationCategory": project.project_type === "mod" ? "Game Mod" : project.project_type.replace("_", " ").replace(/\b\w/g, l => l.toUpperCase()),
                    "operatingSystem": "Hytale",
                    "author": { "@type": "Person", "name": project.owner.username },
                    "description": project.summary,
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