"use client";

import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import { useTranslations } from "next-intl";
import Link from "next/link";
import ProjectTags from "../ui/ProjectTags";
import { getProjectPath } from "@/utils/projectRoutes";

export default function ModerationPage({ authToken, initialProjects, initialTotalPages }) {
    const t = useTranslations("ModerationPage");
    const [projects, setProjects] = useState(initialProjects || []);
    const [totalPages, setTotalPages] = useState(initialTotalPages || 1);
    const [search, setSearch] = useState("");
    const [searchInput, setSearchInput] = useState("");
    const [projectType, setProjectType] = useState("all");
    const [sort, setSort] = useState("oldest");
    const [page, setPage] = useState(1);
    const [isTypePopoverOpen, setIsTypePopoverOpen] = useState(false);
    const [isSortPopoverOpen, setIsSortPopoverOpen] = useState(false);
    const typePopoverRef = useRef(null);
    const sortPopoverRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if(typePopoverRef.current && !typePopoverRef.current.contains(event.target)) {
                setIsTypePopoverOpen(false);
            }

            if(sortPopoverRef.current && !sortPopoverRef.current.contains(event.target)) {
                setIsSortPopoverOpen(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    useEffect(() => {
        const fetchProjects = async () => {
            try {
                const params = {
                    search: search || undefined,
                    type: projectType === "all" ? undefined : projectType,
                    sort,
                    page,
                    limit: 20,
                };

                const response = await axios.get(`${process.env.NEXT_PUBLIC_API_BASE}/moderation`, {
                    headers: { Authorization: `Bearer ${authToken}` },
                    params,
                });

                setProjects(response.data.projects);
                setTotalPages(response.data.totalPages);
            } catch (err) {
                toast.error(t("errors.fetchProjects"));
            }
        };

        fetchProjects();
    }, [authToken, search, projectType, sort, page, t]);

    const handleApprove = async (projectId) => {
        try {
            await axios.post(
                `${process.env.NEXT_PUBLIC_API_BASE}/moderation/${projectId}/moderate`,
                { status: "approved", reason: "Approved by moderator" },
                { headers: { Authorization: `Bearer ${authToken}` } }
            );

            toast.success(t("success.approved"));
            setProjects(projects.filter((p) => p.id !== projectId));
        } catch (err) {
            toast.error(t("errors.approve"));
        }
    };

    const handleReject = async (projectId, reason) => {
        try {
            await axios.post(
                `${process.env.NEXT_PUBLIC_API_BASE}/moderation/${projectId}/moderate`,
                { status: "rejected", reason },
                { headers: { Authorization: `Bearer ${authToken}` } }
            );

            toast.success(t("success.rejected"));
            setProjects(projects.filter((p) => p.id !== projectId));
        } catch (err) {
            toast.error(t("errors.reject"));
        }
    };

    const handleTypeSelect = (type) => {
        setProjectType(type);
        setIsTypePopoverOpen(false);
        setPage(1);
    };

    const handleSortSelect = (sortOption) => {
        setSort(sortOption);
        setIsSortPopoverOpen(false);
        setPage(1);
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            if(search !== searchInput) {
                setPage(1);
                setSearch(searchInput);
            }
        }, 350);

        return () => clearTimeout(timer);
    }, [searchInput, search]);

    const typeLabel = projectType === "all" ? t("filters.types.all") : t("filters.types.mod");
    const sortLabel = sort === "oldest" ? t("filters.sort.oldest") : t("filters.sort.newest");

    return (
        <>
            <div className="moderation-toolbar">
                <div className="field field--large" style={{ width: "100%", maxWidth: "400px" }}>
                    <label className="field__wrapper" style={{ background: "var(--theme-color-background-content)" }}>
                        <div className="field__wrapper-body">
                            <svg className="icon icon--search field__icon field__icon--left" xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="m21 21-4.34-4.34"></path>
                                <circle cx="11" cy="11" r="8"></circle>
                            </svg>

                            <input
                                placeholder={t("filters.searchPlaceholder")}
                                className="text-input"
                                type="text"
                                value={searchInput}
                                onChange={(e) => setSearchInput(e.target.value)}
                            />
                        </div>
                    </label>
                </div>

                <div className="moderation-toolbar__controls">
                    <div className="field field--default blog-settings__input" style={{ width: "200px" }} ref={typePopoverRef}>
                        <label className="field__wrapper" onClick={() => setIsTypePopoverOpen(!isTypePopoverOpen)} style={{ cursor: "pointer", background: "var(--theme-color-background-content)" }}>
                            <div className="field__wrapper-body">
                                <div className="select">
                                    <div className="select__selected">{typeLabel}</div>
                                </div>
                            </div>

                            <svg style={{ fill: "none" }} className={`icon icon--chevron_down ${isTypePopoverOpen ? "rotate" : ""}`} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"></path></svg>
                        </label>

                        {isTypePopoverOpen && (
                            <div className="popover">
                                <div className="context-list" data-scrollable style={{ maxHeight: "200px", overflowY: "auto" }}>
                                    {["all", "mod"].map((type) => (
                                        <div key={type} className={`context-list-option ${projectType === type ? "context-list-option--selected" : ""}`} onClick={() => handleTypeSelect(type)}>
                                            <div className="context-list-option__label">{type === "all" ? t("filters.types.all") : t("filters.types.mod")}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="field field--default blog-settings__input" style={{ width: "200px" }} ref={sortPopoverRef}>
                        <label className="field__wrapper" onClick={() => setIsSortPopoverOpen(!isSortPopoverOpen)} style={{ cursor: "pointer", background: "var(--theme-color-background-content)" }}>
                            <div className="field__wrapper-body">
                                <div className="select">
                                    <div className="select__selected">{sortLabel}</div>
                                </div>
                            </div>

                            <svg style={{ fill: "none" }} className={`icon icon--chevron_down ${isSortPopoverOpen ? "rotate" : ""}`} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"></path></svg>
                        </label>

                        {isSortPopoverOpen && (
                            <div className="popover">
                                <div className="context-list" data-scrollable style={{ maxHeight: "200px", overflowY: "auto" }}>
                                    {["oldest", "newest"].map((sortOption) => (
                                        <div key={sortOption} className={`context-list-option ${sort === sortOption ? "context-list-option--selected" : ""}`} onClick={() => handleSortSelect(sortOption)}>
                                            <div className="context-list-option__label">{sortOption === "oldest" ? t("filters.sort.oldest") : t("filters.sort.newest")}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {projects.length === 0 ? (
                <div className="content content--padding">
                    <p>{t("empty")}</p>
                </div>
            ) : (
                <div className="projects-grid">
                    {projects.map((project) => {
                        const hasTags = project.tags?.length > 0;

                        return (
                            <div key={project.id} className="new-projects-list">
                                <div className="new-project-card" id={project.slug}>
                                    <div style={{ display: "flex", gap: "12px", borderBottom: hasTags ? "1px solid var(--theme-color-border)" : "none", paddingBottom: hasTags ? "12px" : "16px", paddingTop: "16px", paddingRight: "16px", paddingLeft: "16px" }}>
                                        <Link href={getProjectPath(project)} style={{ height: "96px" }}>
                                            <img className="new-project-icon" alt={project.title} src={project.icon_url || "https://media.modifold.com/static/no-project-icon.svg"} />
                                        </Link>

                                        <div className="new-project-info">
                                            <div className="new-project-header">
                                                <Link href={getProjectPath(project)} className="new-project-title">{project.title}</Link>
                                            </div>

                                            <p className="new-project-description">{project.summary}</p>
                                        </div>
                                        
                                        <div className="new-project-stats">
                                            <button className="button button--size-m button--type-primary" onClick={() => handleApprove(project.id)}>{t("actions.approve")}</button>

                                            <button className="button button--size-m button--type-minimal" onClick={() => { const reason = prompt(t("actions.rejectPrompt")); if (reason) handleReject(project.id, reason); }}>{t("actions.reject")}</button>
                                        </div>
                                    </div>

                                    {project.tags && project.tags.length > 0 && (
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
                            </div>
                        );
                    })}
                </div>
            )}

            {totalPages > 1 && (
                <div className="pagination" style={{ marginTop: "20px", textAlign: "center" }}>
                    <button className="button button--size-m" disabled={page === 1} onClick={() => setPage(page - 1)}>
                        {t("pagination.previous")}
                    </button>

                    <span style={{ margin: "0 10px" }}>{t("pagination.pageOf", { page, totalPages })}</span>

                    <button className="button button--size-m" disabled={page === totalPages} onClick={() => setPage(page + 1)}>
                        {t("pagination.next")}
                    </button>
                </div>
            )}
        </>
    );
}