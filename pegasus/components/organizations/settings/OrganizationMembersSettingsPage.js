"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import { useTranslations } from "next-intl";
import UnsavedChangesBar from "@/components/ui/UnsavedChangesBar";
import UserName from "@/components/ui/UserName";
import OrganizationMemberCard from "@/components/organizations/settings/OrganizationMemberCard";
import OrganizationSettingsSidebar from "@/components/organizations/settings/OrganizationSettingsSidebar";
import ConfirmModal from "@/modal/ConfirmModal";
import { useCollaboratorUserSearch } from "@/utils/collaborators/hooks";

const SEARCH_DEBOUNCE_MS = 300;

const useDebouncedValue = (value, delay) => {
    const [debouncedValue, setDebouncedValue] = useState(value);

    useEffect(() => {
        const timeoutId = window.setTimeout(() => setDebouncedValue(value), delay);
        return () => window.clearTimeout(timeoutId);
    }, [delay, value]);

    return debouncedValue;
};

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
    const [searchInput, setSearchInput] = useState("");
    const debouncedSearchInput = useDebouncedValue(searchInput, SEARCH_DEBOUNCE_MS);
    const [selectedUsers, setSelectedUsers] = useState([]);
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [highlightedIndex, setHighlightedIndex] = useState(0);
    const [isInviting, setIsInviting] = useState(false);
    const [isSavingMembers, setIsSavingMembers] = useState(false);
    const [removingMemberId, setRemovingMemberId] = useState(null);
    const [pendingRemoveMember, setPendingRemoveMember] = useState(null);
    const [memberItems, setMemberItems] = useState(members);
    const [pendingInviteItems, setPendingInviteItems] = useState(pending_invites);
    const [draftMembers, setDraftMembers] = useState(buildDraftMap(members));
    const [expandedMemberId, setExpandedMemberId] = useState(null);
    const searchFieldRef = useRef(null);
    const searchInputRef = useRef(null);
    const listboxId = useId();

    const canManageMembers = Boolean(my_permissions?.is_owner || my_permissions?.organization_permissions?.includes("organization_manage_members"));
    const canManageInvites = Boolean(my_permissions?.is_owner || my_permissions?.organization_permissions?.includes("organization_manage_invites"));

    const sortedMembers = useMemo(
        () => memberItems.slice().sort((a, b) => Number(b.user_id === organization.owner_user_id) - Number(a.user_id === organization.owner_user_id)),
        [memberItems, organization.owner_user_id]
    );
    const existingUserIds = useMemo(() => new Set([
        ...memberItems.map((member) => String(member.user_id)),
        ...pendingInviteItems.map((invite) => String(invite.user_id || invite.invited_user_id)),
    ]), [memberItems, pendingInviteItems]);
    const selectedUserIds = useMemo(() => new Set(selectedUsers.map((user) => String(user.id))), [selectedUsers]);
    const searchQuery = useCollaboratorUserSearch({
        authToken,
        query: debouncedSearchInput,
        enabled: canManageInvites && isSearchOpen,
    });
    const searchResults = useMemo(
        () => (searchQuery.data || []).filter((user) => !existingUserIds.has(String(user.id)) && !selectedUserIds.has(String(user.id))),
        [existingUserIds, searchQuery.data, selectedUserIds]
    );
    const pendingInviteMembers = useMemo(
        () => pendingInviteItems.map((invite) => ({
            ...invite,
            status: "pending",
            user_id: invite.user_id || invite.invited_user_id,
            project_permissions: [],
            organization_permissions: [],
            __cardKey: `invite-${invite.id}`,
            __isPendingInvite: true,
        })),
        [pendingInviteItems]
    );
    const displayedMembers = useMemo(
        () => [
            ...sortedMembers.map((member) => ({ ...member, __cardKey: `member-${member.user_id}`, __isPendingInvite: false })),
            ...pendingInviteMembers,
        ],
        [pendingInviteMembers, sortedMembers]
    );

    const isDirty = canManageMembers && sortedMembers.some((member) => isMemberChanged(member, draftMembers[String(member.user_id)]));

    useEffect(() => {
        setHighlightedIndex(0);
    }, [debouncedSearchInput, searchResults.length]);

    useEffect(() => {
        const handlePointerDown = (event) => {
            if(!searchFieldRef.current?.contains(event.target)) {
                setIsSearchOpen(false);
            }
        };
        const handleKeyDown = (event) => {
            if(event.key === "Escape") {
                setIsSearchOpen(false);
            }
        };

        document.addEventListener("mousedown", handlePointerDown);
        document.addEventListener("keydown", handleKeyDown);
        return () => {
            document.removeEventListener("mousedown", handlePointerDown);
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, []);

    const selectUser = (user) => {
        setSelectedUsers((current) => current.some((selectedUser) => String(selectedUser.id) === String(user.id)) ? current : [...current, user]);
        setSearchInput("");
        setIsSearchOpen(false);
        window.requestAnimationFrame(() => searchInputRef.current?.focus());
    };

    const removeSelectedUser = (userId) => {
        setSelectedUsers((current) => current.filter((user) => String(user.id) !== String(userId)));
    };

    const handleSearchKeyDown = (event) => {
        if(!isSearchOpen || isSearchDebouncing || searchResults.length === 0) {
            return;
        }

        if(event.key === "ArrowDown") {
            event.preventDefault();
            setHighlightedIndex((current) => (current + 1) % searchResults.length);
        } else if(event.key === "ArrowUp") {
            event.preventDefault();
            setHighlightedIndex((current) => (current - 1 + searchResults.length) % searchResults.length);
        } else if(event.key === "Enter") {
            event.preventDefault();
            selectUser(searchResults[highlightedIndex]);
        }
    };

    const handleInvite = async () => {
        if(selectedUsers.length === 0 || isInviting) {
            return;
        }

        const usersToInvite = [...selectedUsers];
        setIsInviting(true);

        try {
            const results = await Promise.allSettled(usersToInvite.map((user) => axios.post(`${process.env.NEXT_PUBLIC_API_BASE}/organizations/${organization.slug}/invites`, {
                slug: user.slug,
            }, {
                headers: {
                    Authorization: `Bearer ${authToken}`,
                },
            })));
            const invitedUsers = usersToInvite.filter((user, index) => results[index].status === "fulfilled");
            const failedUsers = usersToInvite.filter((user, index) => results[index].status === "rejected");

            if(invitedUsers.length > 0) {
                const invitedAt = Math.floor(Date.now() / 1000);
                setPendingInviteItems((current) => [
                    ...invitedUsers.map((user) => ({
                        id: `local-${user.id}`,
                        user_id: user.id,
                        username: user.username,
                        slug: user.slug,
                        avatar: user.avatar,
                        isVerified: user.isVerified,
                        activeProfileBadge: user.activeProfileBadge,
                        role: "Member",
                        project_permissions: [],
                        organization_permissions: [],
                        created_at: invitedAt,
                    })),
                    ...current.filter((invite) => !invitedUsers.some((user) => String(user.id) === String(invite.user_id || invite.invited_user_id))),
                ]);
            }

            setSelectedUsers(failedUsers);
            if(invitedUsers.length === 1) {
                toast.success(t("settings.successInviteSent", { username: invitedUsers[0].username }));
            } else if(invitedUsers.length > 1) {
                toast.success(t("settings.successInvitesSent", { count: invitedUsers.length }));
            }
            if(failedUsers.length > 0) {
                toast.error(t("settings.errors.inviteMany", { count: failedUsers.length }));
            }
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
            setPendingRemoveMember(null);
            toast.success(t("settings.successMemberRemoved", { username: member.username }));
        } catch (error) {
            toast.error(error.response?.data?.message || t("settings.errors.memberRemove"));
        } finally {
            setRemovingMemberId(null);
        }
    };

    const isSearchDebouncing = searchInput.trim() !== debouncedSearchInput.trim();
    const showSearchPopover = isSearchOpen && searchInput.trim().length >= 2;

    return (
        <div className="layout">
            <div className="page-content settings-page">
                <OrganizationSettingsSidebar organization={organization} />

                <div className="settings-content project-collaborators-settings">
                    <div className="content content--padding">
                        <h2 style={{ marginTop: 0 }}>{t("settings.membersTitle")}</h2>

                        {canManageInvites && (
                            <>
                                <p className="blog-settings__field-title">{t("settings.inviteTitle")}</p>

                                <p className="project-collaborators-settings__description">{t("settings.inviteDescription")}</p>

                                <p className="project-collaborators-settings__hint">{t("settings.inviteHint")}</p>

                                {selectedUsers.length > 0 ? (
                                    <div className="project-collaborators-settings__selected-users" aria-label={t("settings.inviteSelectedLabel")}>
                                        {selectedUsers.map((user) => (
                                            <button key={user.id} type="button" className="browse-selected-filter-chip project-collaborators-settings__selected-chip" onClick={() => removeSelectedUser(user.id)} aria-label={t("settings.inviteRemoveSelection", { username: user.username })}>
                                                <img src={user.avatar || "https://media.modifold.com/static/no-project-icon.svg"} alt="" />

                                                <span>{user.username}</span>

                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
                                            </button>
                                        ))}
                                    </div>
                                ) : null}

                                <div className="project-collaborators-settings__invite-row">
                                    <div className="field field--default blog-settings__input project-collaborators-settings__search" ref={searchFieldRef}>
                                        <label className="field__wrapper">
                                            <svg className="icon icon--search field__icon field__icon--left" xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                                <circle cx="11" cy="11" r="8" />
                                                <path d="m21 21-4.3-4.3" />
                                            </svg>

                                            <input ref={searchInputRef} className="text-input" type="text" inputMode="search" autoComplete="off" spellCheck="false" value={searchInput} onChange={(event) => { setSearchInput(event.target.value); setIsSearchOpen(true); }} onFocus={() => setIsSearchOpen(true)} onKeyDown={handleSearchKeyDown} placeholder={t("settings.invitePlaceholder")} role="combobox" aria-autocomplete="list" aria-expanded={showSearchPopover} aria-controls={showSearchPopover ? listboxId : undefined} aria-activedescendant={showSearchPopover && !isSearchDebouncing && searchResults[highlightedIndex] ? `${listboxId}-${searchResults[highlightedIndex].id}` : undefined} />
                                        </label>

                                        {showSearchPopover ? (
                                            <div className="popover project-collaborators-settings__search-popover" id={listboxId} role="listbox" aria-label={t("settings.inviteResultsLabel")}>
                                                <div className="context-list" data-scrollable>
                                                    {isSearchDebouncing || searchQuery.isPending ? (
                                                        <div className="project-collaborators-settings__search-state">{t("settings.inviteSearching")}</div>
                                                    ) : searchQuery.isError ? (
                                                        <div className="project-collaborators-settings__search-state">{t("settings.errors.searchUsers")}</div>
                                                    ) : searchResults.length === 0 ? (
                                                        <div className="project-collaborators-settings__search-state">{t("settings.inviteNoResults")}</div>
                                                    ) : searchResults.map((user, index) => (
                                                        <button key={user.id} id={`${listboxId}-${user.id}`} type="button" role="option" aria-selected={index === highlightedIndex} className={`context-list-option context-list-option--with-art project-collaborators-settings__search-option ${index === highlightedIndex ? "context-list-option--focused" : ""}`} onMouseEnter={() => setHighlightedIndex(index)} onClick={() => selectUser(user)}>
                                                            <span className="context-list-option__art">
                                                                <img src={user.avatar || "https://media.modifold.com/static/no-project-icon.svg"} alt="" />
                                                            </span>

                                                            <span className="project-collaborators-settings__search-copy">
                                                                <span className="context-list-option__label">
                                                                    <UserName user={user} />
                                                                </span>

                                                                <span>@{user.slug || user.username}</span>
                                                            </span>
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        ) : null}
                                    </div>

                                    <button type="button" className="button button--size-l button--type-primary project-collaborators-settings__invite-button" onClick={handleInvite} disabled={selectedUsers.length === 0 || isInviting}>
                                        {isInviting ? t("settings.actions.inviting") : t("settings.actions.invite")}
                                    </button>
                                </div>
                            </>
                        )}

                    </div>

                    <div className="project-collaborators-settings__list">
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
                                    onRemove={() => setPendingRemoveMember(member)}
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
            <ConfirmModal
                isOpen={Boolean(pendingRemoveMember)}
                title={pendingRemoveMember ? t("settings.confirmRemoveMember", { username: pendingRemoveMember.username }) : ""}
                confirmLabel={t("settings.actions.removeMember")}
                cancelLabel={t("settings.delete.cancel")}
                isLoading={Boolean(removingMemberId)}
                onConfirm={() => handleRemoveMember(pendingRemoveMember)}
                onRequestClose={() => {
                    if(!removingMemberId) {
                        setPendingRemoveMember(null);
                    }
                }}
            />
        </div>
    );
}