"use client";

import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import Modal from "react-modal";
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
	const [approvalProject, setApprovalProject] = useState(null);
	const [rejectionProject, setRejectionProject] = useState(null);
	const [rejectionReason, setRejectionReason] = useState("");
	const [isSubmittingModeration, setIsSubmittingModeration] = useState(false);
    const typePopoverRef = useRef(null);
    const sortPopoverRef = useRef(null);

	useEffect(() => {
		Modal.setAppElement("body");
	}, []);

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

    const handleApprove = async (projectId, sendDiscordNotification) => {
		setIsSubmittingModeration(true);

        try {
            await axios.post(
                `${process.env.NEXT_PUBLIC_API_BASE}/moderation/${projectId}/moderate`,
                { status: "approved", reason: "Approved by moderator", sendDiscordNotification },
                { headers: { Authorization: `Bearer ${authToken}` } }
            );

            toast.success(t("success.approved"));
            setProjects((currentProjects) => currentProjects.filter((p) => p.id !== projectId));
			setApprovalProject(null);
        } catch (err) {
            toast.error(t("errors.approve"));
        } finally {
			setIsSubmittingModeration(false);
		}
    };

    const handleReject = async (projectId, reason) => {
		setIsSubmittingModeration(true);

        try {
            await axios.post(
                `${process.env.NEXT_PUBLIC_API_BASE}/moderation/${projectId}/moderate`,
                { status: "rejected", reason },
                { headers: { Authorization: `Bearer ${authToken}` } }
            );

            toast.success(t("success.rejected"));
            setProjects((currentProjects) => currentProjects.filter((p) => p.id !== projectId));
			setRejectionProject(null);
			setRejectionReason("");
        } catch (err) {
            toast.error(t("errors.reject"));
        } finally {
			setIsSubmittingModeration(false);
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

	const openRejectModal = (project) => {
		setRejectionProject(project);
		setRejectionReason("");
	};

	const closeRejectModal = () => {
		setRejectionProject(null);
		setRejectionReason("");
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

    const typeLabel = t(`filters.types.${projectType}`);
    const sortLabel = sort === "oldest" ? t("filters.sort.oldest") : t("filters.sort.newest");
	const canSubmitRejection = rejectionReason.trim().length > 0;

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
                                    {["all", "mod", "modpack", "world"].map((type) => (
                                        <div key={type} className={`context-list-option ${projectType === type ? "context-list-option--selected" : ""}`} onClick={() => handleTypeSelect(type)}>
                                            <div className="context-list-option__label">{t(`filters.types.${type}`)}</div>
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
                                <div className="new-project-card moderation-project-card" id={project.slug}>
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
                                            <button className="button button--size-m button--type-primary" type="button" onClick={() => setApprovalProject(project)} disabled={isSubmittingModeration}>
                                                {t("actions.approve")}
                                            </button>

                                            <button className="button button--size-m button--type-minimal" type="button" onClick={() => openRejectModal(project)} disabled={isSubmittingModeration}>
                                                {t("actions.reject")}
                                            </button>
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

			<Modal closeTimeoutMS={150} isOpen={Boolean(approvalProject)} onRequestClose={() => setApprovalProject(null)} className="modal active" overlayClassName="modal-overlay">
				<div className="modal-window">
					<div className="modal-window__header">
						<h2 className="modal-window__title">{t("approveModal.title")}</h2>

						<button className="icon-button modal-window__close" type="button" onClick={() => setApprovalProject(null)} disabled={isSubmittingModeration} aria-label={t("approveModal.close")}>
							<svg className="icon icon--x" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
								<path d="M18 6 6 18"></path>
								<path d="m6 6 12 12"></path>
							</svg>
						</button>
					</div>

					<div className="modal-window__content">
						<p className="moderation-approval-modal__description">
							{t("approveModal.description", { projectTitle: approvalProject?.title || "" })}
						</p>

						<div className="moderation-approval-modal__actions">
							<button className="button button--size-m button--type-minimal" type="button" onClick={() => approvalProject && handleApprove(approvalProject.id, false)} disabled={isSubmittingModeration}>
								{t("approveModal.withoutDiscord")}
							</button>

							<button className="button button--size-m button--type-primary" type="button" onClick={() => approvalProject && handleApprove(approvalProject.id, true)} disabled={isSubmittingModeration}>
								{t("approveModal.withDiscord")}
							</button>
						</div>
					</div>
				</div>
			</Modal>

			<Modal closeTimeoutMS={150} isOpen={Boolean(rejectionProject)} onRequestClose={closeRejectModal} className="modal active" overlayClassName="modal-overlay">
				<div className="modal-window">
					<div className="modal-window__header">
						<h2 className="modal-window__title">{t("rejectModal.title")}</h2>

						<button className="icon-button modal-window__close" type="button" onClick={closeRejectModal} disabled={isSubmittingModeration} aria-label={t("rejectModal.close")}>
							<svg className="icon icon--x" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
								<path d="M18 6 6 18"></path>
								<path d="m6 6 12 12"></path>
							</svg>
						</button>
					</div>

					<div className="modal-window__content">
						<p className="moderation-approval-modal__description">
							{t("rejectModal.description", { projectTitle: rejectionProject?.title || "" })}
						</p>

						<p className="blog-settings__field-title" style={{ marginBottom: "8px" }}>{t("rejectModal.reason")}</p>

						<div className="field field--default textarea moderation-rejection-modal__reason">
							<label className="field__wrapper">
								<textarea
									name="reason"
									placeholder={t("rejectModal.reasonPlaceholder")}
									className="autosize textarea__input"
									required
									value={rejectionReason}
									onChange={(event) => setRejectionReason(event.target.value)}
								/>
							</label>
						</div>

						<div className="moderation-approval-modal__actions" style={{ marginTop: "16px" }}>
							<button className="button button--size-m button--type-minimal" type="button" onClick={closeRejectModal} disabled={isSubmittingModeration}>
								{t("rejectModal.cancel")}
							</button>

							<button className="button button--size-m button--type-primary" type="button" onClick={() => rejectionProject && handleReject(rejectionProject.id, rejectionReason.trim())} disabled={isSubmittingModeration || !canSubmitRejection}>
								{t("rejectModal.confirm")}
							</button>
						</div>
					</div>
				</div>
			</Modal>
        </>
    );
}