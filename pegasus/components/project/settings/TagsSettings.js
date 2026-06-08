"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useTranslations } from "next-intl";
import UnsavedChangesBar from "@/components/ui/UnsavedChangesBar";
import { getCategoryLabel } from "@/utils/categoryLabels";

const normalizeTags = (tags) => tags.map((tag) => (typeof tag === "string" ? { name: tag } : tag)).filter((tag) => tag && typeof tag.name === "string");

export default function TagsSettings({ project, authToken, availableTags = [] }) {
    const t = useTranslations("SettingsProjectPage");
    const tLabels = useTranslations("CategoryLabels");
    const { slug } = useParams();

    const initialTags = project.tags ? project.tags.split(",") : [];
    const [selectedTags, setSelectedTags] = useState(initialTags);
    const [savedTags, setSavedTags] = useState(initialTags);
    const [isSaving, setIsSaving] = useState(false);
    const [tagOptions, setTagOptions] = useState(() => normalizeTags(availableTags));
    const isDirty = JSON.stringify(selectedTags) !== JSON.stringify(savedTags);

    useEffect(() => {
        if(tagOptions.length > 0 || !project?.project_type) {
            return;
        }

        const controller = new AbortController();
        const fetchTags = async () => {
            try {
                const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE}/tags/${project.project_type}`, {
                    signal: controller.signal,
                });
                if(response.ok) {
                    const data = await response.json();
                    const normalized = normalizeTags(Array.isArray(data?.tags) ? data.tags : []);
                    setTagOptions(normalized);
                }
            } catch (err) {
                if(!controller.signal.aborted) {
                    console.error("Error fetching tags:", err);
                }
            }
        };

        fetchTags();

        return () => controller.abort();
    }, [project?.project_type, tagOptions.length]);

    const handleToggleTag = (tag) => {
        setSelectedTags((prev) => {
            if(prev.includes(tag)) {
                return prev.filter((t) => t !== tag);
            }

            return [...prev, tag];
        });
    };

    const handleSubmit = async (e) => {
        if(e) {
            e.preventDefault();
        }

        if(isSaving || !isDirty) {
            return;
        }

        setIsSaving(true);

        try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE}/projects/${slug}/tags`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${authToken}`,
                },
                body: JSON.stringify({ tags: selectedTags }),
            });

            if(response.ok) {
                setSavedTags([...selectedTags]);
                toast.success(t("tags.success"));
            } else {
                toast.error(t("tags.errors.save"));
            }
        } catch (err) {
            console.error("Error updating tags:", err);
            toast.error(t("tags.errors.save"));
        } finally {
            setIsSaving(false);
        }
    };

    const getTagLabel = (tag) => getCategoryLabel(tLabels, tag);

    const selectionLabel = selectedTags.length > 0 ? t("tags.selected", { count: selectedTags.length }) : t("tags.select");
    const tagIconByName = tagOptions.reduce((acc, tag) => {
        if(tag?.name && tag.icon) {
            acc[tag.name] = tag.icon;
        }
        return acc;
    }, {});

    return (
        <>
            <div className="settings-wrapper settings-wrapper--narrow">
                <div className="settings-content">
                    <div className="blog-settings">
                        <div className="blog-settings__body">
                            <p className="blog-settings__field-title">{t("tags.title")}</p>
                            <form onSubmit={handleSubmit}>
                                <div className="tag-selector">
                                    <p style={{ color: "var(--theme-color-text-secondary)" }}>{selectionLabel}</p>

                                    <div className="tag-selector__list">
                                        {tagOptions.map((tag) => {
                                            const isSelected = selectedTags.includes(tag.name);
                                            return (
                                                <button key={tag.name} type="button" className={`button button--size-m ${isSelected ? "button--type-primary" : "button--type-minimal"} tag-selector__button`} onClick={() => handleToggleTag(tag.name)}>
                                                    {tag.icon && (
                                                        <span className="tag-selector__icon" aria-hidden="true" dangerouslySetInnerHTML={{ __html: tag.icon }} />
                                                    )}

                                                    <span className="tag-selector__label">{getTagLabel(tag.name)}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                <button type="button" className="button button--size-m button--type-minimal" style={{ marginTop: "18px" }} onClick={() => setSelectedTags([])}>
                                    {t("tags.actions.clear")}
                                </button>
                            </form>

                            <p className="blog-settings__field-title">{t("tags.current")}</p>
                            <div className="tags-list">
                                {selectedTags.length > 0 ? (
                                    selectedTags.map((tag) => (
                                        <div key={tag} className="button button--size-m button--type-minimal tag-selector__button">
                                            {tagIconByName[tag] && (
                                                <span className="tag-selector__icon" aria-hidden="true" dangerouslySetInnerHTML={{ __html: tagIconByName[tag] }} />
                                            )}
                                            <span className="tag-selector__label">{getTagLabel(tag)}</span>
                                        </div>
                                    ))
                                ) : (
                                    <p>{t("tags.none")}</p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <UnsavedChangesBar
                isDirty={isDirty}
                isSaving={isSaving}
                onSave={handleSubmit}
                onReset={() => {
                    setSelectedTags([...savedTags]);
                }}
                saveLabel={t("tags.actions.save")}
                resetLabel={t("unsavedBar.reset")}
                message={t("unsavedBar.message")}
            />
        </>
    );
}