"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import ConfirmModal from "@/modal/ConfirmModal";
import { useUpdateProjectOrganization } from "@/utils/collaborators/hooks";

export default function ProjectOrganizationSettings({ authToken, project, organizationOptions = [], t }) {
	const router = useRouter();
	const [currentOrganization, setCurrentOrganization] = useState(project.organization || null);
	const [selectedOrganizationSlug, setSelectedOrganizationSlug] = useState(project.organization?.slug || "");
	const [savedOrganizationSlug, setSavedOrganizationSlug] = useState(project.organization?.slug || "");
	const [isMenuOpen, setIsMenuOpen] = useState(false);
	const [isConfirmOpen, setIsConfirmOpen] = useState(false);
	const fieldRef = useRef(null);
	const listboxId = useId();
	const updateMutation = useUpdateProjectOrganization({ authToken, projectSlug: project.slug });
	const selectedOrganization = organizationOptions.find((organization) => organization.slug === selectedOrganizationSlug) || null;
	const isDirty = selectedOrganizationSlug !== savedOrganizationSlug;
	const isDetaching = Boolean(savedOrganizationSlug && !selectedOrganizationSlug);
	const isMoving = Boolean(savedOrganizationSlug && selectedOrganizationSlug);

	useEffect(() => {
		const handlePointerDown = (event) => {
			if(!fieldRef.current?.contains(event.target)) {
				setIsMenuOpen(false);
			}
		};
		const handleKeyDown = (event) => {
			if(event.key === "Escape") {
				setIsMenuOpen(false);
			}
		};

		document.addEventListener("mousedown", handlePointerDown);
		document.addEventListener("keydown", handleKeyDown);
		return () => {
			document.removeEventListener("mousedown", handlePointerDown);
			document.removeEventListener("keydown", handleKeyDown);
		};
	}, []);

	const selectOrganization = (slug) => {
		setSelectedOrganizationSlug(slug);
		setIsMenuOpen(false);
	};

	const handleConfirm = async () => {
		if(!isDirty || updateMutation.isPending) {
			return;
		}

		try {
			const data = await updateMutation.mutateAsync({ organizationSlug: selectedOrganizationSlug });
			setCurrentOrganization(data?.organization || null);
			setSavedOrganizationSlug(selectedOrganizationSlug);
			setIsConfirmOpen(false);
			toast.success(t("organization.success"));
			router.refresh();
		} catch (error) {
			toast.error(error.response?.data?.message || t("organization.error"));
		}
	};

	const confirmationKind = isDetaching ? "detach" : isMoving ? "move" : "attach";
	const confirmationValues = {
		organization: selectedOrganization?.name || currentOrganization?.name || t("organization.noOrganization"),
	};

	return (
		<>
			<section className="content content--padding project-team-settings__organization" aria-labelledby="project-team-organization-title">
				<p className="blog-settings__field-title" id="project-team-organization-title">{t("organization.title")}</p>
				
				<p className="project-team-settings__organization-description">{t("organization.description")}</p>

				<div className="project-team-settings__organization-row">
					<div className="field field--default blog-settings__input project-team-settings__organization-field" ref={fieldRef}>
						<button type="button" className="field__wrapper project-team-settings__organization-trigger" onClick={() => setIsMenuOpen((current) => !current)} aria-haspopup="listbox" aria-expanded={isMenuOpen} aria-controls={isMenuOpen ? listboxId : undefined}>
							<span className="project-team-settings__organization-choice">
								<strong>{selectedOrganization?.name || t("organization.noOrganization")}</strong>
								
								{selectedOrganization ? <small>@{selectedOrganization.slug}</small> : null}
							</span>

							<svg style={{ fill: "none" }} className={`icon icon--chevron_down ${isMenuOpen ? "rotate" : ""}`} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
								<path d="m6 9 6 6 6-6" />
							</svg>
						</button>

						{isMenuOpen ? (
							<div className="popover project-team-settings__organization-popover" id={listboxId} role="listbox" aria-label={t("organization.selectLabel")}>
								<div className="context-list" data-scrollable>
									<button type="button" role="option" aria-selected={!selectedOrganizationSlug} className={`context-list-option project-team-settings__organization-option ${!selectedOrganizationSlug ? "context-list-option--selected" : ""}`} onClick={() => selectOrganization("")}>
										<span className="context-list-option__label">{t("organization.noOrganization")}</span>
									</button>

									{organizationOptions.map((organization) => (
										<button key={organization.id} type="button" role="option" aria-selected={selectedOrganizationSlug === organization.slug} className={`context-list-option project-team-settings__organization-option ${selectedOrganizationSlug === organization.slug ? "context-list-option--selected" : ""}`} onClick={() => selectOrganization(organization.slug)}>
											<span className="context-list-option__label">{organization.name}</span>
										</button>
									))}
								</div>
							</div>
						) : null}
					</div>

					<button type="button" className="button button--size-l button--type-minimal project-team-settings__organization-save" onClick={() => setIsConfirmOpen(true)} disabled={!isDirty || updateMutation.isPending}>
						{updateMutation.isPending ? t("organization.saving") : t("organization.save")}
					</button>
				</div>

				<p className="project-team-settings__organization-hint">
					{organizationOptions.length > 0 || currentOrganization ? t("organization.hint") : t("organization.noOptions")}
				</p>
			</section>

			<ConfirmModal
				isOpen={isConfirmOpen}
				title={t(`organization.confirm.${confirmationKind}Title`, confirmationValues)}
				description={t(`organization.confirm.${confirmationKind}Description`, confirmationValues)}
				confirmLabel={t(`organization.confirm.${confirmationKind}Action`)}
				cancelLabel={t("organization.confirm.cancel")}
				isLoading={updateMutation.isPending}
				onConfirm={handleConfirm}
				onRequestClose={() => { if(!updateMutation.isPending) setIsConfirmOpen(false); }}
				confirmButtonClassName="button--type-primary"
			/>
		</>
	);
}