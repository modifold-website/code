"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/providers/AuthProvider";
import { useTranslations } from "next-intl";
import UserSettingsSidebar from "@/components/ui/UserSettingsSidebar";
import ModJamCreationModal from "@/modal/ModJamCreationModal";

export default function ModJamsDashboardPage({ authToken, initialJams = [] }) {
	const { user } = useAuth();
	const t = useTranslations("ModJamsDashboard");
	const tSidebar = useTranslations("SettingsBlogPage.sidebar");
	const [jams, setJams] = useState(initialJams);
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
						analytics: tSidebar("analytics"),
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
						<span className="notifications__header-text">{t("title")}</span>

						<button type="button" className="button button--size-m button--type-primary button--active-transform" onClick={() => setIsCreateModalOpen(true)}>
							{t("create")}
						</button>
					</div>

					{jams.length === 0 ? (
						<div className="subsite-empty-feed">
							<p className="subsite-empty-feed__title">{t("empty")}</p>
						</div>
					) : (
						<div className="mod-jams-dashboard-list">
							{jams.map((jam) => (
								<div key={jam.id} className="new-project-card mod-jams-dashboard-card">
									<Link className="new-project-card__overlay" href={`/jams/${jam.slug}`} aria-label={jam.title} />

									<img className="new-project-icon" src={jam.avatar_url || "https://media.modifold.com/static/no-project-icon.svg"} alt={jam.title} />

									<div className="new-project-info">
										<div className="new-project-header" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
											<span className="new-project-title" style={{ fontWeight: "500" }}>{jam.title}</span>
										</div>

										<p className="new-project-description">{jam.summary}</p>

										<p className="mod-jams-dashboard-card__meta">
											<div className="masthead-stats__item">
												<svg className="masthead-stats__icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
													<path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"></path>
													<path d="m3.3 7 8.7 5 8.7-5"></path>
													<path d="M12 22V12"></path>
												</svg>
												
												<div className="masthead-stats__quantity">{jam.submissions_count || 0}</div>
											</div>
										</p>
									</div>

									<div className="new-project-stats">
										<Link href={`/jams/${jam.slug}/settings`} className="button button--size-m button--type-minimal dashboard-project-settings-button" onClick={(event) => event.stopPropagation()} onMouseDown={(event) => event.stopPropagation()}>
											<svg style={{ fill: "none", marginRight: "4px" }} xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon icon--settings">
												<path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915"></path>
												<circle cx="12" cy="12" r="3"></circle>
											</svg>

											{t("settings")}
										</Link>
									</div>
								</div>
							))}
						</div>
					)}
				</div>
			</div>

			<ModJamCreationModal
				isOpen={isCreateModalOpen}
				authToken={authToken}
				onRequestClose={() => setIsCreateModalOpen(false)}
				onCreated={(created) => {
					if(created?.id) {
						setJams((current) => [created, ...current]);
					}
				}}
			/>
		</div>
	);
}