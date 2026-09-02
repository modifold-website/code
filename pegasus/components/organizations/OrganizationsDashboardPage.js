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

				<main className="settings-content organizations-dashboard settings-wrapper--narrow">
					<header className="organizations-dashboard__header">
						<div className="organizations-dashboard__heading">
							<h1>{t("dashboard.title")}</h1>
							<p>{t("dashboard.description")}</p>
						</div>

						<button type="button" className="button button--size-m button--type-primary button--active-transform organizations-dashboard__create" onClick={() => setIsCreateModalOpen(true)}>
							<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
								<path d="M5 12h14" />
								<path d="M12 5v14" />
							</svg>

							{t("dashboard.create")}
						</button>
					</header>

					{organizations.length === 0 ? (
						<div className="notifications">
							<div className="subsite-empty-feed">
								<p className="subsite-empty-feed__title">{t("dashboard.empty")}</p>
							</div>
						</div>
					) : (
						<div className="organizations-dashboard__list">
							{organizations.map((organization) => (
								<article key={organization.id} className="new-project-card dashboard-project-card organization-dashboard-card">
									<Link className="new-project-card__overlay" href={`/organization/${organization.slug}`} aria-label={t("dashboard.open", { organization: organization.name })} />

									<div className="dashboard-project-card__content organization-dashboard-card__content">
										<img className="new-project-icon organization-dashboard-card__icon" src={organization.icon_url || "https://cdn.modifold.com/static/no-project-icon.svg"} alt={t("dashboard.iconAlt", { organization: organization.name })} />

										<div className="new-project-info">
											<div className="organization-dashboard-card__title-row">
												<h2 className="new-project-title">{organization.name}</h2>
												<span className="organization-dashboard-card__role">{organization.role}</span>
											</div>

											<p className="new-project-description">{organization.summary || t("dashboard.noSummary")}</p>

											<div className="organization-dashboard-card__meta">
												<span>
													<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
														<path d="M18 21a8 8 0 0 0-16 0" />
														<circle cx="10" cy="8" r="5" />
														<path d="M22 20c0-3.37-2-6.5-4-8a5 5 0 0 0-.45-8.3" />
													</svg>

													{t("dashboard.members", { count: organization.members_count || 0 })}
												</span>

												<span>
													<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
														<path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
														<path d="m3.3 7 8.7 5 8.7-5" />
														<path d="M12 22V12" />
													</svg>

													{t("dashboard.projects", { count: organization.projects_count || 0 })}
												</span>
											</div>
										</div>
									</div>

									{organization.can_manage ? (
										<div className="dashboard-project-card__actions">
											<Link href={`/organization/${organization.slug}/settings`} className="button button--size-m button--type-minimal dashboard-project-settings-button" onClick={(event) => event.stopPropagation()} onMouseDown={(event) => event.stopPropagation()}>
												<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
													<path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915" />
													<circle cx="12" cy="12" r="3" />
												</svg>

												{t("dashboard.settings")}
											</Link>
										</div>
									) : null}
								</article>
							))}
						</div>
					)}
				</main>
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
							projects_count: 0,
							role: "Owner",
							is_owner: true,
							can_manage: true,
						},
						...prev,
					]));
				}}
			/>
		</div>
	);
}