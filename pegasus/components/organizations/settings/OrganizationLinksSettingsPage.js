"use client";

import { useState } from "react";
import { toast } from "react-toastify";
import { useTranslations } from "next-intl";
import UnsavedChangesBar from "@/components/ui/UnsavedChangesBar";
import OrganizationSettingsSidebar from "@/components/organizations/settings/OrganizationSettingsSidebar";

export default function OrganizationLinksSettingsPage({ authToken, organization }) {
    const tLinks = useTranslations("Organizations.settings.links");
    const tUnsaved = useTranslations("SettingsProjectPage.unsavedBar");
    const initialFormData = {
        discord_url: organization?.discord_url || "",
        website_url: organization?.website_url || "",
        twitter_url: organization?.twitter_url || "",
        bluesky_url: organization?.bluesky_url || "",
        telegram_url: organization?.telegram_url || "",
        youtube_url: organization?.youtube_url || "",
    };

    const [formData, setFormData] = useState(initialFormData);
    const [savedFormData, setSavedFormData] = useState(initialFormData);
    const [isSaving, setIsSaving] = useState(false);
    const isDirty = JSON.stringify(formData) !== JSON.stringify(savedFormData);

    const handleSubmit = async (event) => {
        if(event) {
            event.preventDefault();
        }

        if(isSaving || !isDirty) {
            return;
        }

        setIsSaving(true);

        try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE}/organizations/${organization.slug}/links`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${authToken}`,
                },
                body: JSON.stringify(formData),
            });

            if(response.ok) {
                setSavedFormData({ ...formData });
                toast.success(tLinks("success"));
            } else {
                const data = await response.json().catch(() => null);
                toast.error(data?.message || tLinks("errors.save"));
            }
        } catch (error) {
            toast.error(tLinks("errors.save"));
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="layout">
            <div className="page-content settings-page">
                <OrganizationSettingsSidebar organization={organization} />

                <div className="settings-wrapper settings-wrapper--narrow" style={{ width: "100%" }}>
                    <div className="settings-content">
                        <form onSubmit={handleSubmit}>
                            <div className="blog-settings">
                                <div className="blog-settings__body">
                                    <p className="blog-settings__field-title">{tLinks("fields.discord")}</p>
                                    <div className="field field--default blog-settings__input">
                                        <label style={{ marginBottom: "10px" }} className="field__wrapper">
                                            <input
                                                type="url"
                                                name="discord_url"
                                                value={formData.discord_url}
                                                onChange={(event) => setFormData({ ...formData, discord_url: event.target.value })}
                                                placeholder={tLinks("placeholders.discord")}
                                                className="text-input"
                                            />
                                        </label>
                                    </div>

                                    <p className="blog-settings__field-title">{tLinks("fields.website")}</p>
                                    <div className="field field--default blog-settings__input">
                                        <label style={{ marginBottom: "10px" }} className="field__wrapper">
                                            <input
                                                type="url"
                                                name="website_url"
                                                value={formData.website_url}
                                                onChange={(event) => setFormData({ ...formData, website_url: event.target.value })}
                                                placeholder={tLinks("placeholders.website")}
                                                className="text-input"
                                            />
                                        </label>
                                    </div>

                                    <p className="blog-settings__field-title">{tLinks("fields.twitter")}</p>
                                    <div className="field field--default blog-settings__input">
                                        <label style={{ marginBottom: "10px" }} className="field__wrapper">
                                            <input
                                                type="url"
                                                name="twitter_url"
                                                value={formData.twitter_url}
                                                onChange={(event) => setFormData({ ...formData, twitter_url: event.target.value })}
                                                placeholder={tLinks("placeholders.twitter")}
                                                className="text-input"
                                            />
                                        </label>
                                    </div>

                                    <p className="blog-settings__field-title">{tLinks("fields.bluesky")}</p>
                                    <div className="field field--default blog-settings__input">
                                        <label style={{ marginBottom: "10px" }} className="field__wrapper">
                                            <input
                                                type="url"
                                                name="bluesky_url"
                                                value={formData.bluesky_url}
                                                onChange={(event) => setFormData({ ...formData, bluesky_url: event.target.value })}
                                                placeholder={tLinks("placeholders.bluesky")}
                                                className="text-input"
                                            />
                                        </label>
                                    </div>

                                    <p className="blog-settings__field-title">{tLinks("fields.telegram")}</p>
                                    <div className="field field--default blog-settings__input">
                                        <label style={{ marginBottom: "10px" }} className="field__wrapper">
                                            <input
                                                type="url"
                                                name="telegram_url"
                                                value={formData.telegram_url}
                                                onChange={(event) => setFormData({ ...formData, telegram_url: event.target.value })}
                                                placeholder={tLinks("placeholders.telegram")}
                                                className="text-input"
                                            />
                                        </label>
                                    </div>

                                    <p className="blog-settings__field-title">{tLinks("fields.youtube")}</p>
                                    <div className="field field--default blog-settings__input">
                                        <label style={{ marginBottom: "10px" }} className="field__wrapper">
                                            <input
                                                type="url"
                                                name="youtube_url"
                                                value={formData.youtube_url}
                                                onChange={(event) => setFormData({ ...formData, youtube_url: event.target.value })}
                                                placeholder={tLinks("placeholders.youtube")}
                                                className="text-input"
                                            />
                                        </label>
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
                    onReset={() => setFormData({ ...savedFormData })}
                    saveLabel={tLinks("actions.save")}
                    resetLabel={tUnsaved("reset")}
                    message={tUnsaved("message")}
                />
            </div>
        </div>
    );
}