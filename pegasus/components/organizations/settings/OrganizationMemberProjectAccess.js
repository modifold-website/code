"use client";

import { useState } from "react";
import OrganizationProjectPermissionsModal from "@/modal/OrganizationProjectPermissionsModal";

const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);

export default function OrganizationMemberProjectAccess({ draft, projects, directProjectAccess = [], defaultPermissions, availablePermissions, canManageProjectAccess, isSaving = false, onSave, t }) {
	const [isOpen, setIsOpen] = useState(false);
	const projectOverrides = draft.project_overrides || {};
	const directProjectIds = new Set(directProjectAccess.map((projectAccess) => String(projectAccess.project_id)));
	const accessibleProjects = projects.filter((project) => hasOwn(projectOverrides, String(project.id)) || directProjectIds.has(String(project.id)));
	const visibleProjects = accessibleProjects.slice(0, 3);
	const hiddenProjectsCount = Math.max(0, accessibleProjects.length - visibleProjects.length);

	return (
		<>
			<div className="organization-project-access-summary">
				<div className="organization-project-access-summary__main">
					{visibleProjects.length > 0 ? (
						<div className="organization-project-access-summary__avatars" aria-hidden="true">
							{visibleProjects.map((project) => (
								<img key={project.id} src={project.icon_url || "https://media.modifold.com/static/no-project-icon.svg"} alt="" title={project.title} />
							))}

							{hiddenProjectsCount > 0 ? (
								<span>+{hiddenProjectsCount}</span>
							) : null}
						</div>
					) : null}

					<div className="organization-project-access-summary__copy">
						<strong>{t("settings.projectAccess.title")}</strong>
					</div>
				</div>

				<button type="button" className="button button--size-m button--type-minimal" onClick={() => setIsOpen(true)} disabled={!canManageProjectAccess}>
					{t("settings.projectAccess.configureAccess")}
				</button>
			</div>

			<OrganizationProjectPermissionsModal
				isOpen={isOpen}
				draft={draft}
				projects={projects}
				directProjectAccess={directProjectAccess}
				defaultPermissions={defaultPermissions}
				availablePermissions={availablePermissions}
				canManageProjectAccess={canManageProjectAccess}
				canManageProjectPermissions={canManageProjectAccess}
				isSaving={isSaving}
				onSave={async (nextDraft) => {
					const saved = await onSave(nextDraft);
					if(saved !== false) setIsOpen(false);
				}}
				onRequestClose={() => {
					if(!isSaving) setIsOpen(false);
				}}
			/>
		</>
	);
}