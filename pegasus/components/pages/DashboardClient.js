"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import axios from "axios";
import { useAuth } from "../providers/AuthProvider";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import ProjectTags from "../ui/ProjectTags";
import UserSettingsSidebar from "@/components/ui/UserSettingsSidebar";
import { getProjectPath } from "@/utils/projectRoutes";

export default function DashboardClient({ initialProjects, initialTotalPages, initialPage, authToken }) {
    const t = useTranslations("DashboardClient");
    const tSidebar = useTranslations("SettingsBlogPage.sidebar");
    const router = useRouter();
    const { isLoggedIn, user } = useAuth();
    const [projects, setProjects] = useState(initialProjects || []);
    const [loading, setLoading] = useState(false);
    const [currentPage, setCurrentPage] = useState(initialPage || 1);
    const [totalPages, setTotalPages] = useState(initialTotalPages || 1);

    useEffect(() => {
        if(!isLoggedIn) {
            router.push("/");
            return;
        }

        if(currentPage === initialPage) {
            setProjects(initialProjects);
            setTotalPages(initialTotalPages);
            return;
        }

        const fetchUserProjects = async () => {
            try {
                setLoading(true);

                const res = await axios.get(`${process.env.NEXT_PUBLIC_API_BASE}/projects/user/projects`, {
                    headers: {
                        Authorization: `Bearer ${authToken}`,
                    },
                    params: {
                        page: currentPage,
                        limit: 20,
                    },
                });

                setProjects(res.data.projects || []);
                setTotalPages(res.data.totalPages || 1);
            } catch (err) {
                console.error("Error fetching user projects:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchUserProjects();
    }, [currentPage, authToken, initialProjects, initialTotalPages, initialPage, isLoggedIn, router]);

    const getPageButtons = () => {
        const maxButtons = 10;
        let startPage = Math.max(1, currentPage - Math.floor(maxButtons / 2));
        let endPage = Math.min(totalPages, startPage + maxButtons - 1);

        if(endPage - startPage + 1 < maxButtons) {
            startPage = Math.max(1, endPage - maxButtons + 1);
        }

        const buttons = [];
        for(let i = startPage; i <= endPage; i++) {
            buttons.push(
                <button key={i} className={`button button--size-m pagination-button ${currentPage === i ? "button--type-primary" : "button--type-secondary"}`} onClick={() => setCurrentPage(i)} aria-current={currentPage === i ? "page" : undefined}>
                    {i}
                </button>
            );
        }

        return buttons;
    };

    return (
        <div className="layout">
            <div className="page-content settings-page">
                <UserSettingsSidebar
                    user={user}
                    profileIconAlt={t("userAvatarAlt", { username: user.username })}
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

                <div className="settings-content">
                    {loading ? (
                        <div className="subsite-empty-feed">
                            <p className="subsite-empty-feed__title">{t("loading")}</p>
                        </div>
                    ) : projects.length > 0 ? (
                        <div className="projects-grid">
                            {projects.map((project) => {
                                const hasTags = project.tags?.length > 0;

                                return (
                                    <div key={project.slug} id={project.slug} className="new-project-card">
                                        <Link className="new-project-card__overlay" href={getProjectPath(project)} aria-label={project.title} />

                                        <div style={{ display: "flex", gap: "12px", borderBottom: hasTags ? "1px solid var(--theme-color-border)" : "none", paddingBottom: hasTags ? "12px" : "16px", paddingTop: "16px", paddingRight: "16px", paddingLeft: "16px" }}>
                                            <img className="new-project-icon" alt={t("projectIconAlt", { title: project.title })} src={project.icon_url || "https://media.modifold.com/static/no-project-icon.svg"} />

                                            <div className="new-project-info">
                                                <div className="new-project-header">
                                                    <span className="new-project-title">{project.title}</span>
                                                    
                                                    <span className="new-project-author">
                                                        {project.owner?.type === "organization" ? t("byOrganization", { name: project.owner?.username || "" }) : t("byYou")}
                                                    </span>
                                                </div>

                                                <p className="new-project-description">{project.summary}</p>
                                            </div>

                                            {project.permissions?.can_edit && (
                                                <div className="new-project-stats">
                                                    <Link href={`${getProjectPath(project)}/settings`} className="button button--size-m button--type-minimal dashboard-project-settings-button" onClick={(event) => event.stopPropagation()} onMouseDown={(event) => event.stopPropagation()}>
                                                        <svg style={{ fill: "none", marginRight: "4px" }} xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon icon--settings"><path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915"/><circle cx="12" cy="12" r="3"/></svg>

                                                        {t("edit")}
                                                    </Link>
                                                </div>
                                            )}
                                        </div>

                                        {hasTags && (
                                            <div className="new-project-tags" style={{ padding: "8px 16px" }}>
                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-tags-icon lucide-tags">
                                                    <path d="M13.172 2a2 2 0 0 1 1.414.586l6.71 6.71a2.4 2.4 0 0 1 0 3.408l-4.592 4.592a2.4 2.4 0 0 1-3.408 0l-6.71-6.71A2 2 0 0 1 6 9.172V3a1 1 0 0 1 1-1z"/>
                                                    <path d="M2 7v6.172a2 2 0 0 0 .586 1.414l6.71 6.71a2.4 2.4 0 0 0 3.191.193"/>
                                                    <circle cx="10.5" cy="6.5" r=".5" fill="currentColor"/>
                                                </svg>

                                                <ProjectTags limit={5} tags={project.tags} />
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="notifications">
                            <div className="subsite-empty-feed">
                                <p className="subsite-empty-feed__title">{t("noProjects")}</p>
                            </div>
                        </div>
                    )}

                    {totalPages > 1 && (
                        <div className="pagination-controls">
                            <button className="button button--size-m button--type-secondary" onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))} disabled={currentPage === 1} aria-disabled={currentPage === 1}>
                                {t("previous")}
                            </button>

                            {getPageButtons()}

                            <button className="button button--size-m button--type-secondary" onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))} disabled={currentPage === totalPages} aria-disabled={currentPage === totalPages}>
                                {t("next")}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}