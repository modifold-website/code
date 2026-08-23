"use client";

import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import Link from "next/link";
import { useTranslations } from "next-intl";
import OrganizationSettingsSidebar from "@/components/organizations/settings/OrganizationSettingsSidebar";
import ProjectTags from "@/components/ui/ProjectTags";
import ConfirmModal from "@/modal/ConfirmModal";
import { getProjectPath } from "@/utils/projectRoutes";

const PROJECT_SETTINGS_PERMISSIONS = [
	"project_edit_details",
	"project_edit_body",
	"project_edit_gallery",
	"project_manage_versions",
];

export default function OrganizationProjectsSettingsPage({ authToken, organization, projects = [], my_permissions }) {
	const t = useTranslations("Organizations");
	const tDashboard = useTranslations("DashboardClient");
	const [projectItems, setProjectItems] = useState(Array.isArray(projects) ? projects : []);
	const [detachingProjectSlug, setDetachingProjectSlug] = useState(null);
	const [pendingDetachProject, setPendingDetachProject] = useState(null);
	const [openActionsProjectId, setOpenActionsProjectId] = useState(null);
	const actionsMenuRef = useRef(null);

	const canDetachProjects = Boolean(
		my_permissions?.is_owner ||
		my_permissions?.organization_permissions?.includes("organization_remove_project")
	);

	const canOpenProjectSettings = (project) => Boolean(
		my_permissions?.is_owner ||
		project.permissions?.can_open_settings ||
		(project.permissions === undefined && PROJECT_SETTINGS_PERMISSIONS.some((permission) => my_permissions?.project_permissions?.includes(permission)))
	);

	useEffect(() => {
		if(!openActionsProjectId) {
			return undefined;
		}

		const handlePointerDown = (event) => {
			if(!actionsMenuRef.current?.contains(event.target)) {
				setOpenActionsProjectId(null);
			}
		};
		const handleKeyDown = (event) => {
			if(event.key === "Escape") {
				setOpenActionsProjectId(null);
			}
		};
		document.addEventListener("mousedown", handlePointerDown);
		document.addEventListener("keydown", handleKeyDown);
		return () => {
			document.removeEventListener("mousedown", handlePointerDown);
			document.removeEventListener("keydown", handleKeyDown);
		};
	}, [openActionsProjectId]);

	const handleDetachProject = async (project) => {
		if(!canDetachProjects || detachingProjectSlug) {
			return;
		}

		setDetachingProjectSlug(project.slug);
		setOpenActionsProjectId(null);

		try {
			await axios.put(`${process.env.NEXT_PUBLIC_API_BASE}/projects/${project.slug}/organization`, {
				organization_slug: null,
			}, {
				headers: {
					Authorization: `Bearer ${authToken}`,
				},
			});

			setProjectItems((current) => current.filter((item) => item.slug !== project.slug));
			setPendingDetachProject(null);
			toast.success(t("settings.successProjectDetached", { title: project.title }));
		} catch (error) {
			toast.error(error.response?.data?.message || t("settings.errors.projectDetach"));
		} finally {
			setDetachingProjectSlug(null);
		}
	};

	return (
		<div className="layout">
			<div className="page-content settings-page">
				<OrganizationSettingsSidebar organization={organization} />

				<div className="settings-content organization-projects-settings">
					<div className="content content--padding organization-projects-settings__header">
						<h2>{t("settings.projectsTitle")}</h2>
					</div>

					{projectItems.length === 0 ? (
						<div className="content content--padding organization-projects-settings__empty">
							<p>{t("settings.emptyProjects")}</p>
						</div>
					) : (
						<div className="projects-grid organization-projects-settings__list">
							{projectItems.map((project) => {
								const hasTags = project.tags?.length > 0;

								return (
									<article key={project.id} className="new-project-card dashboard-project-card organization-projects-settings__card">
										<Link className="new-project-card__overlay" href={getProjectPath(project)} aria-label={project.title} />

										<div className={`dashboard-project-card__content ${hasTags ? "dashboard-project-card__content--with-tags" : ""}`}>
											<img className="new-project-icon" src={project.icon_url || "https://media.modifold.com/static/no-project-icon.svg"} alt={tDashboard("projectIconAlt", { title: project.title })} />

											<div className="new-project-info">
												<div className="new-project-header">
													<span className="new-project-title">{project.title}</span>
												</div>

												<p className="new-project-description">{project.summary}</p>
											</div>
										</div>

										{hasTags ? (
											<div className="new-project-tags dashboard-project-card__tags">
												<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-tags-icon lucide-tags" aria-hidden="true">
													<path d="M13.172 2a2 2 0 0 1 1.414.586l6.71 6.71a2.4 2.4 0 0 1 0 3.408l-4.592 4.592a2.4 2.4 0 0 1-3.408 0l-6.71-6.71A2 2 0 0 1 6 9.172V3a1 1 0 0 1 1-1z" />
													<path d="M2 7v6.172a2 2 0 0 0 .586 1.414l6.71 6.71a2.4 2.4 0 0 0 3.191.193" />
													<circle cx="10.5" cy="6.5" r=".5" fill="currentColor" />
												</svg>

												<ProjectTags limit={5} tags={project.tags} />
											</div>
										) : null}

										{canOpenProjectSettings(project) || canDetachProjects ? (
											<div className="dashboard-project-card__actions organization-projects-settings__actions">
												{canOpenProjectSettings(project) ? (
													<Link href={`${getProjectPath(project)}/settings`} className="button button--size-m button--type-minimal dashboard-project-settings-button" onClick={(event) => event.stopPropagation()} onMouseDown={(event) => event.stopPropagation()}>
														<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon icon--settings" aria-hidden="true">
															<path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915" />
															<circle cx="12" cy="12" r="3" />
														</svg>

														{tDashboard("edit")}
													</Link>
												) : null}

												{canDetachProjects ? (
													<div className="organization-projects-settings__menu" ref={openActionsProjectId === project.id ? actionsMenuRef : null}>
														<button type="button" className="icon-button organization-projects-settings__menu-button" onClick={(event) => { event.stopPropagation(); setOpenActionsProjectId((current) => current === project.id ? null : project.id); }} onMouseDown={(event) => event.stopPropagation()} aria-label={t("settings.actions.moreProjectActions", { title: project.title })} aria-haspopup="menu" aria-expanded={openActionsProjectId === project.id}>
															<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
																<circle cx="12" cy="12" r="1" />
																<circle cx="19" cy="12" r="1" />
																<circle cx="5" cy="12" r="1" />
															</svg>
														</button>

														{openActionsProjectId === project.id ? (
															<div className="popover organization-projects-settings__popover" role="menu">
																<div className="context-list">
																	<button type="button" className="context-list-option context-list-option--with-art color--negative" role="menuitem" onClick={() => { setOpenActionsProjectId(null); setPendingDetachProject(project); }} disabled={detachingProjectSlug === project.slug}>
																		<span className="context-list-option__art context-list-option__art--icon">
																			<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
																				<path d="m18.84 12.25 1.72-1.71a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
																				<path d="m5.17 11.75-1.71 1.71a5 5 0 0 0 7.07 7.07l1.71-1.71" />
																				<line x1="8" x2="8" y1="2" y2="5" />
																				<line x1="2" x2="5" y1="8" y2="8" />
																				<line x1="16" x2="16" y1="19" y2="22" />
																				<line x1="19" x2="22" y1="16" y2="16" />
																			</svg>
																		</span>

																		<span className="context-list-option__label">
																			{t("settings.actions.detachProject")}
																		</span>
																	</button>
																</div>
															</div>
														) : null}
													</div>
												) : null}
											</div>
										) : null}
									</article>
								);
							})}
						</div>
					)}
				</div>
			</div>

			<ConfirmModal
				isOpen={Boolean(pendingDetachProject)}
				title={pendingDetachProject ? t("settings.confirmDetachProject", { title: pendingDetachProject.title }) : ""}
				confirmLabel={t("settings.actions.detachProject")}
				cancelLabel={t("settings.delete.cancel")}
				isLoading={Boolean(detachingProjectSlug)}
				onConfirm={() => handleDetachProject(pendingDetachProject)}
				onRequestClose={() => {
					if(!detachingProjectSlug) {
						setPendingDetachProject(null);
					}
				}}
			/>
		</div>
	);
}