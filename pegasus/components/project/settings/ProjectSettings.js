"use client";

import { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { useAuth } from "../../providers/AuthProvider";
import { useRouter } from "next/navigation";
import axios from "axios";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useTranslations } from "next-intl";
import UnsavedChangesBar from "@/components/ui/UnsavedChangesBar";
import ConfirmModal from "@/modal/ConfirmModal";
import { validateSlug } from "@/utils/slug";
import { getProjectPathByType, isBuildContentProjectType } from "@/utils/projectRoutes";

const ProjectIconEditorModal = dynamic(() => import("@/modal/ProjectIconEditorModal"), { ssr: false });

const getInitialFormData = (project) => ({
    title: project?.title || "",
    summary: project?.summary || "",
    visibility: project?.visibility || "public",
    issues_enabled: project?.issues_enabled === false || project?.issues_enabled === 0 ? false : true,
    show_players_last_14d: project?.show_players_last_14d === true || project?.show_players_last_14d === 1 || project?.show_players_last_14d === "1" ? true : false,
    slug: project?.slug || "",
    icon: null,
});

export default function ProjectSettings({ project, analyticsConnected = false }) {
    const t = useTranslations("SettingsProjectPage");
    const tProject = useTranslations("ProjectPage");
    const { isLoggedIn } = useAuth();
    const router = useRouter();

    const [formData, setFormData] = useState(getInitialFormData(project));
    const [savedFormData, setSavedFormData] = useState(getInitialFormData(project));
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const [isDeletingProject, setIsDeletingProject] = useState(false);
	const [isIconEditorOpen, setIsIconEditorOpen] = useState(false);
	const [isIconMenuOpen, setIsIconMenuOpen] = useState(false);

    const [previewIcon, setPreviewIcon] = useState("");
    const [savedPreviewIcon, setSavedPreviewIcon] = useState(project?.icon_url || "");
    const iconInputRef = useRef(null);
	const iconMenuRef = useRef(null);
	const iconMenuTriggerRef = useRef(null);
    const [isIssuesMenuOpen, setIsIssuesMenuOpen] = useState(false);
    const [isVisibilityMenuOpen, setIsVisibilityMenuOpen] = useState(false);
    const [isPlayersCountMenuOpen, setIsPlayersCountMenuOpen] = useState(false);
	const projectType = project?.project_type || project?.projectType || project?.type;
	const canEditDetails = Boolean(project?.permissions?.can_edit_details);
	const hasUploadedVersion = Number(project?.versions_count) > 0 || project?.versions?.length > 0;
	const canDeleteProject = Boolean(project?.permissions?.can_delete_project);
	const showPlayersCountSetting = !isBuildContentProjectType(projectType) && analyticsConnected;
    const issuesButtonRef = useRef(null);
    const issuesMenuRef = useRef(null);
    const visibilityButtonRef = useRef(null);
    const visibilityMenuRef = useRef(null);
    const playersCountButtonRef = useRef(null);
    const playersCountMenuRef = useRef(null);

    useEffect(() => {
        if(project) {
            const initialData = getInitialFormData(project);
            const initialPreview = project.icon_url || "";
            setFormData(initialData);
            setSavedFormData(initialData);
            setPreviewIcon(initialPreview);
            setSavedPreviewIcon(initialPreview);
        }
    }, [project]);

    const isDirty = (
        formData.title !== savedFormData.title ||
        formData.summary !== savedFormData.summary ||
        formData.visibility !== savedFormData.visibility ||
        formData.issues_enabled !== savedFormData.issues_enabled ||
        (showPlayersCountSetting && formData.show_players_last_14d !== savedFormData.show_players_last_14d) ||
        formData.slug !== savedFormData.slug ||
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

	const handleIconMenuToggle = () => {
		setIsIconMenuOpen((current) => !current);
	};

	const handleIconUploadClick = () => {
		setIsIconMenuOpen(false);
		iconMenuTriggerRef.current?.focus();
		iconInputRef.current?.click();
	};

	const handleIconCreatorClick = () => {
		setIsIconMenuOpen(false);
		iconMenuTriggerRef.current?.focus();
		setIsIconEditorOpen(true);
	};

	const handleIconMenuKeyDown = (event) => {
		const items = [...event.currentTarget.querySelectorAll('[role="menuitem"]')];
		const currentIndex = items.indexOf(document.activeElement);

		if(event.key === "Escape") {
			event.preventDefault();
			setIsIconMenuOpen(false);
			iconMenuTriggerRef.current?.focus();
			return;
		}

		if(event.key === "Tab") {
			setIsIconMenuOpen(false);
			return;
		}

		if(event.key === "ArrowDown" || event.key === "ArrowUp") {
			event.preventDefault();
			const direction = event.key === "ArrowDown" ? 1 : -1;
			items[(currentIndex + direction + items.length) % items.length]?.focus();
		}

		if(event.key === "Home" || event.key === "End") {
			event.preventDefault();
			items[event.key === "Home" ? 0 : items.length - 1]?.focus();
		}
	};

	const handleEditorIconSaved = (iconUrl) => {
		setPreviewIcon(iconUrl);
		setSavedPreviewIcon(iconUrl);
		setFormData((current) => ({ ...current, icon: null }));
		setSavedFormData((current) => ({ ...current, icon: null }));
	};

    useEffect(() => {
        const handleClickOutside = (event) => {
            if(isIssuesMenuOpen && !issuesMenuRef.current?.contains(event.target) && !issuesButtonRef.current?.contains(event.target)) {
                setIsIssuesMenuOpen(false);
            }

            if(isVisibilityMenuOpen && !visibilityMenuRef.current?.contains(event.target) && !visibilityButtonRef.current?.contains(event.target)) {
                setIsVisibilityMenuOpen(false);
            }

            if(isPlayersCountMenuOpen && !playersCountMenuRef.current?.contains(event.target) && !playersCountButtonRef.current?.contains(event.target)) {
                setIsPlayersCountMenuOpen(false);
            }

			if(isIconMenuOpen && !iconMenuRef.current?.contains(event.target)) {
				setIsIconMenuOpen(false);
			}
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
	}, [isIconMenuOpen, isIssuesMenuOpen, isPlayersCountMenuOpen, isVisibilityMenuOpen]);

	useEffect(() => {
		if(!isIconMenuOpen) return;
		window.requestAnimationFrame(() => {
			iconMenuRef.current?.querySelector('[role="menuitem"]')?.focus();
		});
	}, [isIconMenuOpen]);

	const handleSubmit = async (e) => {
        if(e) {
            e.preventDefault();
        }

		if(!canEditDetails || isSaving || !isDirty) {
            return;
        }

        const data = new FormData();
        data.append("title", formData.title);
        data.append("summary", formData.summary);
        data.append("visibility", formData.visibility);
        data.append("issues_enabled", formData.issues_enabled ? "1" : "0");
        if(showPlayersCountSetting) {
            data.append("show_players_last_14d", formData.show_players_last_14d ? "1" : "0");
        }
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

            const previousSlug = savedFormData.slug || project.slug;
            const response = await axios.put(`${process.env.NEXT_PUBLIC_API_BASE}/projects/${project.id}`, data, {
                headers: {
                    Authorization: `Bearer ${localStorage.getItem("authToken")}`,
                    "Content-Type": "multipart/form-data",
                },
            });
            const nextSlug = response.data?.slug || slugValidation.normalized;

            setSavedFormData({
                ...formData,
                slug: nextSlug,
                icon: null,
            });
            setFormData((prev) => ({ ...prev, slug: nextSlug, icon: null }));
            setSavedPreviewIcon(previewIcon);
            toast.success(t("general.success.saved"));
            if(nextSlug !== previousSlug) {
                router.replace(getProjectPathByType({ slug: nextSlug, projectType, suffix: "/settings" }));
                router.refresh();
            }
        } catch (err) {
            toast.error(err.response?.data?.message || t("general.errors.save"));
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        try {
            setIsDeletingProject(true);
            await axios.delete(`${process.env.NEXT_PUBLIC_API_BASE}/projects/${project.slug}`, {
                headers: {
                    Authorization: `Bearer ${localStorage.getItem("authToken")}`,
                },
            });

            toast.success(t("general.success.deleted"));
            setIsDeleteConfirmOpen(false);
            router.push("/dashboard");
        } catch (err) {
            toast.error(err.response?.data?.message || t("general.errors.delete"));
        } finally {
            setIsDeletingProject(false);
        }
    };

    if(!isLoggedIn || !project) {
        return null;
    }

    return (
        <>
            <div className="settings-wrapper settings-wrapper--narrow">
                <div className="settings-content">
                    <form onSubmit={handleSubmit}>
                        <div className="blog-settings">
                            <div className="blog-settings__body">
								{canEditDetails ? <>
                                    <p className="blog-settings__field-title">
                                        {t("general.fields.icon")}
                                    </p>

                                    <div ref={iconMenuRef} className="blog-settings__avatar project-icon-settings">
                                        <div className="avatar avatar--size-l">
                                            <div className="avatar__wrapper" style={{ "--background-color": "var(--theme-color-background)" }}>
                                                {previewIcon && (
                                                    <img src={previewIcon} alt={t("general.iconAlt")} className="avatar__image" />
                                                )}

                                                <button ref={iconMenuTriggerRef} type="button" className="avatar__overlay" onClick={handleIconMenuToggle} aria-label={t("general.iconEditor.changeIcon")} aria-haspopup="menu" aria-expanded={isIconMenuOpen} aria-controls="popover-overlay">
                                                    <svg className="icon icon--image" width="40" height="40" viewBox="0 0 24 24" aria-hidden="true">
                                                        <path d="M8 9.5a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0Z"></path>
                                                        <path fillRule="evenodd" clipRule="evenodd" d="M7 3a4 4 0 0 0-4 4v10a4 4 0 0 0 4 4h10a4 4 0 0 0 4-4V7a4 4 0 0 0-4-4H7ZM5 7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v5.252l-1.478-1.477a2 2 0 0 0-3.014.214L8.5 19H7a2 2 0 0 1-2-2V7Zm11.108 5.19L19 15.08V17a2 2 0 0 1-2 2h-6l5.108-6.81Z"></path>
                                                    </svg>
                                                </button>
                                            </div>
                                        </div>

										{isIconMenuOpen ? (
											<div id="popover-overlay" className="popover-overlay version-actions__overlay project-icon-settings__popover-overlay">
								                <div className="popover" tabIndex={0} role="menu" onKeyDown={handleIconMenuKeyDown} style={{ "--width": "max-content", "--top": "calc(100% + 8px)", "--position": "absolute", "--left": "0", "--right": "auto", "--bottom": "auto", "--distance": "8px" }}>
													<div className="popover__scrollable" style={{ "--max-height": "auto" }}>
														<button type="button" className="context-list-option context-list-option--with-art" style={{ width: "100%" }} role="menuitem" onClick={handleIconUploadClick}>
															<div className="context-list-option__art context-list-option__art--icon">
                                                                <svg style={{ fill: "none" }} xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon lucide lucide-upload">
                                                                    <path d="M12 3v12"/>
                                                                    <path d="m17 8-5-5-5 5"/>
                                                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                                                                </svg>
                                                            </div>

															<div className="context-list-option__label">{t("general.iconEditor.uploadIcon")}</div>
														</button>

														{hasUploadedVersion ? (
															<button type="button" className="context-list-option context-list-option--with-art" style={{ width: "100%" }} role="menuitem" onClick={handleIconCreatorClick}>
																<div className="context-list-option__art context-list-option__art--icon">
                                                                    <svg style={{ fill: "none" }} xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon lucide lucide-file-box">
                                                                        <path d="M14 2v5a1 1 0 001 1h5"/>
                                                                        <path d="M14.692 22H18a2 2 0 002-2V8a2.4 2.4 0 00-.706-1.706l-3.588-3.588A2.4 2.4 0 0014 2H6a2 2 0 00-2 2v3.804"/>
                                                                        <path d="M2.264 13.752 7 16.5l4.737-2.748"/>
                                                                        <path d="M2.995 13.014A2 2 0 002 14.744v3.516a2 2 0 00.996 1.73l3 1.74a2 2 0 002.008 0l3-1.74A2 2 0 0012 18.26v-3.517a2 2 0 00-.995-1.73l-3-1.742a2 2 0 00-1.892-.064z"/>
                                                                        <path d="M7 16.5V22"/>
                                                                    </svg>
                                                                </div>

																<div className="context-list-option__label">{t("general.iconEditor.open")}</div>
															</button>
														) : null}
													</div>
												</div>
											</div>
										) : null}
                                    </div>

                                    <input type="file" id="icon" name="icon" accept="image/jpeg,image/png,image/webp,image/gif" onChange={handleFileChange} ref={iconInputRef} style={{ display: "none" }} />

                                    <p style={{ marginTop: "12px" }} className="blog-settings__field-title">
                                        {t("general.fields.name")}
                                    </p>

                                    <div className="field field--default blog-settings__input">
                                        <label style={{ marginBottom: "10px" }} className="field__wrapper">
                                            <input type="text" name="title" value={formData.title} onChange={handleInputChange} placeholder={t("general.placeholders.name")} className="text-input" maxLength="70" />
                                            <div className="counter">{formData.title.length}/70</div>
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

                                    {showPlayersCountSetting ? (
                                        <>
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
                                        </>
                                    ) : null}
								</> : null}

								{canDeleteProject ? <div style={{ marginTop: canEditDetails ? "18px" : 0, display: "flex", gap: "10px" }}>
                                    <button type="button" className="button button--size-m button--type-negative" onClick={() => setIsDeleteConfirmOpen(true)}>
                                        {t("general.actions.delete")}
                                    </button>
								</div> : null}
                            </div>
                        </div>
                    </form>
                </div>
            </div>

			<ProjectIconEditorModal
				isOpen={isIconEditorOpen}
				onRequestClose={() => setIsIconEditorOpen(false)}
				project={project}
				onSaved={handleEditorIconSaved}
			/>

            <UnsavedChangesBar
				isDirty={canEditDetails && isDirty}
                isSaving={isSaving}
                onSave={handleSubmit}
                onReset={() => {
                    setFormData({ ...savedFormData, icon: null });
                    setPreviewIcon(savedPreviewIcon);
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
			<ConfirmModal
				isOpen={isDeleteConfirmOpen}
				title={t("general.deleteConfirmTitle")}
				messageTitle={project.title}
				description={t("general.deleteConfirmDescription")}
				confirmLabel={t("general.actions.delete")}
				cancelLabel={tProject("cancel")}
				isLoading={isDeletingProject}
				onConfirm={handleDelete}
				onRequestClose={() => {
					if(!isDeletingProject) {
						setIsDeleteConfirmOpen(false);
					}
				}}
			/>
        </>
    );
}