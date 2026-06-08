"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "../providers/AuthProvider";
import { useRouter } from "next/navigation";
import axios from "axios";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useTranslations } from "next-intl";
import UnsavedChangesBar from "@/components/ui/UnsavedChangesBar";
import { SLUG_MAX_LENGTH, normalizeSlugInput, validateSlug } from "@/utils/slug";

const getEmptySocialLinks = () => ({
    youtube: "",
    telegram: "",
    x: "",
    discord: "",
});

const getInitialFormData = (user) => ({
    username: user?.username || "",
    slug: user?.slug || "",
    avatar: null,
    description: user?.description || "",
    social_links: user?.social_links || getEmptySocialLinks(),
});

const getSettingsSnapshot = (data) => ({
    username: (data?.username || "").trim(),
    slug: (data?.slug || "").trim().toLowerCase(),
    description: data?.description || "",
    social_links: {
        youtube: (data?.social_links?.youtube || "").trim(),
        telegram: (data?.social_links?.telegram || "").trim(),
        x: (data?.social_links?.x || "").trim(),
        discord: (data?.social_links?.discord || "").trim(),
    },
});

const areSnapshotsEqual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export default function SettingsBlogPage({ initialUser = null }) {
    const t = useTranslations("SettingsBlogPage");
    const { isLoggedIn, user, setUser } = useAuth();
    const router = useRouter();
    const effectiveUser = user || initialUser;

    const [formData, setFormData] = useState(() => getInitialFormData(effectiveUser));
    const [savedSettings, setSavedSettings] = useState(() => getSettingsSnapshot(getInitialFormData(effectiveUser)));
    const [isSaving, setIsSaving] = useState(false);

    const [previewAvatar, setPreviewAvatar] = useState(effectiveUser?.avatar || "");
    const avatarInputRef = useRef(null);

    useEffect(() => {
        if(!isLoggedIn && !initialUser) {
            router.push("/403");
        }
    }, [initialUser, isLoggedIn, router]);

    useEffect(() => {
        if(!effectiveUser) {
            return;
        }

        setFormData(getInitialFormData(effectiveUser));
        setSavedSettings(getSettingsSnapshot(getInitialFormData(effectiveUser)));
        setPreviewAvatar(effectiveUser.avatar || "");
    }, [effectiveUser]);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        if(name.startsWith("social_links.")) {
            const socialKey = name.split(".")[1];
            setFormData((prev) => ({
                ...prev,
                social_links: { ...prev.social_links, [socialKey]: value },
            }));
        } else if(name === "slug") {
            setFormData((prev) => ({ ...prev, slug: normalizeSlugInput(value) }));
        } else {
            setFormData((prev) => ({ ...prev, [name]: value }));
        }
    };

    const handleFileChange = (e) => {
        const { name, files } = e.target;
        const file = files[0];

        if(file && file.size > 20 * 1024 * 1024) {
            toast.error(t("errors.fileTooLarge"));
            return;
        }

        setFormData((prev) => ({ ...prev, [name]: file }));

        const previewUrl = URL.createObjectURL(file);
        if(name === "avatar") {
            setPreviewAvatar(previewUrl);
        }
    };

    const handleSubmit = async (e) => {
        if(e) {
            e.preventDefault();
        }

        if(isSaving) {
            return;
        }

        const validation = validateSlug(formData.slug, { currentSlug: savedSettings.slug || effectiveUser?.slug || "" });
        if(!validation.valid) {
            toast.error(t(`slug.errors.${validation.reason}`));
            return;
        }

        const data = new FormData();
        data.append("username", formData.username);
        data.append("slug", validation.normalized);

        if(formData.avatar) {
            data.append("avatar", formData.avatar);
        }

        data.append("description", formData.description);
        data.append("social_links", JSON.stringify(formData.social_links));

        try {
            setIsSaving(true);
            const res = await axios.put(`${process.env.NEXT_PUBLIC_API_BASE}/users/me`, data, {
                headers: { Authorization: `Bearer ${localStorage.getItem("authToken")}` },
            });

            setUser(res.data);
            setSavedSettings(getSettingsSnapshot(formData));
            toast.success(t("success"));
        } catch (err) {
            toast.error(err.response?.data?.code ? t(`slug.errors.${err.response.data.code}`) : t("errors.generic"));
        } finally {
            setIsSaving(false);
        }
    };

    const handleAvatarOverlayClick = () => {
        avatarInputRef.current?.click();
    };

    if(!isLoggedIn && !effectiveUser) {
        return null;
    }

    const isTextSettingsDirty = !areSnapshotsEqual(getSettingsSnapshot(formData), savedSettings);
    const isAvatarDirty = !!formData.avatar;
    const isDirty = isTextSettingsDirty || isAvatarDirty;

    const handleReset = () => {
        setFormData((prev) => ({
            ...prev,
            ...savedSettings,
            social_links: { ...savedSettings.social_links },
            avatar: null,
        }));
        setPreviewAvatar(effectiveUser?.avatar || "");
    };

    return (
        <>
            <form className="settings-wrapper blog-settings settings-wrapper--narrow" onSubmit={handleSubmit}>
                <div className="blog-settings__body">
                    <div className="subsite-header">
                        <div className="subsite-avatar subsite-header__avatar">
                            <div className="andropov-media andropov-media--rounded andropov-media--bordered andropov-media--has-preview subsite-avatar__image andropov-image andropov-image--zoom" style={{ aspectRatio: "1 / 1", width: "90px", height: "90px", maxWidth: "none", "--background-color": "#30382d" }} data-loaded="true">
                                {previewAvatar && <img id="create_image_url_avatar" src={previewAvatar} alt={t("avatarPreviewAlt")} />}
                            </div>

                            <div className="subsite-avatar__overlay" onClick={handleAvatarOverlayClick} aria-label={t("uploadAvatar")}>
                                <svg className="icon icon--image" width="40" height="40" viewBox="0 0 24 24">
                                    <path d="M8 9.5a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0Z"></path>
                                    <path fillRule="evenodd" clipRule="evenodd" d="M7 3a4 4 0 0 0-4 4v10a4 4 0 0 0 4 4h10a4 4 0 0 0 4-4V7a4 4 0 0 0-4-4H7ZM5 7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v5.252l-1.478-1.477a2 2 0 0 0-3.014.214L8.5 19H7a2 2 0 0 1-2-2V7Zm11.108 5.19L19 15.08V17a2 2 0 0 1-2 2h-6l5.108-6.81Z"></path>
                                </svg>
                            </div>
                        </div>
                    </div>

                    <input type="file" id="avatar" name="avatar" accept="image/jpeg,image/png,image/gif" onChange={handleFileChange} ref={avatarInputRef} style={{ display: "none" }} />

                    <p className="blog-settings__field-title">{t("username")}</p>
                    <div className="field field--default blog-settings__input">
                        <label style={{ marginBottom: "10px" }} className="field__wrapper">
                            <input type="text" name="username" value={formData.username} onChange={handleInputChange} placeholder={t("placeholders.username")} className="text-input" maxLength="30" />
                            <div className="counter">{formData.username.length}</div>
                        </label>
                    </div>

                    <p className="blog-settings__field-title">{t("slug.label")}</p>
                    <div className="field field--default blog-settings__input">
                        <label style={{ marginBottom: "10px" }} className="field__wrapper">
                            <input type="text" name="slug" value={formData.slug} onChange={handleInputChange} placeholder={t("slug.placeholder")} className="text-input" maxLength={SLUG_MAX_LENGTH} />
                            <div className="counter">{formData.slug.length}/{SLUG_MAX_LENGTH}</div>
                        </label>
                    </div>

                    <p className="blog-settings__field-title">{t("description")}</p>
                    <div className="field field--default textarea blog-settings__input">
                        <label style={{ marginBottom: "10px" }} className="field__wrapper">
                            <textarea name="description" value={formData.description} onChange={handleInputChange} placeholder={t("placeholders.description")} className="autosize textarea__input" style={{ height: "256px" }} />
                        </label>
                    </div>

                    <p className="blog-settings__field-title">{t("socialNetworks")}</p>
                    <div className="field field--default blog-settings__input">
                        <label style={{ marginBottom: "10px" }} className="field__wrapper">
                            <input type="text" name="social_links.youtube" value={formData.social_links.youtube} onChange={handleInputChange} placeholder={t("placeholders.youtube")} className="text-input" />
                        </label>
                    </div>

                    <div className="field field--default blog-settings__input">
                        <label style={{ marginBottom: "10px" }} className="field__wrapper">
                            <input type="text" name="social_links.telegram" value={formData.social_links.telegram} onChange={handleInputChange} placeholder={t("placeholders.telegram")} className="text-input" />
                        </label>
                    </div>

                    <div className="field field--default blog-settings__input">
                        <label style={{ marginBottom: "10px" }} className="field__wrapper">
                            <input type="text" name="social_links.x" value={formData.social_links.x} onChange={handleInputChange} placeholder={t("placeholders.x")} className="text-input" />
                        </label>
                    </div>

                    <div className="field field--default blog-settings__input">
                        <label style={{ marginBottom: "10px" }} className="field__wrapper">
                            <input type="text" name="social_links.discord" value={formData.social_links.discord} onChange={handleInputChange} placeholder={t("placeholders.discord")} className="text-input" />
                        </label>
                    </div>
                </div>
            </form>

            <UnsavedChangesBar
                isDirty={isDirty}
                isSaving={isSaving}
                onSave={handleSubmit}
                onReset={handleReset}
                saveLabel={t("save")}
                resetLabel={t("unsavedBar.reset")}
                message={t("unsavedBar.message")}
            />
        </>
    );
}