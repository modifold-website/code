"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { toast } from "react-toastify";
import IssueLabelModal from "@/modal/IssueLabelModal";
import { getProjectPath } from "@/utils/projectRoutes";

const applyLabelStyle = (label) => ({
    background: `${label.color}22`,
    color: label.color,
    border: `1px solid ${label.color}44`,
});

export default function IssuesSettings({ project, authToken, initialTemplates = [], initialLabels = [] }) {
    const t = useTranslations("IssueSettings");
    const [templates, setTemplates] = useState(initialTemplates);
    const [labels, setLabels] = useState(initialLabels);
    const [activeLabel, setActiveLabel] = useState(null);
    const [isLabelModalOpen, setIsLabelModalOpen] = useState(false);
    const [isLabelSaving, setIsLabelSaving] = useState(false);
    const [openLabelActionsId, setOpenLabelActionsId] = useState(null);

    const sortedLabels = useMemo(() => {
        return [...labels].sort((a, b) => a.name.localeCompare(b.name));
    }, [labels]);

    useEffect(() => {
        if(!openLabelActionsId) {
            return undefined;
        }

        const handleOutsideClick = (event) => {
            const target = event.target;
            if(target instanceof Element && target.closest('[data-label-actions="true"]')) {
                return;
            }

            setOpenLabelActionsId(null);
        };

        document.addEventListener("mousedown", handleOutsideClick);
        return () => document.removeEventListener("mousedown", handleOutsideClick);
    }, [openLabelActionsId]);

    const openLabelModal = (label = null) => {
        setActiveLabel(label);
        setIsLabelModalOpen(true);
    };

    const handleTemplateDelete = async (templateId) => {
        if(!confirm(t("template.deleteConfirm"))) {
            return;
        }

        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE}/projects/${project.slug}/issues/templates/${templateId}`, {
                method: "DELETE",
                headers: {
                    Authorization: `Bearer ${authToken}`,
                },
            });

            if(!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.message || "Failed");
            }

            setTemplates((prev) => prev.filter((item) => item.id !== templateId));
            toast.success(t("template.deleted"));
        } catch (error) {
            toast.error(error.message || t("errors.templateDelete"));
        }
    };

    const handleLabelSave = async (payload) => {
        const isEdit = Boolean(payload.id);
        const url = isEdit ? `${process.env.NEXT_PUBLIC_API_BASE}/projects/${project.slug}/issues/labels/${payload.id}` : `${process.env.NEXT_PUBLIC_API_BASE}/projects/${project.slug}/issues/labels`;

        try {
            setIsLabelSaving(true);
            const res = await fetch(url, {
                method: isEdit ? "PATCH" : "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${authToken}`,
                },
                body: JSON.stringify(payload),
            });

            if(!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.message || "Failed");
            }

            if(isEdit) {
                setLabels((prev) => prev.map((item) => (item.id === payload.id ? { ...item, ...payload } : item)));
            } else {
                const data = await res.json();
                setLabels((prev) => [...prev, data]);
            }

            toast.success(t("labels.saved"));
            setIsLabelModalOpen(false);
        } catch (error) {
            toast.error(error.message || t("errors.labelSave"));
        } finally {
            setIsLabelSaving(false);
        }
    };

    const handleLabelDelete = async (labelId) => {
        if(!confirm(t("labels.deleteConfirm"))) {
            return;
        }

        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE}/projects/${project.slug}/issues/labels/${labelId}`, {
                method: "DELETE",
                headers: {
                    Authorization: `Bearer ${authToken}`,
                },
            });

            if(!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.message || "Failed");
            }

            setLabels((prev) => prev.filter((item) => item.id !== labelId));
            toast.success(t("labels.deleted"));
        } catch (error) {
            toast.error(error.message || t("errors.labelDelete"));
        }
    };

    return (
        <div className="settings-wrapper settings-wrapper--narrow">
            <div className="settings-content">
                <div className="blog-settings">
                    <div className="blog-settings__body">
                        <p className="blog-settings__field-title">{t("overview.title")}</p>
                        <p>{t("overview.body")}</p>
                    </div>
                </div>

                <div className="blog-settings">
                    <div className="blog-settings__body">
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
                            <p className="blog-settings__field-title" style={{ marginBottom: "0" }}>{t("template.sectionTitle")}</p>
                            
                            <Link className="button button--size-m button--type-minimal button--active-transform" href={getProjectPath(project, "/settings/issues/templates/new")}>
                                {t("template.create")}
                            </Link>
                        </div>

                        <div className="issue-template-list" style={{ marginTop: "12px" }}>
                            {templates.length === 0 && (
                                <div className="issues-empty">{t("template.empty")}</div>
                            )}

                            {templates.map((template) => (
                                <div key={template.id} className="issue-template-card">
                                    <div className="issue-template-card__info">
                                        <p className="issue-template-card__title">{template.name}</p>
                                        <p className="issue-template-card__meta">{template.description || t("template.noDescription")}</p>
                                    </div>

                                    <div style={{ display: "flex", gap: "8px" }}>
                                        <Link className="button button--size-m button--type-secondary button--active-transform" href={getProjectPath(project, `/settings/issues/templates/${template.id}`)}>
                                            {t("template.edit")}
                                        </Link>

                                        <button className="button button--size-m button--type-danger button--icon-only button--active-transform" onClick={() => handleTemplateDelete(template.id)}>
                                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"></path>
                                                <path d="M3 6h18"></path>
                                                <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="blog-settings">
                    <div className="blog-settings__body">
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
                            <p className="blog-settings__field-title" style={{ marginBottom: "0" }}>{t("labels.sectionTitle")}</p>
                            
                            <button className="button button--size-m button--type-minimal button--active-transform" onClick={() => openLabelModal()}>
                                {t("labels.create")}
                            </button>
                        </div>

                        <div  style={{ display: "flex", marginTop: "16px", gap: "12px", flexDirection: "column", justifyContent: "center" }}>
                            {sortedLabels.length === 0 && (
                                <div className="issues-empty" style={{ width: "100%" }}>{t("labels.empty")}</div>
                            )}

                            {sortedLabels.map((label) => (
                                <div key={label.id} className="issue-label-card">
                                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                                        <div className="issue-label-chip" style={applyLabelStyle(label)}>
                                            <span>{label.name}</span>
                                        </div>
                                    </div>

                                    <div className="issue-label-actions" data-label-actions="true">
                                        <button className="icon-button" type="button" onClick={() => setOpenLabelActionsId((prev) => (prev === label.id ? null : label.id))} aria-label={t("labels.edit")} title={t("labels.edit")} aria-expanded={openLabelActionsId === label.id}>
                                            <svg style={{ fill: "none" }} xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915"/>
                                                <circle cx="12" cy="12" r="3"/>
                                            </svg>
                                        </button>

                                        {openLabelActionsId === label.id && (
                                            <div id="popover-overlay" className="popover-overlay version-actions__overlay" onClick={() => setOpenLabelActionsId(null)}>
                                                <div className="popover" tabIndex={0} style={{ "--width": "max-content", "--top": "30px", "--position": "absolute", "--left": "auto", "--right": "0", "--bottom": "auto", "--distance": "8px" }} onClick={(event) => event.stopPropagation()}>
                                                    <div className="popover__scrollable" style={{ "--max-height": "auto" }}>
                                                        <button style={{ width: "100%" }} type="button" className="context-list-option context-list-option--with-art" onClick={() => { setOpenLabelActionsId(null); openLabelModal(label); }}>
                                                            <div className="context-list-option__art context-list-option__art--icon">
                                                                <svg style={{ fill: "none" }} xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                    <path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/>
                                                                    <path d="m15 5 4 4"/>
                                                                </svg>
                                                            </div>
                                                            
                                                            <div className="context-list-option__label">{t("labels.edit")}</div>
                                                        </button>

                                                        <button style={{ width: "100%" }} type="button" className="context-list-option context-list-option--with-art color--negative" onClick={() => { setOpenLabelActionsId(null); handleLabelDelete(label.id); }}>
                                                            <div className="context-list-option__art context-list-option__art--icon">
                                                                <svg style={{ fill: "none" }} xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"></path>
                                                                    <path d="M3 6h18"></path>
                                                                    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                                                </svg>
                                                            </div>

                                                            <div className="context-list-option__label">{t("labels.delete")}</div>
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            <IssueLabelModal
                isOpen={isLabelModalOpen}
                label={activeLabel}
                onSubmit={handleLabelSave}
                onRequestClose={() => setIsLabelModalOpen(false)}
                isSubmitting={isLabelSaving}
            />
        </div>
    );
}