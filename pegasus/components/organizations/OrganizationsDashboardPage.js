"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "../providers/AuthProvider";
import { useTranslations } from "next-intl";
import UserSettingsSidebar from "@/components/ui/UserSettingsSidebar";
import CreateOrganizationModal from "@/modal/CreateOrganizationModal";

export default function OrganizationsDashboardPage({ authToken, initialOrganizations = [] }) {
    const { user } = useAuth();
    const t = useTranslations("Organizations");
    const tSidebar = useTranslations("SettingsBlogPage.sidebar");
    const [organizations, setOrganizations] = useState(initialOrganizations);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

    return (
        <div className="layout">
            <div className="page-content settings-page">
                <UserSettingsSidebar
                    user={user}
                    profileIconAlt={tSidebar("profileIconAlt")}
                    mode="dashboard"
                    labels={{
                        projects: tSidebar("projects"),
                        likes: tSidebar("likes"),
                        organizations: tSidebar("organizations"),
                        jams: tSidebar("jams"),
                        notifications: tSidebar("notifications"),
                        settings: tSidebar("settings"),
                        apiTokens: tSidebar("apiTokens"),
                        verification: tSidebar("verification"),
                    }}
                />

                <div className="notifications settings-wrapper--narrow">
                    <div className="notifications__header" style={{ justifyContent: "space-between" }}>
                        <span className="notifications__header-text">{t("dashboard.title")}</span>
                        
                        <button type="button" className="button button--size-m button--type-primary button--active-transform" onClick={() => setIsCreateModalOpen(true)}>
                            {t("dashboard.create")}
                        </button>
                    </div>

                    {organizations.length === 0 ? (
                        <div className="subsite-empty-feed">
                            <p className="subsite-empty-feed__title">{t("dashboard.empty")}</p>
                        </div>
                    ) : (
                        <div style={{ display: "grid", gap: "12px", marginTop: "12px" }}>
                            {organizations.map((organization) => (
                                <Link key={organization.id} href={`/organization/${organization.slug}`} className="new-project-card" style={{ textDecoration: "none", flexDirection: "row", padding: "16px", gap: "12px" }}>
                                    <img className="new-project-icon" src={organization.icon_url || "https://media.modifold.com/static/no-project-icon.svg"} style={{ width: "80px", height: "80px" }} alt={organization.name} />
                                    
                                    <div className="new-project-info">
                                        <div className="new-project-header">
                                            <span className="new-project-title" style={{ fontWeight: "500" }}>{organization.name}</span>
                                        </div>

                                        <p className="new-project-description">{organization.summary || t("dashboard.noSummary")}</p>
                                        
                                        <p style={{ marginTop: "auto", color: "var(--theme-color-text-secondary)", display: "inline-flex", alignItems: "center", gap: "8px", fontSize: "16px" }}>
                                            <svg style={{ fill: "none" }} xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-users-round-icon lucide-users-round">
                                                <path d="M18 21a8 8 0 0 0-16 0"/>
                                                <circle cx="10" cy="8" r="5"/>
                                                <path d="M22 20c0-3.37-2-6.5-4-8a5 5 0 0 0-.45-8.3"/>
                                            </svg>

                                            {t("dashboard.members", { count: organization.members_count || 0 })}
                                        </p>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <CreateOrganizationModal
                isOpen={isCreateModalOpen}
                authToken={authToken}
                onRequestClose={() => setIsCreateModalOpen(false)}
                onCreated={(created) => {
                    if(!created?.id) {
                        return;
                    }

                    setOrganizations((prev) => ([
                        {
                            ...created,
                            members_count: 1,
                        },
                        ...prev,
                    ]));
                }}
            />
        </div>
    );
}