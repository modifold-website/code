"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import Modal from "react-modal";

const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const normalizePermissions = (permissions) => Array.from(new Set(Array.isArray(permissions) ? permissions : []));
// WIP
const PERMISSION_GROUPS = [
	{ key: "versions", permissions: ["project_upload_version", "project_edit_version", "project_delete_version"] },
	{ key: "content", permissions: ["project_edit_details", "project_edit_body", "project_edit_gallery"] },
	{ key: "team", permissions: ["project_manage_invites", "project_edit_members", "project_remove_members"] },
	{ key: "analytics", permissions: ["project_view_analytics"] },
	{ key: "danger", permissions: ["project_delete"] },
];

const toggleValue = (values, value) => values.includes(value) ? values.filter((item) => item !== value) : [...values, value];

function PermissionToggle({ active, disabled, label, onClick }) {
	return (
		<button type="button" className={`organization-member-card__permission-toggle ${active ? "organization-member-card__permission-toggle--active" : ""}`} aria-pressed={active} onClick={onClick} disabled={disabled}>
			<span className={`organization-member-card__permission-check ${active ? "organization-member-card__permission-check--active" : ""}`} aria-hidden="true">
				{active ? (
					<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
						<path d="M20 6 9 17l-5-5" />
					</svg>
				) : null}
			</span>

			<span>{label}</span>
		</button>
	);
}

export default function OrganizationProjectPermissionsModal({ isOpen, draft, projects, directProjectAccess = [], defaultPermissions, availablePermissions, canManageProjectAccess, canManageProjectPermissions, isSaving = false, onSave, onRequestClose }) {
	const t = useTranslations("Organizations");
	const tProject = useTranslations("ProjectCollaborators");
	const appElement = typeof document !== "undefined" ? document.getElementById("app") : undefined;
	const draftKey = JSON.stringify(draft);
	const [page, setPage] = useState("overview");
	const [editingProjectId, setEditingProjectId] = useState(null);
	const [workingDraft, setWorkingDraft] = useState(draft);
	const contentRef = useRef(null);

	useEffect(() => {
		if(!isOpen) {
			return;
		}

		setWorkingDraft(draft);
		setPage("overview");
		setEditingProjectId(null);
	}, [draftKey, isOpen]);

	const projectOverrides = workingDraft.project_overrides || {};
	const directProjectIds = new Set(directProjectAccess.map((projectAccess) => String(projectAccess.project_id)));
	const hasAnyDirectAccess = directProjectIds.size > 0;
	const editingProject = projects.find((project) => String(project.id) === editingProjectId) || null;
	const editingProjectPermissions = editingProjectId && Array.isArray(projectOverrides[editingProjectId]?.project_permissions) ? projectOverrides[editingProjectId].project_permissions : [];

	const changePage = (nextPage, projectId = null) => {
		contentRef.current?.scrollTo({ top: 0 });
		if(projectId !== null) {
			setEditingProjectId(projectId);
		}
		setPage(nextPage);
	};

	const toggleProjectAccess = (projectId) => {
		if(!canManageProjectAccess) {
			return;
		}

		setWorkingDraft((current) => {
			const nextOverrides = { ...(current.project_overrides || {}) };
			if(hasOwn(nextOverrides, projectId)) {
				delete nextOverrides[projectId];
			} else {
				nextOverrides[projectId] = { project_permissions: normalizePermissions(defaultPermissions) };
			}

			return { ...current, project_overrides: nextOverrides };
		});
	};

	const toggleProjectPermission = (permission) => {
		if(!editingProjectId || !canManageProjectPermissions) {
			return;
		}

		setWorkingDraft((current) => ({
			...current,
			project_overrides: {
				...current.project_overrides,
				[editingProjectId]: {
					project_permissions: toggleValue(editingProjectPermissions, permission),
				},
			},
		}));
	};

	const renderProjectPermissions = () => (
		<>
			<div className="organization-project-permissions-modal__project">
				<img src={editingProject?.icon_url || "https://cdn.modifold.com/static/no-project-icon.svg"} alt="" />

				<div>
					<strong>{editingProject?.title}</strong>
					<span>{t("settings.projectAccess.modalDescription")}</span>
				</div>
			</div>

			<div className="organization-project-permissions-modal__permissions">
				{PERMISSION_GROUPS.map((group) => {
					const permissions = group.permissions.filter((permission) => availablePermissions.includes(permission));
					if(permissions.length === 0) {
						return null;
					}

					return (
						<section className={`organization-project-permissions-modal__permission-group organization-project-permissions-modal__permission-group--${group.key}`} key={group.key}>
							<h3>{t(`settings.projectAccess.permissionGroups.${group.key}`)}</h3>

							<div className="organization-member-card__permissions-grid organization-project-permissions-modal__permissions-grid">
								{permissions.map((permission) => (
									<PermissionToggle key={permission} active={editingProjectPermissions.includes(permission)} disabled={!canManageProjectPermissions} label={tProject(`permissions.${permission}`)} onClick={() => toggleProjectPermission(permission)} />
								))}
							</div>
						</section>
					);
				})}
			</div>
		</>
	);

	const renderProjects = () => (
		<>
			<p className="organization-project-permissions-modal__description">{t("settings.projectAccess.description")}</p>
			{hasAnyDirectAccess ? <p className="organization-project-permissions-modal__direct-hint">{t("settings.projectAccess.directAccessHint")}</p> : null}

			{projects.length > 0 ? (
				<div className="organization-project-access__list">
					{projects.map((project) => {
						const projectId = String(project.id);
						const hasAccess = hasOwn(projectOverrides, projectId);

						return (
							<div className={`organization-project-access__project ${hasAccess ? "organization-project-access__project--active" : ""}`} key={projectId}>
								<div className="organization-project-access__project-header">
									<button type="button" className="organization-project-access__project-toggle" onClick={() => toggleProjectAccess(projectId)} aria-label={t(`settings.projectAccess.${hasAccess ? "revokeAccess" : "grantAccess"}`, { project: project.title })} aria-pressed={hasAccess} disabled={!canManageProjectAccess}>
										<span className={`organization-member-card__permission-check ${hasAccess ? "organization-member-card__permission-check--active" : ""}`} aria-hidden="true">
											{hasAccess ? (
												<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
													<path d="M20 6 9 17l-5-5" />
												</svg>
											) : null}
										</span>

										<img src={project.icon_url || "https://cdn.modifold.com/static/no-project-icon.svg"} alt="" />

										<span className="organization-project-access__project-copy">
											<strong>{project.title}</strong>
											<small>{t(`settings.projectAccess.${hasAccess ? "accessGranted" : "noAccess"}`)}</small>
										</span>
									</button>

									<button type="button" className="button button--size-s button--type-minimal organization-project-access__configure" onClick={() => changePage("project", projectId)} aria-label={t("settings.projectAccess.configureProject", { project: project.title })} disabled={!hasAccess || !canManageProjectPermissions}>
										{t("settings.projectAccess.configure")}
									</button>
								</div>
							</div>
						);
					})}
				</div>
			) : (
				<p className="organization-project-access__empty">{t("settings.projectAccess.empty")}</p>
			)}
		</>
	);

	return (
		<Modal appElement={appElement} closeTimeoutMS={150} isOpen={isOpen} onRequestClose={onRequestClose} className="modal active organization-project-permissions-modal" overlayClassName="modal-overlay" contentLabel={t("settings.projectAccess.manageModalTitle")}>
			<div className="modal-window">
				<div className={`modal-window__header organization-project-permissions-modal__header ${page === "project" ? "organization-project-permissions-modal__header--back" : ""}`}>
					{page === "project" ? (
						<button className="icon-button modal-window__back" type="button" onClick={() => changePage("overview")} aria-label={t("settings.projectAccess.back")} disabled={isSaving}>
							<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
								<path d="m15 18-6-6 6-6" />
							</svg>
						</button>
					) : null}

					<h2 className="modal-window__title">{page === "project" ? t("settings.projectAccess.modalTitle") : t("settings.projectAccess.manageModalTitle")}</h2>

					<button className="icon-button modal-window__close" type="button" onClick={onRequestClose} aria-label={t("settings.projectAccess.cancel")} disabled={isSaving}>
						<svg className="icon icon--cross" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
							<path d="M18 6 6 18" />
							<path d="m6 6 12 12" />
						</svg>
					</button>
				</div>

				<div ref={contentRef} className="modal-window__content organization-project-permissions-modal__content">
					<div className="organization-project-permissions-modal__pages" data-page={page}>
						<section className="organization-project-permissions-modal__page" data-page-id="overview" aria-hidden={page !== "overview"} inert={page !== "overview"}>
							{renderProjects()}
						</section>

						<section className="organization-project-permissions-modal__page" data-page-id="project" aria-hidden={page !== "project"} inert={page !== "project"}>
							{editingProject ? renderProjectPermissions() : null}
						</section>
					</div>
				</div>

				<div className="confirm-modal__actions organization-project-permissions-modal__actions">
					<button type="button" className="button button--size-m button--type-minimal" onClick={onRequestClose} disabled={isSaving}>
						{t("settings.projectAccess.cancel")}
					</button>

					<button type="button" className="button button--size-m button--type-primary" onClick={() => onSave(workingDraft)} disabled={isSaving}>
						{t(`settings.projectAccess.${isSaving ? "saving" : "save"}`)}
					</button>
				</div>
			</div>
		</Modal>
	);
}