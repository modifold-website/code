"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import ConfirmModal from "@/modal/ConfirmModal";
import ProjectOwnershipTransferModal from "@/modal/ProjectOwnershipTransferModal";
import UnsavedChangesBar from "@/components/ui/UnsavedChangesBar";
import UserName from "@/components/ui/UserName";
import ProjectCollaboratorCard from "@/components/project/settings/ProjectCollaboratorCard";
import ProjectOrganizationSettings from "@/components/project/settings/ProjectOrganizationSettings";
import { useCollaboratorUserSearch, useInviteProjectCollaborator, useRemoveProjectCollaborator, useTransferProjectOwnership, useUpdateProjectCollaborator, useUpdateProjectOwnerAttribution } from "@/utils/collaborators/hooks";

const SEARCH_DEBOUNCE_MS = 300;

const useDebouncedValue = (value, delay) => {
	const [debouncedValue, setDebouncedValue] = useState(value);

	useEffect(() => {
		const timeoutId = window.setTimeout(() => setDebouncedValue(value), delay);
		return () => window.clearTimeout(timeoutId);
	}, [delay, value]);

	return debouncedValue;
};

const normalizePermissions = (permissions, availablePermissions) => {
	const availablePermissionSet = new Set(availablePermissions);
	return Array.from(new Set(Array.isArray(permissions) ? permissions.filter((permission) => availablePermissionSet.has(permission)) : [])).sort();
};

const normalizeRole = (role) => String(role || "").trim().slice(0, 50) || "Member";
const normalizeRoleDraft = (role) => String(role ?? "").slice(0, 50);

const buildCollaboratorDraft = (collaborator, availablePermissions) => ({
	role: normalizeRole(collaborator.role),
	show_as_author: Boolean(collaborator.show_as_author),
	permissions: normalizePermissions(collaborator.permissions, availablePermissions),
});

const buildOwnerDraft = (owner) => ({
	role: String(owner?.role || "Owner").trim().slice(0, 50) || "Owner",
	show_as_author: Boolean(owner?.show_as_author),
	permissions: [],
});

const buildDraftMap = (collaborators, availablePermissions) => Object.fromEntries(
	collaborators.map((collaborator) => [String(collaborator.user_id), buildCollaboratorDraft(collaborator, availablePermissions)])
);

const collaboratorDraftEqual = (collaborator, draft, availablePermissions) => {
	if(!draft) {
		return false;
	}

	const saved = buildCollaboratorDraft(collaborator, availablePermissions);
	return saved.role === normalizeRoleDraft(draft.role)
		&& saved.show_as_author === Boolean(draft.show_as_author)
		&& JSON.stringify(saved.permissions) === JSON.stringify(normalizePermissions(draft.permissions, availablePermissions));
};

const ownerDraftEqual = (owner, draft) => {
	if(!owner || !draft) {
		return false;
	}

	const saved = buildOwnerDraft(owner);
	return saved.role === normalizeRoleDraft(draft.role)
		&& saved.show_as_author === Boolean(draft.show_as_author);
};

export default function ProjectCollaboratorsSettings({ authToken, project, owner = null, initialCollaborators = [], availablePermissions = [], defaultPermissions = [], organizationOptions = [], twoFactorEnabled = false }) {
	const t = useTranslations("ProjectCollaborators");
	const tUnsaved = useTranslations("SettingsProjectPage.unsavedBar");
	const router = useRouter();
	const [collaborators, setCollaborators] = useState(initialCollaborators);
	const [draftCollaborators, setDraftCollaborators] = useState(() => buildDraftMap(initialCollaborators, availablePermissions));
	const [projectOwner, setProjectOwner] = useState(owner);
	const [ownerDraft, setOwnerDraft] = useState(() => buildOwnerDraft(owner));
	const [expandedUserId, setExpandedUserId] = useState(null);
	const [searchInput, setSearchInput] = useState("");
	const debouncedSearchInput = useDebouncedValue(searchInput, SEARCH_DEBOUNCE_MS);
	const [selectedUsers, setSelectedUsers] = useState([]);
	const [isInviting, setIsInviting] = useState(false);
	const [isSearchOpen, setIsSearchOpen] = useState(false);
	const [highlightedIndex, setHighlightedIndex] = useState(0);
	const [pendingRemoveCollaborator, setPendingRemoveCollaborator] = useState(null);
	const [pendingTransferCollaborator, setPendingTransferCollaborator] = useState(null);
	const [transferError, setTransferError] = useState("");
	const [transferRequiresTwoFactor, setTransferRequiresTwoFactor] = useState(false);
	const [isOwner, setIsOwner] = useState(() => Boolean(project.permissions?.is_owner || Number(project.user_id) === Number(project.current_user_id)));
	const searchFieldRef = useRef(null);
	const searchInputRef = useRef(null);
	const listboxId = useId();

	const existingUserIds = useMemo(() => new Set([
		...collaborators.map((collaborator) => String(collaborator.user_id)),
		...(projectOwner?.user_id ? [String(projectOwner.user_id)] : []),
	]), [collaborators, projectOwner?.user_id]);
	const selectedUserIds = useMemo(() => new Set(selectedUsers.map((user) => String(user.id))), [selectedUsers]);
	const searchQuery = useCollaboratorUserSearch({
		authToken,
		query: debouncedSearchInput,
		enabled: isSearchOpen,
	});
	const searchResults = useMemo(
		() => (searchQuery.data || []).filter((user) => !existingUserIds.has(String(user.id)) && !selectedUserIds.has(String(user.id))),
		[existingUserIds, searchQuery.data, selectedUserIds]
	);
	const inviteMutation = useInviteProjectCollaborator({ authToken, projectSlug: project.slug });
	const updateMutation = useUpdateProjectCollaborator({ authToken, projectSlug: project.slug });
	const updateOwnerMutation = useUpdateProjectOwnerAttribution({ authToken, projectSlug: project.slug });
	const removeMutation = useRemoveProjectCollaborator({ authToken, projectSlug: project.slug });
	const transferOwnershipMutation = useTransferProjectOwnership({ authToken, projectSlug: project.slug });
	const canManageInvites = isOwner || Boolean(project.permissions?.can_manage_invites);
	const canEditMembers = isOwner || Boolean(project.permissions?.can_edit_members);
	const canRemoveMembers = isOwner || Boolean(project.permissions?.can_remove_members);

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

	const collaboratorsDirty = collaborators.some((collaborator) => (
		!collaboratorDraftEqual(collaborator, draftCollaborators[String(collaborator.user_id)], availablePermissions)
	));
	const ownerDirty = Boolean(isOwner && projectOwner && !ownerDraftEqual(projectOwner, ownerDraft));
	const isDirty = ownerDirty || (canEditMembers && collaboratorsDirty);

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
			const results = await Promise.allSettled(usersToInvite.map((user) => inviteMutation.mutateAsync({ userId: user.id })));
			const invitedCollaborators = results.flatMap((result) => result.status === "fulfilled" && result.value?.collaborator ? [result.value.collaborator] : []);
			const failedUsers = usersToInvite.filter((user, index) => results[index].status === "rejected");

			if(invitedCollaborators.length > 0) {
				setCollaborators((current) => [...invitedCollaborators, ...current]);
				setDraftCollaborators((current) => {
					const next = { ...current };
					invitedCollaborators.forEach((collaborator) => {
						next[String(collaborator.user_id)] = buildCollaboratorDraft({
							...collaborator,
							permissions: collaborator.permissions || defaultPermissions,
						}, availablePermissions);
					});
					return next;
				});
				if(invitedCollaborators.length === 1) {
					setExpandedUserId(String(invitedCollaborators[0].user_id));
				}
			}

			setSelectedUsers(failedUsers);
			if(invitedCollaborators.length === 1) {
				toast.success(t("success.invited", { username: invitedCollaborators[0].username }));
			} else if(invitedCollaborators.length > 1) {
				toast.success(t("success.invitedMany", { count: invitedCollaborators.length }));
			}
			if(failedUsers.length > 0) {
				toast.error(t("errors.inviteMany", { count: failedUsers.length }));
			}
		} finally {
			setIsInviting(false);
		}
	};

	const handleSave = async () => {
		const changedCollaborators = collaborators.filter((collaborator) => (
			!collaboratorDraftEqual(collaborator, draftCollaborators[String(collaborator.user_id)], availablePermissions)
		));
		const shouldUpdateOwner = Boolean(isOwner && projectOwner && !ownerDraftEqual(projectOwner, ownerDraft));
		if((changedCollaborators.length === 0 && !shouldUpdateOwner) || updateMutation.isPending || updateOwnerMutation.isPending) {
			return;
		}

		const normalizedDrafts = Object.fromEntries(changedCollaborators.map((collaborator) => {
			const userId = String(collaborator.user_id);
			const draft = draftCollaborators[userId] || buildCollaboratorDraft(collaborator, availablePermissions);
			return [userId, {
				role: normalizeRole(draft.role),
				show_as_author: Boolean(draft.show_as_author),
				permissions: normalizePermissions(draft.permissions, availablePermissions),
			}];
		}));

		try {
			const updateRequests = changedCollaborators.map((collaborator) => updateMutation.mutateAsync({
				userId: collaborator.user_id,
				role: normalizedDrafts[String(collaborator.user_id)].role,
				showAsAuthor: normalizedDrafts[String(collaborator.user_id)].show_as_author,
				permissions: normalizedDrafts[String(collaborator.user_id)].permissions,
			}));
			const normalizedOwnerDraft = shouldUpdateOwner ? {
				role: String(ownerDraft.role || "").trim().slice(0, 50) || "Owner",
				show_as_author: Boolean(ownerDraft.show_as_author),
			} : null;
			if(normalizedOwnerDraft) {
				updateRequests.push(updateOwnerMutation.mutateAsync({
					role: normalizedOwnerDraft.role,
					showAsAuthor: normalizedOwnerDraft.show_as_author,
				}));
			}

			await Promise.all(updateRequests);
			setCollaborators((current) => current.map((collaborator) => normalizedDrafts[String(collaborator.user_id)] ? {
				...collaborator,
				...normalizedDrafts[String(collaborator.user_id)],
			} : collaborator));
			setDraftCollaborators((current) => ({ ...current, ...normalizedDrafts }));
			if(normalizedOwnerDraft) {
				setProjectOwner((current) => ({ ...current, ...normalizedOwnerDraft }));
				setOwnerDraft({ ...normalizedOwnerDraft, permissions: [] });
			}
			toast.success(t("success.permissionsSaved"));
		} catch (error) {
			toast.error(error.response?.data?.message || t("errors.save"));
		}
	};

	const handleRemove = async () => {
		if(!pendingRemoveCollaborator || removeMutation.isPending) {
			return;
		}

		try {
			await removeMutation.mutateAsync({ userId: pendingRemoveCollaborator.user_id });
			const removedUserId = String(pendingRemoveCollaborator.user_id);
			setCollaborators((current) => current.filter((collaborator) => String(collaborator.user_id) !== removedUserId));
			setDraftCollaborators((current) => {
				const next = { ...current };
				delete next[removedUserId];
				return next;
			});
			setExpandedUserId((current) => current === removedUserId ? null : current);
			toast.success(t(pendingRemoveCollaborator.status === "pending" ? "success.invitationCancelled" : "success.removed", { username: pendingRemoveCollaborator.username }));
			setPendingRemoveCollaborator(null);
		} catch (error) {
			toast.error(error.response?.data?.message || t("errors.remove"));
		}
	};

	const handleTransferOwnership = async ({ confirmation, twoFactorCode }) => {
		if(!pendingTransferCollaborator || isDirty || transferOwnershipMutation.isPending) {
			return;
		}

		setTransferError("");
		try {
			const result = await transferOwnershipMutation.mutateAsync({
				newOwnerUserId: pendingTransferCollaborator.user_id,
				confirmation,
				twoFactorCode,
			});
			const newOwnerId = String(result.owner.user_id);
			const formerOwnerId = String(result.former_owner.user_id);
			setCollaborators((current) => [
				result.former_owner,
				...current.filter((collaborator) => ![newOwnerId, formerOwnerId].includes(String(collaborator.user_id))),
			]);
			setDraftCollaborators((current) => {
				const next = { ...current };
				delete next[newOwnerId];
				next[formerOwnerId] = buildCollaboratorDraft(result.former_owner, availablePermissions);
				return next;
			});
			setProjectOwner(result.owner);
			setOwnerDraft(buildOwnerDraft(result.owner));
			setExpandedUserId(null);
			setIsOwner(false);
			setPendingTransferCollaborator(null);
			toast.success(t("success.ownershipTransferred", { username: result.owner.username }));
			router.refresh();
		} catch (error) {
			const errorCode = error.response?.data?.code;
			if(errorCode === "TWO_FACTOR_REQUIRED") {
				setTransferRequiresTwoFactor(true);
			}
			const errorKey = {
				CONFIRMATION_MISMATCH: "errors.transferConfirmation",
				TWO_FACTOR_REQUIRED: "errors.transferTwoFactorRequired",
				INVALID_TWO_FACTOR_CODE: "errors.transferTwoFactorInvalid",
				TARGET_NOT_ACCEPTED: "errors.transferTarget",
				OWNERSHIP_CHANGED: "errors.transferChanged",
			}[errorCode] || "errors.transfer";
			setTransferError(t(errorKey));
		}
	};

	const isSearchDebouncing = searchInput.trim() !== debouncedSearchInput.trim();
	const showSearchPopover = isSearchOpen && searchInput.trim().length >= 2;

	return (
		<>
			<div className="settings-content project-collaborators-settings">
				{canManageInvites ? <section className="content content--padding">
					<p className="blog-settings__field-title">{t("invite.title")}</p>
					
					<p className="project-collaborators-settings__description">{t("invite.description")}</p>
					
					<p className="project-collaborators-settings__hint">{t("invite.hint")}</p>

					{selectedUsers.length > 0 ? (
						<div className="project-collaborators-settings__selected-users" aria-label={t("invite.selectedLabel")}>
							{selectedUsers.map((user) => (
								<button key={user.id} type="button" className="browse-selected-filter-chip project-collaborators-settings__selected-chip" onClick={() => removeSelectedUser(user.id)} aria-label={t("invite.removeSelection", { username: user.username })}>
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

								<input ref={searchInputRef} className="text-input" type="text" inputMode="search" autoComplete="off" spellCheck="false" value={searchInput} onChange={(event) => { setSearchInput(event.target.value); setIsSearchOpen(true); }} onFocus={() => setIsSearchOpen(true)} onKeyDown={handleSearchKeyDown} placeholder={t("invite.placeholder")} role="combobox" aria-autocomplete="list" aria-expanded={showSearchPopover} aria-controls={showSearchPopover ? listboxId : undefined} aria-activedescendant={showSearchPopover && !isSearchDebouncing && searchResults[highlightedIndex] ? `${listboxId}-${searchResults[highlightedIndex].id}` : undefined} />
							</label>

							{showSearchPopover ? (
								<div className="popover project-collaborators-settings__search-popover" id={listboxId} role="listbox" aria-label={t("invite.resultsLabel")}>
									<div className="context-list" data-scrollable>
										{isSearchDebouncing || searchQuery.isPending ? (
											<div className="project-collaborators-settings__search-state">{t("invite.searching")}</div>
										) : searchQuery.isError ? (
											<div className="project-collaborators-settings__search-state">{t("errors.search")}</div>
										) : searchResults.length === 0 ? (
											<div className="project-collaborators-settings__search-state">{t("invite.noResults")}</div>
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
							{isInviting ? t("actions.inviting") : t("actions.invite")}
						</button>
					</div>
				</section> : null}

				{projectOwner || collaborators.length > 0 ? (
					<section aria-labelledby="project-collaborators-list-title">
						<p className="blog-settings__field-title" id="project-collaborators-list-title">{t("list.title")}</p>

						<div className="project-collaborators-settings__list">
							{projectOwner ? (
								<ProjectCollaboratorCard
									key={`owner-${projectOwner.user_id}`}
									collaborator={projectOwner}
									draft={ownerDraft}
									availablePermissions={[]}
									expanded={expandedUserId === `owner-${projectOwner.user_id}`}
									onToggle={() => setExpandedUserId((current) => current === `owner-${projectOwner.user_id}` ? null : `owner-${projectOwner.user_id}`)}
									onChange={setOwnerDraft}
									canEdit={isOwner}
									canRemove={false}
									isRemoving={false}
									isProjectOwner
									t={t}
								/>
							) : null}

							{collaborators.map((collaborator) => {
								const userId = String(collaborator.user_id);
								return (
									<ProjectCollaboratorCard
										key={userId}
										collaborator={collaborator}
										draft={draftCollaborators[userId] || buildCollaboratorDraft(collaborator, availablePermissions)}
										availablePermissions={availablePermissions}
										expanded={expandedUserId === userId}
										onToggle={() => setExpandedUserId((current) => current === userId ? null : userId)}
										onChange={(draft) => setDraftCollaborators((current) => ({ ...current, [userId]: draft }))}
										onRemove={() => setPendingRemoveCollaborator(collaborator)}
										onTransferOwnership={() => { if(!isDirty) { setTransferError(""); setTransferRequiresTwoFactor(false); setPendingTransferCollaborator(collaborator); } }}
										canEdit={canEditMembers && (isOwner || Number(collaborator.user_id) !== Number(project.current_user_id))}
										canRemove={Number(collaborator.user_id) === Number(project.current_user_id) || (collaborator.status === "pending" ? canManageInvites : canRemoveMembers)}
										canTransferOwnership={isOwner && collaborator.status === "accepted"}
										isTransferDisabled={isDirty}
										isRemoving={removeMutation.isPending && String(pendingRemoveCollaborator?.user_id) === userId}
										isTransferring={transferOwnershipMutation.isPending && String(pendingTransferCollaborator?.user_id) === userId}
										t={t}
									/>
								);
							})}
						</div>
					</section>
				) : null}

				{isOwner ? <ProjectOrganizationSettings authToken={authToken} project={project} organizationOptions={organizationOptions} t={t} /> : null}
			</div>

			<UnsavedChangesBar isDirty={isDirty} isSaving={updateMutation.isPending || updateOwnerMutation.isPending} onSave={handleSave} onReset={() => { setDraftCollaborators(buildDraftMap(collaborators, availablePermissions)); setOwnerDraft(buildOwnerDraft(projectOwner)); }} saveLabel={t("actions.save")} resetLabel={tUnsaved("reset")} message={tUnsaved("message")} />

			<ConfirmModal
				isOpen={Boolean(pendingRemoveCollaborator)}
				title={pendingRemoveCollaborator ? t(pendingRemoveCollaborator.status === "pending" ? "confirm.cancelTitle" : "confirm.removeTitle", { username: pendingRemoveCollaborator.username }) : ""}
				confirmLabel={pendingRemoveCollaborator?.status === "pending" ? t("actions.cancelInvitation") : t("actions.remove")}
				cancelLabel={t("actions.keep")}
				isLoading={removeMutation.isPending}
				onConfirm={handleRemove}
				onRequestClose={() => { if(!removeMutation.isPending) setPendingRemoveCollaborator(null); }}
			/>

			<ProjectOwnershipTransferModal
				isOpen={Boolean(pendingTransferCollaborator)}
				projectTitle={project.title}
				owner={projectOwner}
				collaborator={pendingTransferCollaborator}
				twoFactorEnabled={twoFactorEnabled || transferRequiresTwoFactor}
				isLoading={transferOwnershipMutation.isPending}
				errorMessage={transferError}
				onClearError={() => setTransferError("")}
				onConfirm={handleTransferOwnership}
				onRequestClose={() => { if(!transferOwnershipMutation.isPending) { setPendingTransferCollaborator(null); setTransferError(""); setTransferRequiresTwoFactor(false); } }}
			/>
		</>
	);
}