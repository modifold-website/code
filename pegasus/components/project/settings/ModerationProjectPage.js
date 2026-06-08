"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "../../providers/AuthProvider";
import { useRouter } from "next/navigation";
import axios from "axios";
import { toast } from "react-toastify";
import { useLocale, useTranslations } from "next-intl";

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
        <div>
            <div className="settings-wrapper" style={{ width: "100%" }}>
                <div className="settings-content">
                    <div className="blog-settings">
                        <div className="blog-settings__body">
                            <p className="blog-settings__field-title">
                                {t("moderation.title")}
                            </p>

                            <p style={{ marginBottom: "14px" }}>{t("moderation.description")}</p>

                            <button className="button button--size-m button--type-primary" onClick={handleSubmit} disabled={loading || !canSubmit}>
                                {loading ? t("moderation.actions.submitting") : projectStatus === "queued" ? t("moderation.actions.alreadySubmitted") : projectStatus === "approved" ? t("moderation.actions.approved") : t("moderation.actions.submit")}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="bento-grid">
                <div className={`bento-card ${hasIcon ? "completed" : "incomplete"}`}>
                    <div className="card-status">
                        {hasIcon ? (
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-check-icon lucide-check"><path d="M20 6 9 17l-5-5"></path></svg>
                        ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-x-icon lucide-x"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                        )}
                    </div>

                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="card-icon"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
                    <h3>{t("moderation.cards.icon.title")}</h3>

                    <p>{hasIcon ? t("moderation.cards.icon.done") : t("moderation.cards.icon.required")}</p>
                </div>

                <div className={`bento-card ${hasSummary ? "completed" : "incomplete"}`}>
                    <div className="card-status">
                        {hasSummary ? (
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-check-icon lucide-check"><path d="M20 6 9 17l-5-5"></path></svg>
                        ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-x-icon lucide-x"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                        )}
                    </div>

                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="card-icon"><path d="M12 4v16"/><path d="M4 7V5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v2"/><path d="M9 20h6"/></svg>
                    <h3>{t("moderation.cards.summary.title")}</h3>

                    <p>{hasSummary ? t("moderation.cards.summary.done") : t("moderation.cards.summary.required")}</p>
                </div>

                <div className={`bento-card description-card ${hasDescription ? "completed" : "incomplete"}`}>
                    <div className="card-status">
                        {hasDescription ? (
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-check-icon lucide-check"><path d="M20 6 9 17l-5-5"></path></svg>
                        ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-x-icon lucide-x"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                        )}
                    </div>

                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="card-icon"><path d="M15 5h6"/><path d="M15 12h6"/><path d="M3 19h18"/><path d="m3 12 3.553-7.724a.5.5 0 0 1 .894 0L11 12"/><path d="M3.92 10h6.16"/></svg>
                    <h3>{t("moderation.cards.description.title")}</h3>

                    <p>{hasDescription ? t("moderation.cards.description.done") : t("moderation.cards.description.required")}</p>
                </div>

                <div className={`bento-card ${hasVersions ? "completed" : "incomplete"}`}>
                    <div className="card-status">
                        {hasVersions ? (
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-check-icon lucide-check"><path d="M20 6 9 17l-5-5"></path></svg>
                        ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-x-icon lucide-x"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                        )}
                    </div>

                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="card-icon"><path d="M12 17V3"/><path d="m6 11 6 6 6-6"/><path d="M19 21H5"/></svg>
                    <h3>{t("moderation.cards.versions.title")}</h3>

                    <p>{hasVersions ? t("moderation.cards.versions.done") : t("moderation.cards.versions.required")}</p>
                </div>
            </div>

            <div className="moderation-history">
                <p className="blog-settings__field-title" style={{ marginBottom: "8px" }}>{t("moderation.history.title")}</p>

                {moderationHistory.length === 0 ? (
                    <div className="subsite-empty-feed">
                        <p className="subsite-empty-feed__title">{t("moderation.history.empty")}</p>
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
									</div>
								</div>

								{entry.reason && entry.action !== "approved" && (
									<div className="reason">
										{t("moderation.history.reason")}: {entry.reason}
									</div>
								)}
							</div>
						))}
					</div>
				)}
            </div>
        </div>
    );
}