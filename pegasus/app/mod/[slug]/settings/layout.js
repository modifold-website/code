import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import ProjectSettingsSidebar from "@/components/ui/ProjectSettingsSidebar";

const serverApiBase = process.env.API_BASE || process.env.NEXT_PUBLIC_API_BASE;

export default async function Layout({ children, params }) {
    const { slug } = await params;
    const resolvedLocale = await getLocale();
    const tNotFound = await getTranslations({ locale: resolvedLocale, namespace: "NotFound" });
    const tSettings = await getTranslations({ locale: resolvedLocale, namespace: "SettingsProjectPage" });
    const cookieStore = await cookies();
    const authToken = cookieStore.get("authToken")?.value;

    if(!authToken) {
        redirect("/");
    }

    const res = await fetch(`${serverApiBase}/projects/${slug}/settings`, {
        headers: {
            Accept: "application/json",
            Authorization: `Bearer ${authToken}`,
        },
        cache: "no-store",
    });

    if(res.status === 401 || res.status === 403) {
        redirect("/403");
    }

    if(!res.ok) {
        return (
            <div className="layout">
                <div className="view">
                    <div className="not-found-page__dummy">{tNotFound("message")}</div>
                </div>
            </div>
        );
    }

    const settingsData = await res.json();
    const project = {
        ...settingsData,
        organization: settingsData?.organization || null,
    };

    return (
        <div className="layout">
            <div className="page-content settings-page">
                <ProjectSettingsSidebar
                    project={project}
                    iconAlt={tSettings("general.iconAlt")}
                    labels={{
                        general: tSettings("sidebar.general"),
                        description: tSettings("sidebar.description"),
                        links: tSettings("sidebar.links"),
                        versions: tSettings("sidebar.versions"),
                        gallery: tSettings("sidebar.gallery"),
                        tags: tSettings("sidebar.tags"),
                        license: tSettings("sidebar.license"),
                        analytics: tSettings("sidebar.analytics"),
                        issues: tSettings("sidebar.issues"),
                        moderation: tSettings("sidebar.moderation"),
                    }}
                />

                {children}
            </div>
        </div>
    );
}