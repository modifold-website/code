"use client";

import Link from "next/link";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "react-toastify";
import ModJamSubmitProjectModal from "@/modal/ModJamSubmitProjectModal";

function formatDate(value, locale, hideCurrentYear = false) {
	if(!value) {
		return "";
	}

	const date = new Date(value);
	const formatOptions = { day: "numeric", month: "short" };

	if(!hideCurrentYear || date.getFullYear() !== new Date().getFullYear()) {
		formatOptions.year = "numeric";
	}

	return new Intl.DateTimeFormat(locale, formatOptions).format(date);
}

export default function ModJamMasthead({ jam, permissions = {}, submissionsCount = 0, authToken, submissions = [] }) {
	const locale = useLocale();
	const t = useTranslations("ModJamsPage");
	const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
	const [participantsCount, setParticipantsCount] = useState(Number(jam.participants_count) || 0);
	const [userJoined, setUserJoined] = useState(Boolean(jam.user_joined));
	const [isJoining, setIsJoining] = useState(false);
	const isJoinPhase = jam.lifecycle === "running";
	const canSubmitProject = jam.lifecycle === "submissions_open";
	const shouldShowSubmitProject = jam.lifecycle === "submissions_open";
	const dateRange = `${formatDate(jam.starts_at, locale, true)} — ${formatDate(jam.voting_end_at, locale, true)}`;
	const join = async () => {
		if(isJoining || userJoined) {
			return;
		}

		if(!authToken) {
			toast.error(t("join.loginRequired"));
			return;
		}

		if(!permissions.can_join) {
			return;
		}

		setIsJoining(true);

		try {
			const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE}/mod-jams/${jam.slug}/participants`, {
				method: "POST",
				headers: { Authorization: `Bearer ${authToken}` },
			});

			const data = await response.json().catch(() => ({}));
			if(!response.ok) {
				throw new Error(data?.message || t("join.error"));
			}

			setUserJoined(true);
			setParticipantsCount(Number(data.participants_count) || participantsCount + 1);
			toast.success(t("join.success"));
		} catch (error) {
			toast.error(error.message);
		} finally {
			setIsJoining(false);
		}
	};

	return (
		<>
			<section className="mod-jam-sidebar-card">
				<div className="mod-jam-sidebar-card-cover">
					{jam.cover_url ? <img src={jam.cover_url} loading="lazy" alt="" /> : null}
				</div>

				<div className="mod-jam-sidebar-card-body">
					<div className="mod-jam-sidebar-card-header">
						<img className="mod-jam-sidebar-card-icon" src={jam.avatar_url || "https://media.modifold.com/static/no-project-icon.svg"} alt="" />
						
						<div className="mod-jam-sidebar-card-header-text">
							<div className="mod-jam-sidebar-card-title-row">
								<span className="mod-jam-sidebar-card-title">{jam.title}</span>
							</div>

							<p className="mod-jam-sidebar-card-description">{jam.summary}</p>
						</div>
					</div>

					<div className="mod-jam-sidebar-card-stats">
						<div className="mod-jam-sidebar-card-stat">
							<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
								<path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"></path>
								<path d="m3.3 7 8.7 5 8.7-5"></path>
								<path d="M12 22V12"></path>
							</svg>

							<span>{submissionsCount}</span>
						</div>

						{(isJoinPhase || participantsCount > 0) && (
							<div className="mod-jam-sidebar-card-stat">
								<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
									<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
									<circle cx="9" cy="7" r="4"></circle>
									<path d="M22 21v-2a4 4 0 0 0-3-3.87"></path>
									<path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
								</svg>

								<span>{participantsCount}</span>
							</div>
						)}

						<div className="mod-jam-sidebar-card-stat mod-jam-sidebar-card-updated">
							<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" className="lucide lucide-heart-icon lucide-update">
								<path d="M3 3v5h5"></path>
								<path d="M3.05 13A9 9 0 1 0 6 5.3L3 8"></path>
								<path d="M12 7v5l4 2"></path>
							</svg>

							<span>{dateRange}</span>
						</div>
					</div>

					{isJoinPhase && (
						<button className="button button--size-m button--type-minimal button--active-transform button--with-icon" type="button" disabled={isJoining || userJoined || Boolean(authToken && !permissions.can_join)} onClick={join}>
							<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon lucide lucide-plus-icon lucide-plus">
								<path d="M5 12h14"></path>
								<path d="M12 5v14"></path>
							</svg>

							{userJoined ? t("join.joined") : t("participate")}
						</button>
					)}

					{shouldShowSubmitProject && (
						<button className="button button--size-m button--type-minimal button--active-transform button--with-icon" type="button" disabled={!canSubmitProject} onClick={() => canSubmitProject && setIsSubmitModalOpen(true)}>
							<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon lucide lucide-plus-icon lucide-plus">
								<path d="M5 12h14"></path>
								<path d="M12 5v14"></path>
							</svg>

							{t("participate")}
						</button>
					)}

					{permissions.can_edit && (
						<Link className="button button--size-m button--with-icon button--active-transform button--type-minimal" href={`/jams/${jam.slug}/settings`}>
							<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon lucide lucide-settings-icon lucide-settings">
								<path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915"></path>
								<circle cx="12" cy="12" r="3"></circle>
							</svg>

							{t("detail.editSettings")}
						</Link>
					)}
				</div>
			</section>

			<ModJamSubmitProjectModal isOpen={isSubmitModalOpen} jam={jam} authToken={authToken} submissions={submissions} onRequestClose={() => setIsSubmitModalOpen(false)} />
		</>
	);
}