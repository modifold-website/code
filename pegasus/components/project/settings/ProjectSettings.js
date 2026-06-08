"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "../../providers/AuthProvider";
import { useRouter } from "next/navigation";
import axios from "axios";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useTranslations } from "next-intl";
import UnsavedChangesBar from "@/components/ui/UnsavedChangesBar";
import { validateSlug } from "@/utils/slug";

const getInitialFormData = (project) => ({
    title: project?.title || "",
    summary: project?.summary || "",
    visibility: project?.visibility || "public",
    issues_enabled: project?.issues_enabled === false || project?.issues_enabled === 0 ? false : true,
    show_players_last_14d: project?.show_players_last_14d === true || project?.show_players_last_14d === 1 || project?.show_players_last_14d === "1" ? true : false,
    slug: project?.slug || "",
    icon: null,
});

export default function ProjectSettings({ project, organizationOptions: initialOrganizationOptions = [] }) {
    const t = useTranslations("SettingsProjectPage");
    const { isLoggedIn } = useAuth();
    const router = useRouter();

    const [formData, setFormData] = useState(getInitialFormData(project));
    const [savedFormData, setSavedFormData] = useState(getInitialFormData(project));
    const [isSaving, setIsSaving] = useState(false);

    const [previewIcon, setPreviewIcon] = useState("");
    const [savedPreviewIcon, setSavedPreviewIcon] = useState(project?.icon_url || "");
    const iconInputRef = useRef(null);
    const [organizationOptions, setOrganizationOptions] = useState(() => initialOrganizationOptions);
    const [selectedOrganizationSlug, setSelectedOrganizationSlug] = useState(project?.organization?.slug || "");
    const [savedOrganizationSlug, setSavedOrganizationSlug] = useState(project?.organization?.slug || "");
    const [isOrganizationMenuOpen, setIsOrganizationMenuOpen] = useState(false);
    const [isIssuesMenuOpen, setIsIssuesMenuOpen] = useState(false);
    const [isVisibilityMenuOpen, setIsVisibilityMenuOpen] = useState(false);
    const [isPlayersCountMenuOpen, setIsPlayersCountMenuOpen] = useState(false);
    const organizationButtonRef = useRef(null);
    const organizationMenuRef = useRef(null);
    const issuesButtonRef = useRef(null);
    const issuesMenuRef = useRef(null);
    const visibilityButtonRef = useRef(null);
    const visibilityMenuRef = useRef(null);
    const playersCountButtonRef = useRef(null);
    const playersCountMenuRef = useRef(null);

    useEffect(() => {
        if(!isLoggedIn) {
            router.push("/403");
        } else if(project) {
            const initialData = getInitialFormData(project);
            const initialPreview = project.icon_url || "";
            const initialOrganizationSlug = project.organization?.slug || "";
            setFormData(initialData);
            setSavedFormData(initialData);
            setPreviewIcon(initialPreview);
            setSavedPreviewIcon(initialPreview);
            setSelectedOrganizationSlug(initialOrganizationSlug);
            setSavedOrganizationSlug(initialOrganizationSlug);
            setOrganizationOptions(initialOrganizationOptions);
        }
    }, [initialOrganizationOptions, isLoggedIn, project, router]);

    const isDirty = (
        formData.title !== savedFormData.title ||
        formData.summary !== savedFormData.summary ||
        formData.visibility !== savedFormData.visibility ||
        formData.issues_enabled !== savedFormData.issues_enabled ||
        formData.show_players_last_14d !== savedFormData.show_players_last_14d ||
        formData.slug !== savedFormData.slug ||
        selectedOrganizationSlug !== savedOrganizationSlug ||
        Boolean(formData.icon)
    );

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];

        if(file && file.size > 20 * 1024 * 1024) {
            toast.error(t("general.errors.fileTooLarge"));
            return;
        }

        setFormData((prev) => ({ ...prev, icon: file }));
        setPreviewIcon(file ? URL.createObjectURL(file) : project.icon_url || "");
    };

    const handleIconOverlayClick = () => {
        iconInputRef.current.click();
    };

    useEffect(() => {
        const handleClickOutside = (event) => {
            if(isOrganizationMenuOpen && !organizationMenuRef.current?.contains(event.target) && !organizationButtonRef.current?.contains(event.target)) {
                setIsOrganizationMenuOpen(false);
            }

            if(isIssuesMenuOpen && !issuesMenuRef.current?.contains(event.target) && !issuesButtonRef.current?.contains(event.target)) {
                setIsIssuesMenuOpen(false);
            }

            if(isVisibilityMenuOpen && !visibilityMenuRef.current?.contains(event.target) && !visibilityButtonRef.current?.contains(event.target)) {
                setIsVisibilityMenuOpen(false);
            }

            if(isPlayersCountMenuOpen && !playersCountMenuRef.current?.contains(event.target) && !playersCountButtonRef.current?.contains(event.target)) {
                setIsPlayersCountMenuOpen(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [isIssuesMenuOpen, isOrganizationMenuOpen, isPlayersCountMenuOpen, isVisibilityMenuOpen]);

    const handleSubmit = async (e) => {
        if(e) {
            e.preventDefault();
        }

        if(isSaving || !isDirty) {
            return;
        }

        const data = new FormData();
        data.append("title", formData.title);
        data.append("summary", formData.summary);
        data.append("visibility", formData.visibility);
        data.append("issues_enabled", formData.issues_enabled ? "1" : "0");
        data.append("show_players_last_14d", formData.show_players_last_14d ? "1" : "0");
        data.append("slug", formData.slug);
        if(formData.icon) {
            data.append("icon", formData.icon);
        }

        setIsSaving(true);

        try {
            const slugValidation = validateSlug(formData.slug, { currentSlug: savedFormData.slug });
            if(!slugValidation.valid) {
                toast.error(slugValidation.reason === "too_short" ? "URL must be at least 4 characters" : t("general.errors.save"));
                setIsSaving(false);
                return;
            }

            await axios.put(`${process.env.NEXT_PUBLIC_API_BASE}/projects/${project.id}`, data, {
                headers: {
                    Authorization: `Bearer ${localStorage.getItem("authToken")}`,
                    "Content-Type": "multipart/form-data",
                },
            });

            if(selectedOrganizationSlug !== savedOrganizationSlug) {
                await axios.put(`${process.env.NEXT_PUBLIC_API_BASE}/projects/${formData.slug || project.slug}/organization`, {
                    organization_slug: selectedOrganizationSlug || null,
                }, {
                    headers: {
                        Authorization: `Bearer ${localStorage.getItem("authToken")}`,
                    },
                });

                setSavedOrganizationSlug(selectedOrganizationSlug);
            }

            setSavedFormData({
                ...formData,
                slug: slugValidation.normalized,
                icon: null,
            });
            setFormData((prev) => ({ ...prev, slug: slugValidation.normalized, icon: null }));
            setSavedPreviewIcon(previewIcon);
            toast.success(t("general.success.saved"));
        } catch (err) {
            toast.error(err.response?.data?.message || t("general.errors.save"));
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        if(!confirm(t("general.confirmDelete", { title: project.title }))) {
            return;
        }

        try {
            await axios.delete(`${process.env.NEXT_PUBLIC_API_BASE}/projects/${project.slug}`, {
                headers: {
                    Authorization: `Bearer ${localStorage.getItem("authToken")}`,
                },
            });

            toast.success(t("general.success.deleted"));
            router.push("/");
        } catch (err) {
            toast.error(err.response?.data?.message || t("general.errors.delete"));
        }
    };

    if(!isLoggedIn || !project) {
        return null;
    }

    const toggleOrganizationMenu = () => setIsOrganizationMenuOpen((prev) => !prev);
    const selectedOrganization = organizationOptions.find((organization) => organization.slug === selectedOrganizationSlug);

    return (
        <>
            <div className="settings-wrapper settings-wrapper--narrow">
                <div className="settings-content">
                    <form onSubmit={handleSubmit}>
                        <div className="blog-settings">
                            <div className="blog-settings__body">
                                <p className="blog-settings__field-title">
                                    {t("general.fields.icon")}
                                </p>

                                <div className="blog-settings__avatar">
                                    <div className="avatar avatar--size-l">
                                        <div className="avatar__wrapper" style={{ "--background-color": "var(--theme-color-background)" }}>
                                            {previewIcon && (
                                                <img src={previewIcon} alt={t("general.iconAlt")} className="avatar__image" />
                                            )}

                                            <div className="avatar__overlay" onClick={handleIconOverlayClick}>
                                                <svg className="icon icon--image" width="40" height="40" viewBox="0 0 24 24">
                                                    <path d="M8 9.5a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0Z"></path>
                                                    <path fillRule="evenodd" clipRule="evenodd" d="M7 3a4 4 0 0 0-4 4v10a4 4 0 0 0 4 4h10a4 4 0 0 0 4-4V7a4 4 0 0 0-4-4H7ZM5 7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v5.252l-1.478-1.477a2 2 0 0 0-3.014.214L8.5 19H7a2 2 0 0 1-2-2V7Zm11.108 5.19L19 15.08V17a2 2 0 0 1-2 2h-6l5.108-6.81Z"></path>
                                                </svg>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <input type="file" id="icon" name="icon" accept="image/jpeg,image/png,image/gif" onChange={handleFileChange} ref={iconInputRef} style={{ display: "none" }} />

                                <p style={{ marginTop: "12px" }} className="blog-settings__field-title">
                                    {t("general.fields.name")}
                                </p>

                                <div className="field field--default blog-settings__input">
                                    <label style={{ marginBottom: "10px" }} className="field__wrapper">
                                        <input type="text" name="title" value={formData.title} onChange={handleInputChange} placeholder={t("general.placeholders.name")} className="text-input" maxLength="30" />
                                        <div className="counter">{formData.title.length}</div>
                                    </label>
                                </div>

                                <p className="blog-settings__field-title">{t("general.fields.summary")}</p>
                                <div className="field field--default textarea blog-settings__input">
                                    <label style={{ marginBottom: "10px" }} className="field__wrapper">
                                        <textarea name="summary" value={formData.summary} onChange={handleInputChange} placeholder={t("general.placeholders.summary")} className="autosize textarea__input" style={{ height: "256px" }} minLength={30} maxLength={256} />
                                    </label>

                                    <p>{t("general.hints.summary")}</p>
                                </div>

                                <p style={{ marginTop: "12px" }} className="blog-settings__field-title">{t("general.fields.url")}</p>
                                <div className="field field--default blog-settings__input">
                                    <label style={{ marginBottom: "10px" }} className="field__wrapper">
                                        <input type="text" name="slug" value={formData.slug} onChange={(e) => { const value = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 30); setFormData((prev) => ({ ...prev, slug: value })); }} placeholder={t("general.placeholders.url")} className="text-input" maxLength="30" />

                                        <div className="counter">{formData.slug.length}/30</div>
                                    </label>

                                    <p>{t("general.hints.url")}</p>
                                </div>

                                <p className="blog-settings__field-title">{t("general.fields.visibility")}</p>
                                <div className="field field--default blog-settings__input" ref={visibilityMenuRef}>
                                    <label style={{ marginBottom: "10px" }} className="field__wrapper" onClick={() => setIsVisibilityMenuOpen((prev) => !prev)} ref={visibilityButtonRef}>
                                        <div className="field__wrapper-body">
                                            <div className="select">
                                                <div className="select__selected">
                                                    {t(`general.visibility.${formData.visibility}`)}
                                                </div>
                                            </div>
                                        </div>

                                        <svg style={{ fill: "none" }} className={`icon icon--chevron_down ${isVisibilityMenuOpen ? "rotate" : ""}`} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"></path></svg>
                                    </label>

                                    {isVisibilityMenuOpen && (
                                        <div className="popover">
                                            <div className="context-list" data-scrollable>
                                                <div className={`context-list-option ${formData.visibility === "public" ? "context-list-option--selected" : ""}`} onClick={() => { setFormData((prev) => ({ ...prev, visibility: "public" })); setIsVisibilityMenuOpen(false); }}>
                                                    <div className="context-list-option__label">{t("general.visibility.public")}</div>
                                                </div>

                                                <div className={`context-list-option ${formData.visibility === "unlisted" ? "context-list-option--selected" : ""}`} onClick={() => { setFormData((prev) => ({ ...prev, visibility: "unlisted" })); setIsVisibilityMenuOpen(false); }}>
                                                    <div className="context-list-option__label">{t("general.visibility.unlisted")}</div>
                                                </div>

                                                <div className={`context-list-option ${formData.visibility === "private" ? "context-list-option--selected" : ""}`} onClick={() => { setFormData((prev) => ({ ...prev, visibility: "private" })); setIsVisibilityMenuOpen(false); }}>
                                                    <div className="context-list-option__label">{t("general.visibility.private")}</div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    <p>{t("general.hints.visibility")}</p>
                                </div>

                                <p className="blog-settings__field-title">{t("general.fields.issues")}</p>
                                <div className="field field--default blog-settings__input" ref={issuesMenuRef}>
                                    <label style={{ marginBottom: "10px" }} className="field__wrapper" onClick={() => setIsIssuesMenuOpen((prev) => !prev)} ref={issuesButtonRef}>
                                        <div className="field__wrapper-body">
                                            <div className="select">
                                                <div className="select__selected">
                                                    {formData.issues_enabled ? t("general.issues.enabled") : t("general.issues.disabled")}
                                                </div>
                                            </div>
                                        </div>

                                        <svg style={{ fill: "none" }} className={`icon icon--chevron_down ${isIssuesMenuOpen ? "rotate" : ""}`} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"></path></svg>
                                    </label>

                                    {isIssuesMenuOpen && (
                                        <div className="popover">
                                            <div className="context-list" data-scrollable>
                                                <div className={`context-list-option ${formData.issues_enabled ? "context-list-option--selected" : ""}`} onClick={() => { setFormData((prev) => ({ ...prev, issues_enabled: true })); setIsIssuesMenuOpen(false); }}>
                                                    <div className="context-list-option__label">{t("general.issues.enabled")}</div>
                                                </div>
                                                
                                                <div className={`context-list-option ${!formData.issues_enabled ? "context-list-option--selected" : ""}`} onClick={() => { setFormData((prev) => ({ ...prev, issues_enabled: false })); setIsIssuesMenuOpen(false); }}>
                                                    <div className="context-list-option__label">{t("general.issues.disabled")}</div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    <p>{t("general.hints.issues")}</p>
                                </div>

                                <p className="blog-settings__field-title">{t("general.fields.playersCount")}</p>
                                <div className="field field--default blog-settings__input" ref={playersCountMenuRef}>
                                    <label style={{ marginBottom: "10px" }} className="field__wrapper" onClick={() => setIsPlayersCountMenuOpen((prev) => !prev)} ref={playersCountButtonRef}>
                                        <div className="field__wrapper-body">
                                            <div className="select">
                                                <div className="select__selected">
                                                    {formData.show_players_last_14d ? t("general.playersCount.enabled") : t("general.playersCount.disabled")}
                                                </div>
                                            </div>
                                        </div>

                                        <svg style={{ fill: "none" }} className={`icon icon--chevron_down ${isPlayersCountMenuOpen ? "rotate" : ""}`} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"></path></svg>
                                    </label>

                                    {isPlayersCountMenuOpen && (
                                        <div className="popover">
                                            <div className="context-list" data-scrollable>
                                                <div className={`context-list-option ${formData.show_players_last_14d ? "context-list-option--selected" : ""}`} onClick={() => { setFormData((prev) => ({ ...prev, show_players_last_14d: true })); setIsPlayersCountMenuOpen(false); }}>
                                                    <div className="context-list-option__label">{t("general.playersCount.enabled")}</div>
                                                </div>

                                                <div className={`context-list-option ${!formData.show_players_last_14d ? "context-list-option--selected" : ""}`} onClick={() => { setFormData((prev) => ({ ...prev, show_players_last_14d: false })); setIsPlayersCountMenuOpen(false); }}>
                                                    <div className="context-list-option__label">{t("general.playersCount.disabled")}</div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    <p>{t("general.hints.playersCount")}</p>
                                </div>

                                <p className="blog-settings__field-title">{t("general.organization.title")}</p>
                                <div className="field field--default blog-settings__input" ref={organizationMenuRef}>
                                    <label style={{ marginBottom: "10px" }} className="field__wrapper" onClick={toggleOrganizationMenu} ref={organizationButtonRef}>
                                        <div className="field__wrapper-body">
                                            <div className="select">
                                                <div className="select__selected">
                                                    {selectedOrganization?.name || t("general.organization.noOrganization")}
                                                </div>
                                            </div>
                                        </div>

                                        <svg style={{ fill: "none" }} className={`icon icon--chevron_down ${isOrganizationMenuOpen ? "rotate" : ""}`} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"></path></svg>
                                    </label>

                                    {isOrganizationMenuOpen && (
                                        <div className="popover">
                                            <div className="context-list" data-scrollable>
                                                <div className={`context-list-option ${selectedOrganizationSlug === "" ? "context-list-option--selected" : ""}`} onClick={() => { setSelectedOrganizationSlug(""); setIsOrganizationMenuOpen(false); }}>
                                                    <div className="context-list-option__label">{t("general.organization.noOrganization")}</div>
                                                </div>

                                                {organizationOptions.map((organization) => (
                                                    <div key={organization.id} className={`context-list-option ${selectedOrganizationSlug === organization.slug ? "context-list-option--selected" : ""}`} onClick={() => { setSelectedOrganizationSlug(organization.slug); setIsOrganizationMenuOpen(false); }}>
                                                        <div className="context-list-option__label">{organization.name}</div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    <p>{t("general.organization.hint")}</p>
                                </div>

                                <div style={{ marginTop: "18px", display: "flex", gap: "10px" }}>
                                    <button type="button" className="button button--size-m button--type-negative" onClick={handleDelete}>
                                        {t("general.actions.delete")}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </form>
                </div>
            </div>

            <UnsavedChangesBar
                isDirty={isDirty}
                isSaving={isSaving}
                onSave={handleSubmit}
                onReset={() => {
                    setFormData({ ...savedFormData, icon: null });
                    setPreviewIcon(savedPreviewIcon);
                    setSelectedOrganizationSlug(savedOrganizationSlug);
                    setIsOrganizationMenuOpen(false);
                    setIsIssuesMenuOpen(false);
                    setIsVisibilityMenuOpen(false);
                    setIsPlayersCountMenuOpen(false);
                    if(iconInputRef.current) {
                        iconInputRef.current.value = "";
                    }
                }}
                saveLabel={t("general.actions.save")}
                resetLabel={t("unsavedBar.reset")}
                message={t("unsavedBar.message")}
            />
        </>
    );
}