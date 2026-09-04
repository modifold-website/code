"use client";

import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import Modal from "react-modal";
import { toast } from "react-toastify";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { getProjectPath } from "@/utils/projectRoutes";
import { formatRelativeTime } from "@/utils/date/relativeTime";

export default function ModerationPage({ authToken, initialProjects, initialTotalPages }) {
    const t = useTranslations("ModerationPage");
	const locale = useLocale();
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

	const handleApprovalClick = (project) => {
		if(project.visibility === "unlisted") {
			handleApprove(project.id, false);
			return;
		}

		setApprovalProject(project);
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
                                    {["all", "mod", "modpack", "world", "prefab"].map((type) => (
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
                        const projectPath = getProjectPath(project);
                        const relativeDate = formatRelativeTime(project.created_at, locale);

                        return (
							<article key={project.id} className="moderation-queue-card" id={project.slug}>
								<div className="moderation-queue-card__identity">
									<Link href={projectPath} target="_blank" rel="noreferrer" tabIndex={-1} className="moderation-queue-card__icon-link">
										<img className="moderation-queue-card__icon" alt="" src={project.icon_url || "https://cdn.modifold.com/static/no-project-icon.svg"} />
									</Link>

									<div className="moderation-queue-card__details">
										<div className="moderation-queue-card__title-row">
											<Link href={projectPath} target="_blank" rel="noreferrer" className="moderation-queue-card__title">{project.title}</Link>

											<span className="moderation-card-pill">
												<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/>
                                                    <path d="m3.3 7 8.7 5 8.7-5"/>
                                                    <path d="M12 22V12"/>
                                                </svg>

												<span>{t(`filters.types.${project.project_type}`)}</span>
											</span>
										</div>

										<p className="moderation-queue-card__summary">{project.summary}</p>
									</div>
								</div>

								<div className="moderation-queue-card__aside">
									{relativeDate ? <time className="moderation-queue-card__date" dateTime={project.created_at}>{relativeDate}</time> : null}

									<div className="moderation-queue-card__actions">
										<button className="moderation-queue-card__action moderation-queue-card__action--approve" type="button" onClick={() => handleApprovalClick(project)} disabled={isSubmittingModeration} aria-label={t("actions.approve")} title={t("actions.approve")}>
											<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M20 6 9 17l-5-5"/>
                                            </svg>
										</button>

										<button className="moderation-queue-card__action moderation-queue-card__action--reject" type="button" onClick={() => openRejectModal(project)} disabled={isSubmittingModeration} aria-label={t("actions.reject")} title={t("actions.reject")}>
											<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M18 6 6 18"/>
                                                <path d="m6 6 12 12"/>
                                            </svg>
										</button>
									</div>
								</div>
							</article>
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