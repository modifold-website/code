"use client";

import UserName from "@/components/ui/UserName";

const getDefaultDraft = (member) => ({
    role: member?.role || "Member",
    project_permissions: Array.isArray(member?.project_permissions) ? member.project_permissions : [],
    organization_permissions: Array.isArray(member?.organization_permissions) ? member.organization_permissions : [],
});

export default function OrganizationMemberCard({ member, draft, expanded, onToggle, canManageMembers, canExpand = true, canRemove = false, isRemoving = false, onRemove, onChange, t, projectPermissionKeys, organizationPermissionKeys, defaultIconUrl, isOwner = false }) {
    const effectiveDraft = draft || getDefaultDraft(member);
    const projectPermissionsSet = new Set(effectiveDraft.project_permissions);
    const organizationPermissionsSet = new Set(effectiveDraft.organization_permissions);

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
                    <div className={`organization-member-card__status organization-member-card__status--${member.status || "accepted"}`}>
                        {t(`settings.status.${member.status}`)}
                    </div>
                    
                    {canExpand && (
                        <button type="button" className="icon-button organization-member-card__expand" onClick={onToggle} aria-label={expanded ? t("settings.actions.collapse") : t("settings.actions.expand")}>
                            <svg className={`icon icon--chevron_down ${expanded ? "rotate" : ""}`} width="24" height="24" viewBox="0 0 24 24">
                                <path fillRule="evenodd" clipRule="evenodd" d="M17.707 8.793a1 1 0 0 1 0 1.414l-5 5a1 1 0 0 1-1.414 0l-5-5a1 1 0 1 1 1.414-1.414L12 13.086l4.293-4.293a1 1 0 0 1 1.414 0Z" fill="currentColor"></path>
                            </svg>
                        </button>
                    )}
                </div>
            </div>

            {canExpand && expanded && (
                <div className="organization-member-card__body">
                    <div className={`field field--default blog-settings__input ${isOwner ? "" : "organization-member-card__role-field"}`.trim()}>
                        <label className="field__wrapper">
                            <input className="text-input" value={effectiveDraft.role} onChange={(event) => onChange({ ...effectiveDraft, role: event.target.value || "Member" })} disabled={!canManageMembers} />
                        </label>
                    </div>

                    {!isOwner && (
                        <>
                            <p className="blog-settings__field-title">{t("settings.projectPermissions")}</p>
                            <div className="organization-member-card__permissions-grid">
                                {projectPermissionKeys.map((permission) => {
                                    const selected = projectPermissionsSet.has(permission);
                                    return (
                                        <button key={permission} type="button" className={`organization-member-card__permission-toggle ${selected ? "organization-member-card__permission-toggle--active" : ""}`} aria-pressed={selected} onClick={() => onChange({ ...effectiveDraft, project_permissions: togglePermission(effectiveDraft.project_permissions, permission) })} disabled={!canManageMembers}>
                                            <span className={`organization-member-card__permission-check ${selected ? "organization-member-card__permission-check--active" : ""}`}>
                                                {selected && (
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-check-icon lucide-check">
                                                        <path d="M20 6 9 17l-5-5"/>
                                                    </svg>
                                                )}
                                            </span>

                                            <span>{t(`permissions.project.${permission}`)}</span>
                                        </button>
                                    );
                                })}
                            </div>

                            <p className="blog-settings__field-title">{t("settings.organizationPermissions")}</p>
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

                    {canRemove && (
                        <div className="organization-member-card__remove-row">
                            <button type="button" className="button button--size-m button--type-danger" onClick={onRemove} disabled={isRemoving}>
                                {isRemoving ? t("settings.actions.removingMember") : t("settings.actions.removeMember")}
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}