"use client";

import { useState } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import Link from "next/link";
import { getProjectPath } from "@/utils/projectRoutes";
import { useTranslations } from "next-intl";
import OrganizationSettingsSidebar from "@/components/organizations/settings/OrganizationSettingsSidebar";

const PROJECT_SETTINGS_PERMISSIONS = [
    "project_edit_details",
    "project_edit_body",
    "project_edit_gallery",
    "project_manage_versions",
];

export default function OrganizationProjectsSettingsPage({ authToken, organization, projects = [], my_permissions }) {
    const t = useTranslations("Organizations");
    const [projectItems, setProjectItems] = useState(Array.isArray(projects) ? projects : []);
    const [detachingProjectSlug, setDetachingProjectSlug] = useState(null);

    const canDetachProjects = Boolean(
        my_permissions?.is_owner ||
        my_permissions?.organization_permissions?.includes("organization_remove_project")
    );

    const canOpenProjectSettings = Boolean(
        my_permissions?.is_owner ||
        PROJECT_SETTINGS_PERMISSIONS.some((permission) => my_permissions?.project_permissions?.includes(permission))
    );

    const handleDetachProject = async (project) => {
        if(!canDetachProjects || detachingProjectSlug) {
            return;
        }

        if(!window.confirm(t("settings.confirmDetachProject", { title: project.title }))) {
            return;
        }

        setDetachingProjectSlug(project.slug);

        try {
            await axios.put(`${process.env.NEXT_PUBLIC_API_BASE}/projects/${project.slug}/organization`, {
                organization_slug: null,
            }, {
                headers: {
                    Authorization: `Bearer ${authToken}`,
                },
            });

            setProjectItems((prev) => prev.filter((item) => item.slug !== project.slug));
            toast.success(t("settings.successProjectDetached", { title: project.title }));
        } catch (error) {
            toast.error(error.response?.data?.message || t("settings.errors.projectDetach"));
        } finally {
            setDetachingProjectSlug(null);
        }
    };

    return (
        <div className="layout">
            <div className="page-content settings-page">
                <OrganizationSettingsSidebar organization={organization} />

                <div className="settings-content" style={{ display: "flex", gap: "14px", flexDirection: "column" }}>
                    <div className="content content--padding">
                        <h2 style={{ marginBottom: 0 }}>{t("settings.projectsTitle")}</h2>
                    </div>

                    {projectItems.length === 0 ? (
                        <div className="content content--padding">
                            <p style={{ margin: 0, color: "var(--theme-color-text-secondary)" }}>{t("settings.emptyProjects")}</p>
                        </div>
                    ) : (
                        projectItems.map((project) => (
                            <div key={project.id} className="content content--padding" style={{ display: "grid", gap: "12px" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                                    <img src={project.icon_url || "https://media.modifold.com/static/no-project-icon.svg"} alt={project.title} style={{ width: "60px", height: "60px", borderRadius: "12px", objectFit: "cover" }} />
                                    
                                    <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "center" }}>
                                        <Link href={getProjectPath(project)} style={{ fontWeight: 600, lineHeight: "normal" }}>
                                            {project.title}
                                        </Link>

                                        {project.summary && (
                                            <p style={{ margin: "4px 0 0", color: "var(--theme-color-text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                                {project.summary}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                                    {canOpenProjectSettings && (
                                        <Link href={`${getProjectPath(project)}/settings`} className="button button--size-m button--with-icon button--type-minimal button--active-transform">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon lucide lucide-settings-icon lucide-settings">
                                                <path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915"></path>
                                                <circle cx="12" cy="12" r="3"></circle>
                                            </svg>
                                            
                                            {t("settings.actions.openProjectSettings")}
                                        </Link>
                                    )}

                                    {canDetachProjects && (
                                        <button type="button" className="button button--size-m button--type-danger" onClick={() => handleDetachProject(project)} disabled={detachingProjectSlug === project.slug}>
                                            {detachingProjectSlug === project.slug ? t("settings.actions.detachingProject") : t("settings.actions.detachProject")}
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}