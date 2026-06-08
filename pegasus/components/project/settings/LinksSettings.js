"use client";

import React, { useState } from "react";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useTranslations } from "next-intl";
import UnsavedChangesBar from "@/components/ui/UnsavedChangesBar";

export default function LinksSettings({ project, authToken }) {
    const t = useTranslations("SettingsProjectPage");
    const initialFormData = {
        issue_url: project.issue_url || "",
        source_url: project.source_url || "",
        wiki_url: project.wiki_url || "",
        discord_url: project.discord_url || "",
        hytale_wiki_slug: project.hytale_wiki_slug || "",
    };

    const [formData, setFormData] = useState(initialFormData);
    const [savedFormData, setSavedFormData] = useState(initialFormData);
    const [isSaving, setIsSaving] = useState(false);
    const isDirty = JSON.stringify(formData) !== JSON.stringify(savedFormData);

    const handleSubmit = async (e) => {
        if(e) {
            e.preventDefault();
        }

        if(isSaving || !isDirty) {
            return;
        }

        setIsSaving(true);

        try {
            const hytaleWikiSlug = (formData.hytale_wiki_slug || "").trim();
            const payload = {
                ...formData,
                hytale_wiki_url: hytaleWikiSlug ? `https://wiki.hytalemodding.dev/mod/${hytaleWikiSlug}` : "",
            };
            delete payload.hytale_wiki_slug;

            const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE}/projects/${project.slug}/links`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${authToken}`,
                },
                body: JSON.stringify(payload),
            });

            if(response.ok) {
                setSavedFormData({ ...formData });
                toast.success(t("links.success"));
            } else {
                const data = await response.json().catch(() => null);
                toast.error(data?.message || t("links.errors.save"));
            }
        } catch (err) {
            toast.error(t("links.errors.save"));
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <>
            <div className="settings-wrapper settings-wrapper--narrow">
                <div className="settings-content">
                    <form onSubmit={handleSubmit}>
                        <div className="blog-settings">
                            <div className="blog-settings__body">
                                <p className="blog-settings__field-title">{t("links.fields.issueTracker")}</p>
                                <div className="field field--default">
                                    <label style={{ marginBottom: "10px" }} className="field__wrapper">
                                        <input
                                            type="url"
                                            name="issue_url"
                                            value={formData.issue_url}
                                            onChange={(e) => setFormData({ ...formData, issue_url: e.target.value })}
                                            placeholder={t("links.placeholders.issueTracker")}
                                            className="text-input"
                                        />
                                    </label>
                                </div>

                                <p className="blog-settings__field-title">{t("links.fields.sourceCode")}</p>
                                <div className="field field--default">
                                    <label style={{ marginBottom: "10px" }} className="field__wrapper">
                                        <input
                                            type="url"
                                            name="source_url"
                                            value={formData.source_url}
                                            onChange={(e) => setFormData({ ...formData, source_url: e.target.value })}
                                            placeholder={t("links.placeholders.sourceCode")}
                                            className="text-input"
                                        />
                                    </label>
                                </div>

                                <p className="blog-settings__field-title">{t("links.fields.wiki")}</p>
                                <div className="field field--default">
                                    <label style={{ marginBottom: "10px" }} className="field__wrapper">
                                        <input
                                            type="url"
                                            name="wiki_url"
                                            value={formData.wiki_url}
                                            onChange={(e) => setFormData({ ...formData, wiki_url: e.target.value })}
                                            placeholder={t("links.placeholders.wiki")}
                                            className="text-input"
                                        />
                                    </label>
                                </div>

                                <p className="blog-settings__field-title">{t("links.fields.hytaleModdingWiki")}</p>
                                <div className="field field--default">
                                    <label style={{ marginBottom: "10px" }} className="field__wrapper">
                                        <span style={{ whiteSpace: "nowrap", flexShrink: 1, textOverflow: "ellipsis", color: "var(--theme-color-text-secondary)" }}>
                                            /mod/
                                        </span>

                                        <input
                                            type="text"
                                            name="hytale_wiki_slug"
                                            value={formData.hytale_wiki_slug}
                                            onChange={(e) => setFormData({ ...formData, hytale_wiki_slug: e.target.value })}
                                            placeholder="voile"
                                            className="text-input"
                                            style={{ minWidth: 0 }}
                                        />
                                    </label>
                                </div>

                                <p className="blog-settings__field-title">{t("links.fields.discord")}</p>
                                <div className="field field--default">
                                    <label style={{ marginBottom: "10px" }} className="field__wrapper">
                                        <input
                                            type="url"
                                            name="discord_url"
                                            value={formData.discord_url}
                                            onChange={(e) => setFormData({ ...formData, discord_url: e.target.value })}
                                            placeholder={t("links.placeholders.discord")}
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
                saveLabel={t("links.actions.save")}
                resetLabel={t("unsavedBar.reset")}
                message={t("unsavedBar.message")}
            />
        </>
    );
}