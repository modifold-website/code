"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { toast } from "react-toastify";
import Modal from "react-modal";
import { useTranslations } from "next-intl";
import UnsavedChangesBar from "@/components/ui/UnsavedChangesBar";
import OrganizationSettingsSidebar from "@/components/organizations/settings/OrganizationSettingsSidebar";
import { SLUG_MAX_LENGTH, normalizeSlugInput, validateSlug } from "@/utils/slug";

Modal.setAppElement("body");

export default function OrganizationOverviewSettingsPage({ authToken, organization, my_permissions }) {
    const t = useTranslations("Organizations");
    const tUnsaved = useTranslations("SettingsProjectPage.unsavedBar");
    const router = useRouter();

    const [name, setName] = useState(organization?.name || "");
    const [slug, setSlug] = useState(organization?.slug || "");
    const [summary, setSummary] = useState(organization?.summary || "");
    const [savedName, setSavedName] = useState(organization?.name || "");
    const [savedSlug, setSavedSlug] = useState(organization?.slug || "");
    const [savedSummary, setSavedSummary] = useState(organization?.summary || "");
    const [iconUrl, setIconUrl] = useState(organization?.icon_url || "https://media.modifold.com/static/no-project-icon.svg");
    const [savedIconUrl, setSavedIconUrl] = useState(organization?.icon_url || "https://media.modifold.com/static/no-project-icon.svg");
    const [iconFile, setIconFile] = useState(null);
    const [previewIcon, setPreviewIcon] = useState(organization?.icon_url || "https://media.modifold.com/static/no-project-icon.svg");
    const [isSaving, setIsSaving] = useState(false);
    const [isDeletingOrganization, setIsDeletingOrganization] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const iconInputRef = useRef(null);

    const canEditDetails = Boolean(my_permissions?.is_owner || my_permissions?.organization_permissions?.includes("organization_edit_details"));
    const canDeleteOrganization = Boolean(my_permissions?.is_owner || my_permissions?.organization_permissions?.includes("organization_delete"));
    const isDirty = name !== savedName || slug !== savedSlug || summary !== savedSummary || Boolean(iconFile);
    const currentOrganization = { ...organization, slug: savedSlug || organization?.slug, name, icon_url: iconUrl || "https://media.modifold.com/static/no-project-icon.svg" };

    const handleSave = async () => {
        if(isSaving) {
            return;
        }

        const validation = validateSlug(slug, { currentSlug: savedSlug });
        if(!validation.valid) {
            toast.error(t(`settings.slug.errors.${validation.reason}`));
            return;
        }

        setIsSaving(true);

        try {
            if(iconFile) {
                const data = new FormData();
                data.append("icon", iconFile);

                const iconResponse = await axios.put(`${process.env.NEXT_PUBLIC_API_BASE}/organizations/${organization.slug}/icon`, data, {
                    headers: {
                        Authorization: `Bearer ${authToken}`,
                        "Content-Type": "multipart/form-data",
                    },
                });

                if(iconResponse.data?.icon_url) {
                    setIconUrl(iconResponse.data.icon_url);
                    setSavedIconUrl(iconResponse.data.icon_url);
                    setPreviewIcon(iconResponse.data.icon_url);
                }
            }

            await axios.put(`${process.env.NEXT_PUBLIC_API_BASE}/organizations/${organization.slug}/settings`, {
                name,
                slug: validation.normalized,
                summary,
            }, {
                headers: {
                    Authorization: `Bearer ${authToken}`,
                },
            });

            setSavedName(name);
            setSavedSlug(slug);
            setSavedSummary(summary);
            setIconFile(null);
            if(iconInputRef.current) {
                iconInputRef.current.value = "";
            }

            toast.success(t("settings.successSaved"));
            if(slug !== organization.slug) {
                router.push(`/organization/${slug}/settings`);
                router.refresh();
            }
        } catch (error) {
            toast.error(error.response?.data?.message || t("settings.errors.save"));
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteOrganization = async () => {
        if(!canDeleteOrganization || isDeletingOrganization) {
            return;
        }

        setIsDeletingOrganization(true);

        try {
            await axios.delete(`${process.env.NEXT_PUBLIC_API_BASE}/organizations/${organization.slug}`, {
                headers: {
                    Authorization: `Bearer ${authToken}`,
                },
            });

            toast.success(t("settings.delete.success"));
            setIsDeleteModalOpen(false);
            router.push("/dashboard/organizations");
        } catch (error) {
            toast.error(error.response?.data?.message || t("settings.delete.error"));
        } finally {
            setIsDeletingOrganization(false);
        }
    };

    const handleFileChange = (event) => {
        const file = event.target.files?.[0];
        if(!file) {
            return;
        }

        if(file.size > 20 * 1024 * 1024) {
            toast.error(t("settings.errors.fileTooLarge"));
            event.target.value = "";
            return;
        }

        setIconFile(file);
        setPreviewIcon(URL.createObjectURL(file));
    };

    const handleAvatarOverlayClick = () => {
        if(!canEditDetails || isSaving) {
            return;
        }

        iconInputRef.current?.click();
    };

    return (
        <div className="layout">
            <div className="page-content settings-page">
                <OrganizationSettingsSidebar organization={currentOrganization} />

                <div className="settings-content settings-wrapper--narrow" style={{ display: "grid", gap: "16px" }}>
                    <div className="settings-wrapper blog-settings">
                        <div className="blog-settings__body">
                            <div className="subsite-header">
                                <div className="subsite-avatar subsite-header__avatar" style={{ borderRadius: "14px", "--size": "100px" }}>
                                    <div className="andropov-media andropov-media--rounded andropov-media--bordered andropov-media--has-preview subsite-avatar__image andropov-image andropov-image--zoom" style={{ aspectRatio: "1 / 1", width: "100px", height: "100px", maxWidth: "none", borderRadius: "14px" }} data-loaded="true">
                                        {previewIcon && <img id="create_image_url_avatar" src={previewIcon} alt={t("settings.iconAlt", { name: organization.name })} />}
                                    </div>

                                    {canEditDetails && (
                                        <div className="subsite-avatar__overlay" onClick={handleAvatarOverlayClick} aria-label={t("settings.actions.uploadIcon")}>
                                            <svg className="icon icon--image" width="40" height="40" viewBox="0 0 24 24">
                                                <path d="M8 9.5a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0Z"></path>
                                                <path fillRule="evenodd" clipRule="evenodd" d="M7 3a4 4 0 0 0-4 4v10a4 4 0 0 0 4 4h10a4 4 0 0 0 4-4V7a4 4 0 0 0-4-4H7ZM5 7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v5.252l-1.478-1.477a2 2 0 0 0-3.014.214L8.5 19H7a2 2 0 0 1-2-2V7Zm11.108 5.19L19 15.08V17a2 2 0 0 1-2 2h-6l5.108-6.81Z"></path>
                                            </svg>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <input type="file" id="icon" name="icon" accept="image/jpeg,image/png,image/gif,image/webp" onChange={handleFileChange} ref={iconInputRef} disabled={isSaving} style={{ display: "none" }} />

                            <p className="blog-settings__field-title">{t("settings.fields.name")}</p>
                            <div className="field field--default blog-settings__input">
                                <label className="field__wrapper">
                                    <input className="text-input" value={name} onChange={(event) => setName(event.target.value)} disabled={!canEditDetails} />
                                </label>
                            </div>

                            <p className="blog-settings__field-title">{t("settings.fields.url")}</p>
                            <div className="field field--default blog-settings__input">
                                <label style={{ marginBottom: "10px" }} className="field__wrapper">
                                    <input className="text-input" value={slug} onChange={(event) => setSlug(normalizeSlugInput(event.target.value))} disabled={!canEditDetails} maxLength={SLUG_MAX_LENGTH} />
                                    <div className="counter">{slug.length}/{SLUG_MAX_LENGTH}</div>
                                </label>
                            </div>

                            <p className="blog-settings__field-title">{t("settings.fields.summary")}</p>
                            <div className="field field--default textarea blog-settings__input">
                                <label className="field__wrapper">
                                    <textarea className="autosize textarea__input" value={summary} onChange={(event) => setSummary(event.target.value)} style={{ height: "130px" }} disabled={!canEditDetails} />
                                </label>
                            </div>
                        </div>
                    </div>

                    {canDeleteOrganization && (
                        <div className="content content--padding">
                            <h2 style={{ marginTop: 0 }}>{t("settings.delete.title")}</h2>
                            <p style={{ marginBottom: "12px", color: "var(--theme-color-text-secondary)" }}>{t("settings.delete.description")}</p>
                            
                            <button type="button" className="button button--size-m button--type-danger" onClick={() => setIsDeleteModalOpen(true)} disabled={isDeletingOrganization}>
                                {t("settings.delete.action")}
                            </button>
                        </div>
                    )}
                </div>

                <Modal closeTimeoutMS={150} isOpen={isDeleteModalOpen} onRequestClose={() => setIsDeleteModalOpen(false)} className="modal active" overlayClassName="modal-overlay">
                    <div className="modal-window">
                        <div className="modal-window__header">
                            <button className="icon-button modal-window__close" type="button" onClick={() => setIsDeleteModalOpen(false)} disabled={isDeletingOrganization} aria-label={t("settings.delete.close")}>
                                <svg className="icon icon--cross" height="24" width="24">
                                    <path fillRule="evenodd" clipRule="evenodd" d="M5.293 5.293a1 1 0 0 1 1.414 0L12 10.586l5.293-5.293a1 1 0 0 1 1.414 1.414L13.414 12l5.293 5.293a1 1 0 0 1-1.414 1.414L12 13.414l-5.293 5.293a1 1 0 0 1-1.414-1.414L10.586 12 5.293 6.707a1 1 0 0 1 0-1.414Z"></path>
                                </svg>
                            </button>
                        </div>

                        <div className="modal-window__content">
                            <p className="blog-settings__field-title">{t("settings.delete.confirmTitle")}</p>

                            <p style={{ lineHeight: 1.5, margin: "16px 0 24px" }}>
                                {t("settings.delete.description")}
                            </p>

                            <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
                                <button type="button" onClick={() => setIsDeleteModalOpen(false)} className="button button--size-m button--type-minimal" disabled={isDeletingOrganization}>
                                    {t("settings.delete.cancel")}
                                </button>

                                <button type="button" onClick={handleDeleteOrganization} className="button button--size-m button--type-danger" disabled={isDeletingOrganization}>
                                    {isDeletingOrganization ? t("settings.delete.deleting") : t("settings.delete.confirmAction")}
                                </button>
                            </div>
                        </div>
                    </div>
                </Modal>

                {canEditDetails && (
                    <UnsavedChangesBar
                        isDirty={isDirty}
                        isSaving={isSaving}
                        onSave={handleSave}
                        onReset={() => {
                            setName(savedName);
                            setSlug(savedSlug);
                            setSummary(savedSummary);
                            setIconFile(null);
                            setPreviewIcon(savedIconUrl || iconUrl || "https://media.modifold.com/static/no-project-icon.svg");
                            if(iconInputRef.current) {
                                iconInputRef.current.value = "";
                            }
                        }}
                        saveLabel={t("settings.actions.save")}
                        resetLabel={tUnsaved("reset")}
                        message={tUnsaved("message")}
                    />
                )}
            </div>
        </div>
    );
}