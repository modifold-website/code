"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "../../providers/AuthProvider";
import { useRouter } from "next/navigation";
import axios from "axios";
import { toast } from "react-toastify";
import { useLocale, useTranslations } from "next-intl";
import ProjectStatusBanner from "@/components/ui/ProjectStatusBanner";

const MODERATION_PROJECT_STATUSES = new Set(["queued", "pending", "in_review"]);

export default function ModerationProjectPage({ project, authToken, initialModerationHistory = [] }) {
    const t = useTranslations("SettingsProjectPage");
    const locale = useLocale();
    const { isLoggedIn, user } = useAuth();
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [projectStatus, setProjectStatus] = useState(project.status);
    const [moderationHistory, setModerationHistory] = useState(initialModerationHistory);
    const hasIcon = !!project.icon_url;
    const hasDescription = !!project.description;
    const hasSummary = !!project.summary;
    const hasVersions = Array.isArray(project?.versions) && project.versions.length > 0;
	const completedRequirements = [hasIcon, hasSummary, hasDescription, hasVersions].filter(Boolean).length;
	const statusBannerType = projectStatus === "approved" ? "approved" : MODERATION_PROJECT_STATUSES.has(projectStatus) ? "moderation" : "draft";

    useEffect(() => {
        if(!isLoggedIn || project.user_id !== user.id) {
            router.push("/");
            return;
        }
    }, [isLoggedIn, user, project, router]);

    const handleSubmit = async () => {
        if(!hasIcon) {
            toast.error(t("moderation.errors.icon"));
            return;
        }

        if(!hasDescription) {
            toast.error(t("moderation.errors.description"));
            return;
        }

        if(!hasSummary) {
            toast.error(t("moderation.errors.summary"));
            return;
        }

        if(!hasVersions) {
            toast.error(t("moderation.errors.versions"));
            return;
        }

        setLoading(true);

        try {
            await axios.post(
                `${process.env.NEXT_PUBLIC_API_BASE}/projects/${project.slug}/submit`,
                { status: "queued" },
                { headers: { Authorization: `Bearer ${authToken}` } }
            );

            toast.success(t("moderation.success.submit"));
            setProjectStatus("queued");
            setModerationHistory((prevHistory) => {
                const hasQueuedEntry = Array.isArray(prevHistory) && prevHistory.some((entry) => entry?.action === "queued");
                if(hasQueuedEntry) {
                    return prevHistory;
                }

                return [
                    {
                        id: `queued-local-${Date.now()}`,
                        action: "queued",
                        createdAt: new Date().toISOString(),
                    },
                    ...prevHistory,
                ];
            });

            try {
                const historyRes = await axios.get(`${process.env.NEXT_PUBLIC_API_BASE}/projects/${project.slug}/moderation-history`, {
                    headers: { Authorization: `Bearer ${authToken}` },
                });

                if(Array.isArray(historyRes.data?.history)) {
                    setModerationHistory(historyRes.data.history);
                }
            } catch (historyErr) {
                console.error("Failed to refresh moderation history", historyErr);
            }
        } catch (err) {
            const isAlreadySubmitted = err?.response?.status === 400 || err?.response?.status === 409;
            toast.error(isAlreadySubmitted ? t("moderation.errors.alreadySubmitted") : t("moderation.errors.submit"));
        } finally {
            setLoading(false);
        }
    };

    const canSubmit = hasIcon && hasDescription && hasSummary && hasVersions && projectStatus !== "queued" && projectStatus !== "approved";

	const historyActionLabel = (action) => {
		switch(action) {
            case "queued":
                return t("moderation.history.actions.queued");
            case "approved":
                return t("moderation.history.actions.approved");
            case "rejected":
                return t("moderation.history.actions.rejected");
            case "changes_requested":
                return t("moderation.history.actions.changesRequested");
            default:
                return action;
		}
	};

	const formatHistoryDate = (value) => {
		const date = new Date(value);
		if(Number.isNaN(date.getTime())) {
			return "";
		}

		const datePart = new Intl.DateTimeFormat(locale, {
			day: "numeric",
			month: "long",
		}).format(date);
		const timePart = new Intl.DateTimeFormat(locale, {
			hour: "2-digit",
			minute: "2-digit",
		}).format(date);
		const between = String(locale || "").toLowerCase().startsWith("ru") ? " в " : " ";

		return `${datePart}${between}${timePart}`;
	};

	const historyActionIcon = (action) => {
		switch(action) {
			case "approved":
				return (
					<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="history-item__icon lucide lucide-check-icon lucide-check">
						<path d="M20 6 9 17l-5-5"></path>
					</svg>
				);
			case "rejected":
				return (
					<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="history-item__icon lucide lucide-x-icon lucide-x">
						<path d="M18 6 6 18"></path>
						<path d="m6 6 12 12"></path>
					</svg>
				);
			case "queued":
				return (
					<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="history-item__icon lucide lucide-history-icon lucide-history">
						<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path>
						<path d="M3 3v5h5"></path>
						<path d="M12 7v5l4 2"></path>
					</svg>
				);
			default:
				return (
					<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="history-item__icon lucide lucide-circle-icon lucide-circle">
						<circle cx="12" cy="12" r="10"></circle>
					</svg>
				);
		}
	};

	return (
		<div className="project-moderation">
			<section className="project-moderation__hero">
				<div className="project-moderation__summary">
					<div className="project-moderation__heading">
						<h1>{t("moderation.title")}</h1>
					</div>

					<p>{t("moderation.description")}</p>
				</div>

				{projectStatus !== "queued" && projectStatus !== "approved" ? (
					<button className="button button--size-m button--type-primary button--active-transform project-moderation__action" type="button" onClick={handleSubmit} disabled={loading || !canSubmit}>
						{loading ? t("moderation.actions.submitting") : t("moderation.actions.submit")}
					</button>
				) : null}
			</section>

			<ProjectStatusBanner type={statusBannerType} showAction={false} />

			<div className="project-moderation__layout">
				<section className="project-moderation__readiness" aria-labelledby="moderation-readiness-title">
					<div className="project-moderation__section-header">
						<h2 id="moderation-readiness-title">{t("moderation.readiness.title")}</h2>

						<span className="project-moderation__count">{completedRequirements}/4</span>
					</div>

					<div className="content content--padding project-moderation__requirements" role="list">
						<div className={`project-moderation__requirement ${hasIcon ? "is-complete" : "is-incomplete"}`} role="listitem">
							<div className="project-moderation__requirement-icon">
								<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
									<rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
									<circle cx="9" cy="9" r="2" />
									<path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
								</svg>
							</div>

							<div className="project-moderation__requirement-copy">
								<h3>{t("moderation.cards.icon.title")}</h3>
								
								<p>{t(`moderation.cards.icon.${hasIcon ? "done" : "required"}`)}</p>
							</div>

							<div className="project-moderation__requirement-status">
								{hasIcon ? (
									<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
								) : (
									<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 8v4" /><path d="M12 16h.01" /></svg>
								)}
							</div>
						</div>

						<div className={`project-moderation__requirement ${hasSummary ? "is-complete" : "is-incomplete"}`} role="listitem">
							<div className="project-moderation__requirement-icon">
								<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
									<path d="M12 4v16" />
									<path d="M4 7V5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v2" />
									<path d="M9 20h6" />
								</svg>
							</div>

							<div className="project-moderation__requirement-copy">
								<h3>{t("moderation.cards.summary.title")}</h3>
								
								<p>{t(`moderation.cards.summary.${hasSummary ? "done" : "required"}`)}</p>
							</div>

							<div className="project-moderation__requirement-status">
								{hasSummary ? (
									<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
								) : (
									<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 8v4" /><path d="M12 16h.01" /></svg>
								)}
							</div>
						</div>

						<div className={`project-moderation__requirement ${hasDescription ? "is-complete" : "is-incomplete"}`} role="listitem">
							<div className="project-moderation__requirement-icon">
								<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
									<path d="M15 5h6" />
									<path d="M15 12h6" />
									<path d="M3 19h18" />
									<path d="m3 12 3.553-7.724a.5.5 0 0 1 .894 0L11 12" />
									<path d="M3.92 10h6.16" />
								</svg>
							</div>

							<div className="project-moderation__requirement-copy">
								<h3>{t("moderation.cards.description.title")}</h3>
								
								<p>{t(`moderation.cards.description.${hasDescription ? "done" : "required"}`)}</p>
							</div>

							<div className="project-moderation__requirement-status">
								{hasDescription ? (
									<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
								) : (
									<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 8v4" /><path d="M12 16h.01" /></svg>
								)}
							</div>
						</div>

						<div className={`project-moderation__requirement ${hasVersions ? "is-complete" : "is-incomplete"}`} role="listitem">
							<div className="project-moderation__requirement-icon">
								<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
									<path d="M12 17V3" />
									<path d="m6 11 6 6 6-6" />
									<path d="M19 21H5" />
								</svg>
							</div>

							<div className="project-moderation__requirement-copy">
								<h3>{t("moderation.cards.versions.title")}</h3>
								
								<p>{t(`moderation.cards.versions.${hasVersions ? "done" : "required"}`)}</p>
							</div>

							<div className="project-moderation__requirement-status">
								{hasVersions ? (
									<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
								) : (
									<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 8v4" /><path d="M12 16h.01" /></svg>
								)}
							</div>
						</div>
					</div>
				</section>

				<section className="moderation-history project-moderation__history" aria-labelledby="moderation-history-title">
					<div className="project-moderation__section-header">
						<h2 id="moderation-history-title">{t("moderation.history.title")}</h2>
					</div>

					{moderationHistory.length === 0 ? (
						<div className="content content--padding project-moderation__history-card">
							<div className="project-moderation__history-empty">
								<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
									<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
									<path d="M3 3v5h5" />
									<path d="M12 7v5l4 2" />
								</svg>

								<p>{t("moderation.history.empty")}</p>
							</div>
						</div>
					) : (
						<div className="history-list">
							{moderationHistory.map((entry) => (
								<div key={entry.id} className={`history-item ${entry.action}`}>
									<div className="history-item__main">
										{historyActionIcon(entry.action)}

										<div className="history-item__meta">
											<div className="date">{formatHistoryDate(entry.createdAt)}</div>
											
											<div className="action">
												{historyActionLabel(entry.action)}
											</div>

											{entry.reason && entry.action !== "approved" && (
												<div className="reason">
													{t("moderation.history.reason")}: {entry.reason}
												</div>
											)}
										</div>
									</div>
								</div>
							))}
						</div>
					)}
				</section>
			</div>
		</div>
	);
}