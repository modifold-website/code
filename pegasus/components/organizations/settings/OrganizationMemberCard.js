"use client";

import UserName from "@/components/ui/UserName";
import OrganizationMemberProjectAccess from "@/components/organizations/settings/OrganizationMemberProjectAccess";

const getDefaultDraft = (member) => ({
    role: member?.role || "Member",
    organization_permissions: Array.isArray(member?.organization_permissions) ? member.organization_permissions : [],
	project_overrides: {},
});

export default function OrganizationMemberCard({ member, draft, expanded, onToggle, canManageMembers, canManageProjectAccess = false, canExpand = true, canRemove = false, canCancelInvite = false, canTransferOwnership = false, isRemoving = false, isCancellingInvite = false, isSavingProjectAccess = false, isTransferring = false, isTransferDisabled = false, onRemove, onCancelInvite, onTransferOwnership, onSaveProjectAccess, onChange, t, projects = [], directProjectAccess = [], defaultProjectPermissions = [], projectOverridePermissionKeys = [], organizationPermissionKeys, defaultIconUrl, isOwner = false }) {
    const effectiveDraft = draft || getDefaultDraft(member);
    const organizationPermissionsSet = new Set(effectiveDraft.organization_permissions);
    const bodyId = `organization-member-${member.user_id}-permissions`;

    const togglePermission = (permissions, key) => {
        const next = new Set(permissions);
        if(next.has(key)) {
            next.delete(key);
        } else {
            next.add(key);
        }

        return Array.from(next);
    };

    return (
        <div className="content content--padding organization-member-card">
            <div className="organization-member-card__header">
                <div className="organization-member-card__identity">
                    <img src={member.avatar || defaultIconUrl} alt={member.username} className="organization-member-card__avatar" />
                    
                    <div>
                        <div className="organization-member-card__name">
                            <UserName user={member} />
                        </div>

                        <div className="organization-member-card__role-preview">{effectiveDraft.role}</div>
                    </div>
                </div>

				<div className="organization-member-card__actions">
					{member.status === "pending" ? (
						<div className="organization-member-card__status organization-member-card__status--pending">
							{t("settings.status.pending")}
						</div>
					) : null}

					{canCancelInvite ? (
						<button type="button" className="button button--size-s button--type-minimal organization-member-card__cancel-invite" onClick={onCancelInvite} disabled={isCancellingInvite}>
							{t(`settings.actions.${isCancellingInvite ? "cancellingInvite" : "cancelInvite"}`)}
						</button>
					) : null}
                    
                    {canExpand && (
                        <button type="button" className="icon-button organization-member-card__expand" onClick={onToggle} aria-label={expanded ? t("settings.actions.collapse") : t("settings.actions.expand")} aria-expanded={expanded} aria-controls={bodyId}>
                            <svg className={`icon icon--chevron_down ${expanded ? "rotate" : ""}`} width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
                                <path fillRule="evenodd" clipRule="evenodd" d="M17.707 8.793a1 1 0 0 1 0 1.414l-5 5a1 1 0 0 1-1.414 0l-5-5a1 1 0 1 1 1.414-1.414L12 13.086l4.293-4.293a1 1 0 0 1 1.414 0Z" fill="currentColor"></path>
                            </svg>
                        </button>
                    )}
                </div>
            </div>

            {canExpand ? (
                <div className={`project-collaborator-card__body-region ${expanded ? "project-collaborator-card__body-region--expanded" : ""}`} id={bodyId} aria-hidden={!expanded} inert={!expanded}>
                    <div className="project-collaborator-card__body-inner">
                        <div className="organization-member-card__body">
                            <p className="blog-settings__field-title">{t("settings.memberRole.title")}</p>
                            <p className="project-collaborator-card__field-hint">{t("settings.memberRole.description")}</p>
                            
                            <div className={`field field--default blog-settings__input ${isOwner ? "" : "organization-member-card__role-field"}`.trim()}>
                                <label className="field__wrapper">
                                    <input className="text-input" value={effectiveDraft.role} maxLength={50} placeholder={t("settings.memberRole.placeholder")} aria-label={t("settings.memberRole.title")} onChange={(event) => onChange({ ...effectiveDraft, role: event.target.value || "Member" })} disabled={!canManageMembers} />
                                </label>
                            </div>

                            {!isOwner && (
                                <>
									<OrganizationMemberProjectAccess draft={effectiveDraft} projects={projects} directProjectAccess={directProjectAccess} defaultPermissions={defaultProjectPermissions} availablePermissions={projectOverridePermissionKeys} canManageProjectAccess={canManageProjectAccess} isSaving={isSavingProjectAccess} onSave={onSaveProjectAccess} t={t} />

									<p className="blog-settings__field-title">{t("settings.organizationPermissions")}</p>
									<p className="project-collaborator-card__field-hint">{t("settings.organizationPermissionsDescription")}</p>
                                    <div className="organization-member-card__permissions-grid">
                                        {organizationPermissionKeys.map((permission) => {
                                            const selected = organizationPermissionsSet.has(permission);
                                            return (
                                                <button key={permission} type="button" className={`organization-member-card__permission-toggle ${selected ? "organization-member-card__permission-toggle--active" : ""}`} aria-pressed={selected} onClick={() => onChange({ ...effectiveDraft, organization_permissions: togglePermission(effectiveDraft.organization_permissions, permission) })} disabled={!canManageMembers}>
                                                    <span className={`organization-member-card__permission-check ${selected ? "organization-member-card__permission-check--active" : ""}`}>
                                                        {selected && (
                                                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-check-icon lucide-check">
                                                                <path d="M20 6 9 17l-5-5"/>
                                                            </svg>
                                                        )}
                                                    </span>

                                                    <span>{t(`permissions.organization.${permission}`)}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </>
                            )}

                            {(canRemove || canTransferOwnership) && (
                                <div className="organization-member-card__remove-row">
                                    {canRemove ? (
                                        <button type="button" className="button button--size-m button--type-danger" onClick={onRemove} disabled={isRemoving}>
                                            {isRemoving ? t("settings.actions.removingMember") : t("settings.actions.removeMember")}
                                        </button>
                                    ) : null}

                                    {canTransferOwnership ? (
                                        <button type="button" className="button button--size-m button--type-minimal" onClick={onTransferOwnership} disabled={isTransferDisabled || isTransferring}>
                                            {t("settings.transfer.cardAction")}
                                        </button>
                                    ) : null}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    );
}