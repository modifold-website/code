"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import axios from "axios";
import { toast } from "react-toastify";
import { useAuth } from "../providers/AuthProvider";
import { useLocale, useTranslations } from "next-intl";
import ProjectTags from "../ui/ProjectTags";
import Tooltip from "../ui/Tooltip";
import ProjectReportModal from "@/modal/ProjectReportModal";
import { getProjectPath } from "@/utils/projectRoutes";

export default function ProjectMasthead({ project, authToken }) {
    const t = useTranslations("ProjectPage");
    const cardT = useTranslations("ProjectCard");
    const locale = useLocale();
    const { isLoggedIn, user } = useAuth();
    const [, setFollowers] = useState(project.followers || 0);
    const [isLiked, setIsLiked] = useState(project.is_liked || false);
    const [isActionsOpen, setIsActionsOpen] = useState(false);
    const [isReportModalOpen, setIsReportModalOpen] = useState(false);
    const [reportStatus, setReportStatus] = useState({ loading: false, hasReported: false, report: null });
    const mastheadTagsCount = project.tags_count ?? project.tagsCount ?? project.total_tags ?? project.totalTags;
    const projectStatus = project.status;
    const isDraftProject = projectStatus === "draft";
    const isModerationProject = ["queued", "pending", "in_review"].includes(projectStatus);
    const playersLast14Days = Math.max(0, Number(project?.players_last_14d) || 0);
    const showPlayersLast14Days = project?.show_players_last_14d === true || project?.show_players_last_14d === 1 || project?.show_players_last_14d === "1";
    const hasTags = project.tags?.length > 0;
    const isProjectAuthor = Boolean(user?.id && Number(project.user_id) === Number(user.id));
    const actionsRef = useRef(null);

    const formatNumber = (num) => {
        if(num >= 1000000) {
            return `${(num / 1000000).toFixed(2)}M`;
        }

        if(num >= 1000) {
            return `${(num / 1000).toFixed(2)}K`;
        }

        return num;
    };

    const formatFullNumber = (num) => new Intl.NumberFormat(locale).format(Math.max(0, Number(num) || 0));

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = date - now;
        const seconds = Math.round(diffMs / 1000);
        const minutes = Math.round(seconds / 60);
        const hours = Math.round(minutes / 60);
        const days = Math.round(hours / 24);
        const months = Math.round(days / 30);
        const years = Math.round(days / 365);

        if(Math.abs(seconds) < 60) {
            return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(seconds, "second");
        }

        if(Math.abs(minutes) < 60) {
            return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(minutes, "minute");
        }

        if(Math.abs(hours) < 24) {
            return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(hours, "hour");
        }

        if(Math.abs(days) < 30) {
            return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(days, "day");
        }

        if(Math.abs(months) < 12) {
            return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(months, "month");
        }

        return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(years, "year");
    };

    const getUpdatedTooltipDateOptions = (date) => {
        const options = {
            day: "numeric",
            month: "long",
            hour: "2-digit",
            minute: "2-digit",
        };

        if(date.getFullYear() !== new Date().getFullYear()) {
            options.year = "numeric";
        }

        return options;
    };

    const formatUpdatedTooltip = (dateString) => {
        const date = new Date(dateString);

        return `${cardT("updated")} ${new Intl.DateTimeFormat(locale, getUpdatedTooltipDateOptions(date)).format(date)}`;
    };

    useEffect(() => {
        const handleClickOutside = (event) => {
            if(actionsRef.current && !actionsRef.current.contains(event.target)) {
                setIsActionsOpen(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    useEffect(() => {
        if(!isLoggedIn || !authToken) {
            setReportStatus({ loading: false, hasReported: false, report: null });
            return;
        }

        let cancelled = false;

        const fetchReportStatus = async () => {
            try {
                setReportStatus((prev) => ({ ...prev, loading: true }));
                const response = await axios.get(
                    `${process.env.NEXT_PUBLIC_API_BASE}/reports/projects/${project.slug}/my-status`,
                    { headers: { Authorization: `Bearer ${authToken}` } }
                );

                if(cancelled) {
                    return;
                }

                setReportStatus({
                    loading: false,
                    hasReported: Boolean(response.data?.has_reported),
                    report: response.data?.report || null,
                });
            } catch {
                if(!cancelled) {
                    setReportStatus({ loading: false, hasReported: false, report: null });
                }
            }
        };

        fetchReportStatus();

        return () => {
            cancelled = true;
        };
    }, [isLoggedIn, authToken, project.slug]);

    const handleLikeToggle = async () => {
        if(!isLoggedIn) {
            toast.error(t("loginRequired"));
            return;
        }

        try {
            const method = isLiked ? "DELETE" : "POST";
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE}/projects/${project.slug}/like`, {
                method,
                headers: {
                    Authorization: `Bearer ${authToken}`,
                    "Content-Type": "application/json",
                },
            });

            const data = await response.json();
            if(response.ok) {
                setFollowers(data.followers);
                setIsLiked(data.is_liked);
                window.dispatchEvent(new CustomEvent("likes:changed", {
                    detail: {
                        projectSlug: project.slug,
                        isLiked: data.is_liked,
                    },
                }));
            } else {
                throw new Error(data.message || "Failed to toggle like");
            }
        } catch (error) {
            console.error("Error toggling like:", error);
            toast.error(t("likeError"));
        }
    };

    const openReportModal = () => {
        if(!isLoggedIn || !authToken) {
            toast.error(t("report.loginRequired"));
            return;
        }

        if(reportStatus.hasReported) {
            toast.info(t("report.alreadySubmittedToast"));
            return;
        }

        setIsActionsOpen(false);
        setIsReportModalOpen(true);
    };

    const handleReportSubmitted = () => {
        setReportStatus({
            loading: false,
            hasReported: true,
            report: {
                ...(reportStatus.report || {}),
                status: "open",
            },
        });
    };

    const handleCopyProjectLink = async () => {
        const projectUrl = typeof window !== "undefined" ? `${window.location.origin}${getProjectPath(project)}` : `https://modifold.com${getProjectPath(project)}`;

        try {
            if(navigator?.clipboard?.writeText) {
                await navigator.clipboard.writeText(projectUrl);
            } else {
                const textarea = document.createElement("textarea");
                textarea.value = projectUrl;
                textarea.setAttribute("readonly", "");
                textarea.style.position = "absolute";
                textarea.style.left = "-9999px";
                document.body.appendChild(textarea);
                textarea.select();
                document.execCommand("copy");
                document.body.removeChild(textarea);
            }

            toast.success(t("report.copySuccess"));
            setIsActionsOpen(false);
        } catch {
            toast.error(t("report.copyError"));
        }
    };

    return (
        <>
            <section className="new-project-card project-page-card" id={project.slug}>
                <div className={`project-page-card__main ${hasTags ? "project-page-card__main--with-tags" : ""}`}>
                    <Image src={project.icon_url || "https://media.modifold.com/static/no-project-icon.svg"} className="new-project-icon" alt={cardT("projectIconAlt", { title: project.title })} width={100} height={100} priority />

                    <div className="new-project-info">
                        <div className="new-project-header project-page-card__header">
                            <span className="new-project-title">{project.title}</span>
                            {isDraftProject && (
                                <span className="masthead-status masthead-status--draft">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-book-dashed-icon lucide-book-dashed">
                                        <path d="M12 17h1.5"/>
                                        <path d="M12 22h1.5"/>
                                        <path d="M12 2h1.5"/>
                                        <path d="M17.5 22H19a1 1 0 0 0 1-1"/>
                                        <path d="M17.5 2H19a1 1 0 0 1 1 1v1.5"/>
                                        <path d="M20 14v3h-2.5"/>
                                        <path d="M20 8.5V10"/>
                                        <path d="M4 10V8.5"/>
                                        <path d="M4 19.5V14"/>
                                        <path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H8"/>
                                        <path d="M8 22H6.5a1 1 0 0 1 0-5H8"/>
                                    </svg>

                                    {t("status.draft")}
                                </span>
                            )}

                            {!isDraftProject && isModerationProject && (
                                <span className="masthead-status masthead-status--moderation">
                                    <svg className="icon icon--settings" height="18" width="18" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="m3 6 3 1m0 0-3 9a5 5 0 0 0 6.001 0M6 7l3 9M6 7l6-2m6 2 3-1m-3 1-3 9a5 5 0 0 0 6.001 0M18 7l3 9m-3-9-6-2m0-2v2m0 16V5m0 16H9m3 0h3"></path>
                                    </svg>

                                    {t("status.moderation")}
                                </span>
                            )}
                        </div>

                        <p className="new-project-description">{project.summary}</p>

                        <div className="new-project-bottom">
                            <div className="new-stat" style={{ fontWeight: "400" }}>
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-download-icon lucide-download">
                                    <path d="M12 15V3"/>
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                                    <path d="m7 10 5 5 5-5"/>
                                </svg>

                                <Tooltip content={`${formatNumber(project.downloads)} ${cardT("downloads")}`}>
                                    <span>{formatNumber(project.downloads)}</span>
                                </Tooltip>
                            </div>

                            {showPlayersLast14Days && (
                                <div className="new-project-players">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
                                        <path d="m5 3 14 9-14 9z"></path>
                                    </svg>

                                    <Tooltip content={t("playersLast14dTooltip", { count: formatFullNumber(playersLast14Days) })}>
                                        <span>{formatFullNumber(playersLast14Days)}</span>
                                    </Tooltip>
                                </div>
                            )}

                            {project.updated_at && (
                                <div className="new-stat new-updated">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" className="lucide lucide-heart-icon lucide-update">
                                        <path d="M3 3v5h5"></path>
                                        <path d="M3.05 13A9 9 0 1 0 6 5.3L3 8"></path>
                                        <path d="M12 7v5l4 2"></path>
                                    </svg>

                                    <Tooltip content={formatUpdatedTooltip(project.updated_at)}>
                                        <span>{formatDate(project.updated_at)}</span>
                                    </Tooltip>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="masthead-buttons project-page-card__actions">
                        {user && (project.permissions?.can_edit_details || isProjectAuthor) && (
                            <Link className="button button--size-l button--with-icon button--active-transform button--type-primary" href={getProjectPath(project, "/settings")}>
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon lucide lucide-settings-icon lucide-settings">
                                    <path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915"/>
                                    <circle cx="12" cy="12" r="3"/>
                                </svg>
                                
                                {t("editSettings")}
                            </Link>
                        )}

                        {!isProjectAuthor && (
                            <button className={`button--like ${isLiked ? "active" : ""} button--active-transform`} onClick={handleLikeToggle} style={{ cursor: isLoggedIn ? "pointer" : "not-allowed" }}>
                                {isLiked ? (
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon lucide-heart"><path d="M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5"/></svg>
                                ) : (
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon lucide-heart"><path d="M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5"/></svg>
                                )}
                            </button>
                        )}

                        <div style={{ position: "relative" }} ref={actionsRef}>
                            <button className="icon-button button--active-transform" style={{ width: "48px", height: "48px", display: "flex", alignItems: "center", justifyContent: "center" }} type="button" aria-label={t("report.moreActions")} aria-expanded={isActionsOpen} onClick={() => setIsActionsOpen((prev) => !prev)}>
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon lucide lucide-ellipsis-vertical-icon lucide-ellipsis-vertical">
                                    <circle cx="12" cy="12" r="1"></circle>
                                    <circle cx="12" cy="5" r="1"></circle>
                                    <circle cx="12" cy="19" r="1"></circle>
                                </svg>
                            </button>

                            {isActionsOpen && (
                                <div id="popover-overlay" className="popover-overlay">
                                    <div className="popover" tabIndex={0} style={{ "--width": "max-content", "--top": "46px", "--position": "absolute", "--left": "auto", "--right": "0", "--bottom": "auto", "--distance": "8px" }}>
                                        <div className="popover__scrollable" style={{ "--max-height": "auto" }}>
                                            <button style={{ width: "100%" }} type="button" className="context-list-option context-list-option--with-art" onClick={handleCopyProjectLink}>
                                                <div className="context-list-option__art context-list-option__art--icon">
                                                    <svg style={{ fill: "none" }} xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-link-icon lucide-link">
                                                        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                                                        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                                                    </svg>
                                                </div>

                                                <div className="context-list-option__label">
                                                    {t("report.copyLink")}
                                                </div>
                                            </button>

                                            <button style={{ width: "100%" }} type="button" className={`context-list-option context-list-option--with-art ${reportStatus.hasReported ? "context-list-option--selected" : ""}`} onClick={openReportModal} disabled={reportStatus.hasReported || reportStatus.loading}>
                                                <div className="context-list-option__art context-list-option__art--icon">
                                                    <svg style={{ fill: "none" }} xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-flag-icon lucide-flag">
                                                        <path d="M4 22V4a1 1 0 0 1 .4-.8A6 6 0 0 1 8 2c3 0 5 2 7.333 2q2 0 3.067-.8A1 1 0 0 1 20 4v10a1 1 0 0 1-.4.8A6 6 0 0 1 16 16c-3 0-5-2-8-2a6 6 0 0 0-4 1.528"/>
                                                    </svg>
                                                </div>

                                                <div className="context-list-option__label">
                                                    {reportStatus.hasReported ? t("report.alreadySubmitted") : t("report.openModal")}
                                                </div>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {hasTags && (
                    <div className="new-project-tags" style={{ padding: "8px 16px" }}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-tags-icon lucide-tags">
                            <path d="M13.172 2a2 2 0 0 1 1.414.586l6.71 6.71a2.4 2.4 0 0 1 0 3.408l-4.592 4.592a2.4 2.4 0 0 1-3.408 0l-6.71-6.71A2 2 0 0 1 6 9.172V3a1 1 0 0 1 1-1z"/>
                            <path d="M2 7v6.172a2 2 0 0 0 .586 1.414l6.71 6.71a2.4 2.4 0 0 0 3.191.193"/>
                            <circle cx="10.5" cy="6.5" r=".5" fill="currentColor"/>
                        </svg>

                        <ProjectTags tags={project.tags} limit={5} totalCount={mastheadTagsCount} />
                    </div>
                )}
            </section>

            <ProjectReportModal isOpen={isReportModalOpen} onRequestClose={() => setIsReportModalOpen(false)} projectSlug={project.slug} authToken={authToken} onSubmitted={handleReportSubmitted} />
        </>
    );
}