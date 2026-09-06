import { redirect, forbidden } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import ProjectSettingsSidebar from "@/components/ui/ProjectSettingsSidebar";
import { getProjectSettingsForRequest } from "@/utils/projects/server";

export default async function Layout({ children, params }) {
    const { slug } = await params;
    const resolvedLocale = await getLocale();
    const tSettings = await getTranslations({ locale: resolvedLocale, namespace: "SettingsProjectPage" });
    const { project: settingsData, status } = await getProjectSettingsForRequest(slug);

    if(status === 401) {
        redirect("/");
    }

    if(status === 403) {
        forbidden();
    }
    
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
						collaborators: tSettings("sidebar.collaborators"),
                        description: tSettings("sidebar.description"),
						disclosures: tSettings("sidebar.disclosures"),
                        links: tSettings("sidebar.links"),
                        versions: tSettings("sidebar.versions"),
                        gallery: tSettings("sidebar.gallery"),
                        tags: tSettings("sidebar.tags"),
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