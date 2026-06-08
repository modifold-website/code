"use client";

import { useMemo, useState } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import { useTranslations } from "next-intl";
import UnsavedChangesBar from "@/components/ui/UnsavedChangesBar";
import OrganizationMemberCard from "@/components/organizations/settings/OrganizationMemberCard";
import OrganizationSettingsSidebar from "@/components/organizations/settings/OrganizationSettingsSidebar";

const PROJECT_PERMISSION_KEYS = [
    "project_edit_details",
    "project_edit_body",
    "project_edit_gallery",
    "project_manage_versions",
    "project_delete",
];

const ORGANIZATION_PERMISSION_KEYS = [
    "organization_edit_details",
    "organization_manage_invites",
    "organization_manage_members",
    "organization_add_project",
    "organization_remove_project",
];

const normalizePermissions = (permissions) => Array.from(new Set(Array.isArray(permissions) ? permissions.filter((item) => typeof item === "string") : [])).sort();

const buildDraftMember = (member) => ({
    role: member.role || "Member",
    project_permissions: normalizePermissions(member.project_permissions),
    organization_permissions: normalizePermissions(member.organization_permissions),
});

const buildDraftMap = (members) => Object.fromEntries(members.map((member) => [String(member.user_id), buildDraftMember(member)]));

const isMemberChanged = (member, draft) => {
    if(!draft) {
        return false;
    }

    const savedProjectPermissions = normalizePermissions(member.project_permissions);
    const savedOrganizationPermissions = normalizePermissions(member.organization_permissions);

    return (
        (member.role || "Member") !== draft.role ||
        JSON.stringify(savedProjectPermissions) !== JSON.stringify(draft.project_permissions) ||
        JSON.stringify(savedOrganizationPermissions) !== JSON.stringify(draft.organization_permissions)
    );
};

export default function OrganizationMembersSettingsPage({ authToken, organization, members = [], pending_invites = [], my_permissions }) {
    const t = useTranslations("Organizations");
    const tUnsaved = useTranslations("SettingsProjectPage.unsavedBar");
    const [inviteSlug, setInviteSlug] = useState("");
    const [isInviting, setIsInviting] = useState(false);
    const [isSavingMembers, setIsSavingMembers] = useState(false);
    const [removingMemberId, setRemovingMemberId] = useState(null);
    const [memberItems, setMemberItems] = useState(members);
    const [draftMembers, setDraftMembers] = useState(buildDraftMap(members));
    const [expandedMemberId, setExpandedMemberId] = useState(null);

    const canManageMembers = Boolean(my_permissions?.is_owner || my_permissions?.organization_permissions?.includes("organization_manage_members"));
    const canManageInvites = Boolean(my_permissions?.is_owner || my_permissions?.organization_permissions?.includes("organization_manage_invites"));

    const sortedMembers = useMemo(
        () => memberItems.slice().sort((a, b) => Number(b.user_id === organization.owner_user_id) - Number(a.user_id === organization.owner_user_id)),
        [memberItems, organization.owner_user_id]
    );
    const pendingInviteMembers = useMemo(
        () => pending_invites.map((invite) => ({
            ...invite,
            status: "pending",
            user_id: invite.user_id || invite.invited_user_id,
            project_permissions: [],
            organization_permissions: [],
            __cardKey: `invite-${invite.id}`,
            __isPendingInvite: true,
        })),
        [pending_invites]
    );
    const displayedMembers = useMemo(
        () => [
            ...sortedMembers.map((member) => ({ ...member, __cardKey: `member-${member.user_id}`, __isPendingInvite: false })),
            ...pendingInviteMembers,
        ],
        [pendingInviteMembers, sortedMembers]
    );

    const isDirty = canManageMembers && sortedMembers.some((member) => isMemberChanged(member, draftMembers[String(member.user_id)]));

    const handleInvite = async () => {
        if(isInviting) {
            return;
        }

        const slug = inviteSlug.trim().toLowerCase();
        if(!slug) {
            toast.error(t("settings.errors.inviteSlugRequired"));
            return;
        }

        setIsInviting(true);

        try {
            await axios.post(`${process.env.NEXT_PUBLIC_API_BASE}/organizations/${organization.slug}/invites`, {
                slug,
            }, {
                headers: {
                    Authorization: `Bearer ${authToken}`,
                },
            });

            toast.success(t("settings.successInviteSent"));
            setInviteSlug("");
        } catch (error) {
            toast.error(error.response?.data?.message || t("settings.errors.invite"));
        } finally {
            setIsInviting(false);
        }
    };

    const handleSaveMembers = async () => {
        if(!canManageMembers || isSavingMembers || !isDirty) {
            return;
        }

        const changedMembers = sortedMembers.filter((member) => isMemberChanged(member, draftMembers[String(member.user_id)]));
        if(changedMembers.length === 0) {
            return;
        }

        setIsSavingMembers(true);

        try {
            await Promise.all(changedMembers.map((member) => {
                const draft = draftMembers[String(member.user_id)];
                const isOwnerMember = Number(member.user_id) === Number(organization.owner_user_id);
                const payload = {
                    role: draft.role,
                };

                if(!isOwnerMember) {
                    payload.project_permissions = draft.project_permissions;
                    payload.organization_permissions = draft.organization_permissions;
                }

                return axios.put(`${process.env.NEXT_PUBLIC_API_BASE}/organizations/${organization.slug}/members/${member.user_id}`, {
                    ...payload,
                }, {
                    headers: {
                        Authorization: `Bearer ${authToken}`,
                    },
                });
            }));

            const nextMemberItems = memberItems.map((member) => {
                const draft = draftMembers[String(member.user_id)];
                if(!draft) {
                    return member;
                }
                
                return {
                    ...member,
                    role: draft.role,
                    project_permissions: draft.project_permissions,
                    organization_permissions: draft.organization_permissions,
                };
            });

            setMemberItems(nextMemberItems);
            setDraftMembers(buildDraftMap(nextMemberItems));
            toast.success(t("settings.successSaved"));
        } catch (error) {
            toast.error(error.response?.data?.message || t("settings.errors.memberUpdate"));
        } finally {
            setIsSavingMembers(false);
        }
    };

    const handleRemoveMember = async (member) => {
        if(removingMemberId || member.__isPendingInvite) {
            return;
        }

        if(!window.confirm(t("settings.confirmRemoveMember", { username: member.username }))) {
            return;
        }

        setRemovingMemberId(member.user_id);

        try {
            await axios.delete(`${process.env.NEXT_PUBLIC_API_BASE}/organizations/${organization.slug}/members/${member.user_id}`, {
                headers: {
                    Authorization: `Bearer ${authToken}`,
                },
            });

            const nextMembers = memberItems.filter((item) => Number(item.user_id) !== Number(member.user_id));
            setMemberItems(nextMembers);
            setDraftMembers(buildDraftMap(nextMembers));
            setExpandedMemberId((prev) => (prev === member.__cardKey ? null : prev));
            toast.success(t("settings.successMemberRemoved", { username: member.username }));
        } catch (error) {
            toast.error(error.response?.data?.message || t("settings.errors.memberRemove"));
        } finally {
            setRemovingMemberId(null);
        }
    };

    return (
        <div className="layout">
            <div className="page-content settings-page">
                <OrganizationSettingsSidebar organization={organization} />

                <div className="settings-content" style={{ display: "grid", gap: "16px" }}>
                    <div className="content content--padding">
                        <h2 style={{ marginTop: 0 }}>{t("settings.membersTitle")}</h2>

                        {canManageInvites && (
                            <>
                                <p className="blog-settings__field-title">{t("settings.inviteTitle")}</p>
                                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                                    <div className="field field--default blog-settings__input" style={{ flex: "1 1 280px", marginBottom: 0 }}>
                                        <label className="field__wrapper">
                                            <input className="text-input" placeholder={t("settings.invitePlaceholder")} value={inviteSlug} onChange={(event) => setInviteSlug(event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} />
                                        </label>
                                    </div>

                                    <button type="button" className="button button--size-l button--type-primary" onClick={handleInvite} disabled={isInviting}>
                                        {isInviting ? t("settings.actions.inviting") : t("settings.actions.invite")}
                                    </button>
                                </div>
                            </>
                        )}

                    </div>

                    <div style={{ display: "grid", gap: "14px" }}>
                        {displayedMembers.map((member) => {
                            const memberKey = String(member.user_id);
                            const draft = draftMembers[memberKey] || buildDraftMember(member);
                            const isOwnerMember = Number(member.user_id) === Number(organization.owner_user_id);
                            const canExpandCard = !member.__isPendingInvite && canManageMembers;
                            const isExpanded = canExpandCard && expandedMemberId === member.__cardKey;
                            const canRemoveMember = (
                                canManageMembers &&
                                !member.__isPendingInvite &&
                                Number(member.user_id) !== Number(organization.owner_user_id) &&
                                Number(member.user_id) !== Number(my_permissions?.user_id)
                            );
                            
                            return (
                                <OrganizationMemberCard
                                    key={member.__cardKey}
                                    member={member}
                                    draft={draft}
                                    expanded={isExpanded}
                                    onToggle={() => {
                                        if(!canExpandCard) {
                                            return;
                                        }

                                        setExpandedMemberId((prev) => (prev === member.__cardKey ? null : member.__cardKey));
                                    }}
                                    canManageMembers={canManageMembers}
                                    canExpand={canExpandCard}
                                    canRemove={canRemoveMember}
                                    isRemoving={Number(removingMemberId) === Number(member.user_id)}
                                    onRemove={() => handleRemoveMember(member)}
                                    onChange={(nextDraft) => {
                                        if(member.__isPendingInvite) {
                                            return;
                                        }

                                        setDraftMembers((prev) => ({
                                            ...prev,
                                            [memberKey]: {
                                                role: nextDraft.role,
                                                project_permissions: normalizePermissions(nextDraft.project_permissions),
                                                organization_permissions: normalizePermissions(nextDraft.organization_permissions),
                                            },
                                        }));
                                    }}
                                    t={t}
                                    projectPermissionKeys={PROJECT_PERMISSION_KEYS}
                                    organizationPermissionKeys={ORGANIZATION_PERMISSION_KEYS}
                                    defaultIconUrl={"https://media.modifold.com/static/no-project-icon.svg"}
                                    isOwner={isOwnerMember}
                                />
                            );
                        })}
                    </div>
                </div>

                {canManageMembers && (
                    <UnsavedChangesBar
                        isDirty={isDirty}
                        isSaving={isSavingMembers}
                        onSave={handleSaveMembers}
                        onReset={() => {
                            setDraftMembers(buildDraftMap(memberItems));
                        }}
                        saveLabel={t("settings.actions.saveMember")}
                        resetLabel={tUnsaved("reset")}
                        message={tUnsaved("message")}
                    />
                )}
            </div>
        </div>
    );
}