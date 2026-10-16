"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "react-toastify";
import { useAuth } from "../providers/AuthProvider";
import ProjectSidebar from "@/components/project/ProjectSidebar";
import { getProjectBasePath } from "@/utils/projectRoutes";
import { DescriptionMarkdownEditor } from "@/components/project/settings/DescriptionSettings";

export default function IssueCreatePage({ project, authToken, template, labels = [] }) {
    const t = useTranslations("Issues");
    const router = useRouter();
    const { isLoggedIn } = useAuth();

    const [title, setTitle] = useState("");
    const [body, setBody] = useState(template?.content || "");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [selectedLabelIds, setSelectedLabelIds] = useState([]);

    const basePath = getProjectBasePath(project.project_type);
    const templateId = template?.id || null;
    const templateLabelIds = Array.isArray(template?.default_labels) ? [...new Set(
        template.default_labels.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0)
    )] : [];
    const labelIdsSet = new Set(labels.map((label) => Number(label.id)).filter((id) => Number.isInteger(id) && id > 0));

    useEffect(() => {
        setTitle("");
        setBody(template?.content || "");
        setSelectedLabelIds(templateLabelIds.filter((id) => labelIdsSet.has(id)));
    }, [template?.id]);

    const handleToggleLabel = (labelId) => {
        setSelectedLabelIds((prev) => {
            if(prev.includes(labelId)) {
                return prev.filter((item) => item !== labelId);
            }

            return [...prev, labelId];
        });
    };


    const handleSubmit = async (event) => {
        event.preventDefault();

        if(!isLoggedIn) {
            toast.error(t("newIssue.loginRequired"));
            return;
        }

        if(!title.trim()) {
            toast.error(t("newIssue.titleRequired"));
            return;
        }

        try {
            setIsSubmitting(true);

            const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE}/projects/${project.slug}/issues`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: authToken ? `Bearer ${authToken}` : `Bearer ${localStorage.getItem("authToken")}`,
                },
                body: JSON.stringify({ title, body, template_id: templateId, label_ids: selectedLabelIds }),
            });

            if(!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.message || "Failed");
            }

            const data = await res.json();
            router.push(`${basePath}/${project.slug}/issues/${data.id}`);
        } catch (error) {
            toast.error(error.message || t("newIssue.createError"));
        } finally {
            setIsSubmitting(false);
        }
    };

    const headerTitle = template?.name ? t("newIssue.createWith", { name: template.name }) : t("newIssue.createTitle");
    const titlePlaceholder = template?.title_placeholder || t("newIssue.titlePlaceholder");
    const isSubmitDisabled = isSubmitting || !title.trim();


    return (
        <div className="project__general">
            <div className="issues-page">
                <div className="content content--padding issues-header">
                    <div className="issues-title-row">
                        <h1>{headerTitle}</h1>
                    </div>
                </div>

                <div className="content content--padding">
                    <form onSubmit={handleSubmit}>
                        <p className="blog-settings__field-title">{t("newIssue.titleLabel")}</p>
                        <div className="field field--default">
                            <label className="field__wrapper">
                                <input
                                    className="text-input"
                                    value={title}
                                    onChange={(event) => setTitle(event.target.value)}
                                    placeholder={titlePlaceholder}
                                    required
                                    maxLength={120}
                                />
                            </label>
                        </div>

                        {labels.length > 0 && (
                            <>
                                <p className="blog-settings__field-title">{t("newIssue.labelsTitle")}</p>
                                <div className="issue-label-grid">
                                    {labels.map((label) => {
                                        const labelId = Number(label.id);
                                        const isSelected = selectedLabelIds.includes(labelId);

                                        return (
                                            <button key={label.id} type="button" className={`issue-label-chip issue-label-chip--selectable ${isSelected ? "is-selected" : ""}`} onClick={() => handleToggleLabel(labelId)}>
                                                <span className="issue-label-chip__color" style={{ background: label.color }}></span>
                                                <span>{label.name}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </>
                        )}

                        <p className="blog-settings__field-title">{t("newIssue.bodyLabel")}</p>
						<DescriptionMarkdownEditor
							key={templateId || "blank"}
							project={project}
							authToken={authToken}
							value={body}
							onChange={setBody}
							disabled={isSubmitting}
							hint={t("newIssue.markdownHint")}
							label={t("newIssue.bodyLabel")}
							placeholder={t("newIssue.bodyPlaceholder")}
							imageContext="issue"
						/>

                        <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "16px" }}>
                            <button type="submit" className="button button--size-m button--type-primary" disabled={isSubmitDisabled}>
                                {isSubmitting ? t("common.creating") : t("newIssue.createButton")}
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            <ProjectSidebar project={project} authToken={authToken} showLicense={true} showLinks={true} />
        </div>
    );
}