"use client";

import UserName from "@/components/ui/UserName";

function PermissionCheck({ selected }) {
	return (
		<span className={`organization-member-card__permission-check ${selected ? "organization-member-card__permission-check--active" : ""}`} aria-hidden="true">
			{selected ? (
				<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
					<path d="M20 6 9 17l-5-5" />
				</svg>
			) : null}
		</span>
	);
}

export default function ProjectCollaboratorCard({ collaborator, draft, availablePermissions, expanded, onToggle, onChange, onRemove, onTransferOwnership, canEdit, canRemove, canTransferOwnership = false, isTransferDisabled = false, isRemoving, isTransferring = false, isProjectOwner = false, t }) {
	const permissions = Array.isArray(draft?.permissions) ? draft.permissions : [];
	const selectedPermissions = new Set(permissions);
	const role = draft?.role ?? collaborator.role ?? (isProjectOwner ? "Owner" : "Member");
	const showAsAuthor = Boolean(draft?.show_as_author);
	const bodyId = isProjectOwner ? `project-owner-${collaborator.user_id}-settings` : `project-collaborator-${collaborator.user_id}-permissions`;
	const isPending = collaborator.status === "pending";
	const statusKey = isProjectOwner ? "owner" : isPending ? "pending" : "accepted";

	const togglePermission = (permission) => {
		const nextPermissions = new Set(selectedPermissions);
		if(nextPermissions.has(permission)) {
			nextPermissions.delete(permission);
		} else {
			nextPermissions.add(permission);
		}
		onChange({ ...draft, permissions: Array.from(nextPermissions) });
	};

	return (
		<div className="content content--padding organization-member-card">
			<div className="organization-member-card__header">
				<div className="organization-member-card__identity">
					<img src={collaborator.avatar || "https://media.modifold.com/static/no-project-icon.svg"} alt="" className="organization-member-card__avatar" />

					<div className="project-collaborator-card__identity-copy">
						<div className="organization-member-card__name">
							<UserName user={collaborator} />
						</div>
						<div className="organization-member-card__role-preview">{role}</div>
					</div>
				</div>

				<div className="organization-member-card__actions">
					<div className={`organization-member-card__status ${isPending ? "organization-member-card__status--pending" : ""}`}>
						{t(`status.${statusKey}`)}
					</div>

					<button type="button" className="icon-button organization-member-card__expand" onClick={onToggle} aria-label={expanded ? t(isProjectOwner ? "actions.collapseOwner" : "actions.collapse") : t(isProjectOwner ? "actions.expandOwner" : "actions.expand")} aria-expanded={expanded} aria-controls={bodyId}>
						<svg className={`icon icon--chevron_down ${expanded ? "rotate" : ""}`} width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
							<path fillRule="evenodd" clipRule="evenodd" d="M17.707 8.793a1 1 0 0 1 0 1.414l-5 5a1 1 0 0 1-1.414 0l-5-5a1 1 0 1 1 1.414-1.414L12 13.086l4.293-4.293a1 1 0 0 1 1.414 0Z" fill="currentColor" />
						</svg>
					</button>
				</div>
			</div>

			<div className={`project-collaborator-card__body-region ${expanded ? "project-collaborator-card__body-region--expanded" : ""}`} id={bodyId} aria-hidden={!expanded} inert={!expanded}>
				<div className="project-collaborator-card__body-inner">
					<div className="organization-member-card__body">
						<p className="blog-settings__field-title">{t("role.title")}</p>
						<p className="project-collaborator-card__field-hint">{t(isProjectOwner ? "role.ownerDescription" : "role.description")}</p>
						<div className="field field--default blog-settings__input organization-member-card__role-field">
							<label className="field__wrapper">
								<input className="text-input" value={role} maxLength={50} placeholder={t("role.placeholder")} aria-label={t("role.title")} onChange={(event) => onChange({ ...draft, role: event.target.value })} disabled={!canEdit} />
							</label>
						</div>

						<p className="blog-settings__field-title">{t("authors.title")}</p>
						<p className="project-collaborator-card__field-hint">{t(isProjectOwner ? "authors.ownerDescription" : "authors.description")}</p>
						<button type="button" className={`organization-member-card__permission-toggle project-collaborator-card__author-toggle ${showAsAuthor ? "organization-member-card__permission-toggle--active" : ""}`} aria-pressed={showAsAuthor} onClick={() => onChange({ ...draft, show_as_author: !showAsAuthor })} disabled={!canEdit}>
							<PermissionCheck selected={showAsAuthor} />
							
							<span>{t(isProjectOwner ? "authors.ownerToggle" : "authors.toggle")}</span>
						</button>

						{!isProjectOwner ? (
							<>
								<p className="blog-settings__field-title">{t("permissionsTitle")}</p>
								<p className="project-collaborator-card__field-hint">{t("permissionsHint")}</p>
								
								<div className="organization-member-card__permissions-grid">
									{availablePermissions.map((permission) => {
										const selected = selectedPermissions.has(permission);
										return (
											<button key={permission} type="button" className={`organization-member-card__permission-toggle ${selected ? "organization-member-card__permission-toggle--active" : ""}`} aria-pressed={selected} onClick={() => togglePermission(permission)} disabled={!canEdit}>
												<PermissionCheck selected={selected} />
												
												<span>{t(`permissions.${permission}`)}</span>
											</button>
										);
									})}
								</div>
							</>
						) : null}

						{canRemove || (canTransferOwnership && !isPending) ? (
							<div className="organization-member-card__remove-row">
								{canRemove ? (
									<button type="button" className="button button--size-m button--type-danger" onClick={onRemove} disabled={isRemoving}>
										{isRemoving ? t("actions.removing") : t(isPending ? "actions.cancelInvitation" : "actions.remove")}
									</button>
								) : null}

								{canTransferOwnership && !isPending ? (
									<button type="button" className="button button--size-m button--type-minimal" onClick={onTransferOwnership} disabled={isTransferDisabled || isTransferring}>
										{t("transfer.cardAction")}
									</button>
								) : null}
							</div>
						) : null}
					</div>
				</div>
			</div>
		</div>
	);
}