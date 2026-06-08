"use client";

import React, { useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import { getSafeMarkdownHref, getSafeMarkdownImageSrc, prepareProjectDescriptionMarkdown } from "@/utils/projectDescriptionContent";
import { getProjectPath } from "@/utils/projectRoutes";

export default function IssueTemplateEditorPage({ project, authToken, labels = [], template = null }) {
    const t = useTranslations("IssueSettings");
    const tSettings = useTranslations("SettingsProjectPage");
    const router = useRouter();
    const isEdit = Boolean(template?.id);
    const textareaRef = useRef(null);

    const [name, setName] = useState(template?.name || "");
    const [description, setDescription] = useState(template?.description || "");
    const [content, setContent] = useState(template?.content || "");
    const [isPreviewVisible, setIsPreviewVisible] = useState(false);
    const [titlePlaceholder, setTitlePlaceholder] = useState(template?.title_placeholder || "");
    const [selectedLabels, setSelectedLabels] = useState(Array.isArray(template?.default_labels) ? template.default_labels : []);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const resizeTextarea = () => {
        const textarea = textareaRef.current;
        if(!textarea) {
            return;
        }

        textarea.style.height = "auto";
        textarea.style.height = `${Math.max(textarea.scrollHeight, 260)}px`;
    };

    const updateTextareaValue = (nextValue, selectionStart, selectionEnd) => {
        setContent(nextValue);

        requestAnimationFrame(() => {
            if(!textareaRef.current) {
                return;
            }

            resizeTextarea();
            textareaRef.current.focus();
            if(typeof selectionStart === "number" && typeof selectionEnd === "number") {
                textareaRef.current.setSelectionRange(selectionStart, selectionEnd);
            }
        });
    };

    const wrapSelection = (prefix, suffix = prefix) => {
        const textarea = textareaRef.current;
        if(!textarea) {
            return;
        }

        const start = textarea.selectionStart ?? 0;
        const end = textarea.selectionEnd ?? 0;
        const selected = content.slice(start, end);
        const nextValue = `${content.slice(0, start)}${prefix}${selected || ""}${suffix}${content.slice(end)}`;
        const caretStart = start + prefix.length;

        if(selected) {
            updateTextareaValue(nextValue, caretStart, caretStart + selected.length);
            return;
        }

        updateTextareaValue(nextValue, caretStart, caretStart);
    };

    const insertAtSelection = (text, selectInserted = false) => {
        const textarea = textareaRef.current;
        if(!textarea) {
            return;
        }

        const start = textarea.selectionStart ?? 0;
        const end = textarea.selectionEnd ?? 0;
        const nextValue = `${content.slice(0, start)}${text}${content.slice(end)}`;
        const caret = start + text.length;
        updateTextareaValue(nextValue, selectInserted ? start : caret, selectInserted ? caret : caret);
    };

    const prefixLines = (prefix) => {
        const textarea = textareaRef.current;
        if(!textarea) {
            return;
        }

        const start = textarea.selectionStart ?? 0;
        const end = textarea.selectionEnd ?? 0;

        if(start === end) {
            insertAtSelection(prefix);
            return;
        }

        const lineStart = content.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
        const selectedText = content.slice(lineStart, end);
        const transformed = selectedText.split("\n").map((line) => (line.trim() ? `${prefix}${line}` : line)).join("\n");
        const nextValue = `${content.slice(0, lineStart)}${transformed}${content.slice(end)}`;
        updateTextareaValue(nextValue, lineStart, lineStart + transformed.length);
    };

    const toggleLabel = (labelId) => {
        setSelectedLabels((prev) => (
            prev.includes(labelId) ? prev.filter((id) => id !== labelId) : [...prev, labelId]
        ));
    };

    const handleCancel = () => {
        router.push(getProjectPath(project, "/settings/issues"));
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        const url = isEdit ? `${process.env.NEXT_PUBLIC_API_BASE}/projects/${project.slug}/issues/templates/${template.id}` : `${process.env.NEXT_PUBLIC_API_BASE}/projects/${project.slug}/issues/templates`;

        try {
            setIsSubmitting(true);

            const res = await fetch(url, {
                method: isEdit ? "PATCH" : "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${authToken}`,
                },
                body: JSON.stringify({
                    id: template?.id || null,
                    name,
                    description,
                    content,
                    title_placeholder: titlePlaceholder,
                    default_labels: selectedLabels,
                }),
            });

            if(!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.message || "Failed");
            }

            toast.success(t("template.saved"));
            router.push(getProjectPath(project, "/settings/issues"));
        } catch (error) {
            toast.error(error.message || t("errors.templateSave"));
        } finally {
            setIsSubmitting(false);
        }
    };

    React.useEffect(() => {
        if(isPreviewVisible) {
            return;
        }

        requestAnimationFrame(() => {
            resizeTextarea();
        });
    }, [content, isPreviewVisible]);

    return (
        <div className="settings-wrapper settings-wrapper--narrow">
            <div className="settings-content">
                <div className="blog-settings">
                    <div className="blog-settings__body">
                        <div className="version-page__breadcrumb">
                            <Link href={getProjectPath(project, "/settings/issues")} className="version-page__back-link button--active-transform">
                                {t("common.backToSettings")}
                            </Link>

                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-chevron-right-icon lucide-chevron-right">
                                <path d="m9 18 6-6-6-6"/>
                            </svg>

                            <span className="version-page__breadcrumb-current">
                                {isEdit ? (template?.name || t("template.editTitle")) : t("template.createTitle")}
                            </span>
                        </div>

                        <form onSubmit={handleSubmit}>
                            <p className="blog-settings__field-title">{t("template.name")}</p>
                            <div className="field field--default">
                                <label className="field__wrapper">
                                    <input type="text" className="text-input" value={name} onChange={(event) => setName(event.target.value)} placeholder={t("template.namePlaceholder")} required maxLength={80} />
                                </label>
                            </div>

                            <p className="blog-settings__field-title">{t("template.about")}</p>
                            <div className="field field--default">
                                <label className="field__wrapper">
                                    <input type="text" className="text-input" value={description} onChange={(event) => setDescription(event.target.value)} placeholder={t("template.aboutPlaceholder")} />
                                </label>
                            </div>

                            <p className="blog-settings__field-title">{t("template.content")}</p>
                            <div className="markdown-editor">
                                <p className="markdown-editor__hint">{t("template.markdownHint")}</p>

                                <div className="markdown-editor__toolbar" role="toolbar" aria-label="Markdown editor toolbar">
                                    <div className="markdown-editor__toolbar-buttons">
                                        <button type="button" className="markdown-editor__tool" onClick={() => prefixLines("# ")} aria-label="Heading 1" title="Heading 1" disabled={isPreviewVisible}>
                                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-heading1-icon lucide-heading-1"><path d="M4 12h8"/><path d="M4 18V6"/><path d="M12 18V6"/><path d="m17 12 3-2v8"/></svg>
                                        </button>

                                        <button type="button" className="markdown-editor__tool" onClick={() => prefixLines("## ")} aria-label="Heading 2" title="Heading 2" disabled={isPreviewVisible}>
                                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-heading2-icon lucide-heading-2"><path d="M4 12h8"/><path d="M4 18V6"/><path d="M12 18V6"/><path d="M21 18h-4c0-4 4-3 4-6 0-1.5-2-2.5-4-1"/></svg>
                                        </button>
                                        
                                        <button type="button" className="markdown-editor__tool" onClick={() => prefixLines("### ")} aria-label="Heading 3" title="Heading 3" disabled={isPreviewVisible}>
                                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-heading3-icon lucide-heading-3"><path d="M4 12h8"/><path d="M4 18V6"/><path d="M12 18V6"/><path d="M17.5 10.5c1.7-1 3.5 0 3.5 1.5a2 2 0 0 1-2 2"/><path d="M17 17.5c2 1.5 4 .3 4-1.5a2 2 0 0 0-2-2"/></svg>
                                        </button>

                                        <button type="button" className="markdown-editor__tool" onClick={() => wrapSelection("**", "**")} aria-label="Bold" title="Bold" disabled={isPreviewVisible}>
                                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-bold-icon lucide-bold"><path d="M6 12h9a4 4 0 0 1 0 8H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h7a4 4 0 0 1 0 8"/></svg>
                                        </button>

                                        <button type="button" className="markdown-editor__tool" onClick={() => wrapSelection("*", "*")} aria-label="Italic" title="Italic" disabled={isPreviewVisible}>
                                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-italic-icon lucide-italic"><line x1="19" x2="10" y1="4" y2="4"/><line x1="14" x2="5" y1="20" y2="20"/><line x1="15" x2="9" y1="4" y2="20"/></svg>
                                        </button>

                                        <button type="button" className="markdown-editor__tool" onClick={() => wrapSelection("~~", "~~")} aria-label="Strikethrough" title="Strikethrough" disabled={isPreviewVisible}>
                                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-strikethrough-icon lucide-strikethrough"><path d="M16 4H9a3 3 0 0 0-2.83 4"/><path d="M14 12a4 4 0 0 1 0 8H6"/><line x1="4" x2="20" y1="12" y2="12"/></svg>
                                        </button>

                                        <button type="button" className="markdown-editor__tool" onClick={() => wrapSelection("`", "`")} aria-label="Code" title="Code" disabled={isPreviewVisible}>
                                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-code-xml-icon lucide-code-xml"><path d="m18 16 4-4-4-4"/><path d="m6 8-4 4 4 4"/><path d="m14.5 4-5 16"/></svg>
                                        </button>

                                        <button type="button" className="markdown-editor__tool" onClick={() => prefixLines("- ")} aria-label="Bulleted list" title="Bulleted list" disabled={isPreviewVisible}>
                                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-list-icon lucide-list"><path d="M3 5h.01"/><path d="M3 12h.01"/><path d="M3 19h.01"/><path d="M8 5h13"/><path d="M8 12h13"/><path d="M8 19h13"/></svg>
                                        </button>

                                        <button type="button" className="markdown-editor__tool" onClick={() => prefixLines("1. ")} aria-label="Ordered list" title="Ordered list" disabled={isPreviewVisible}>
                                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-list-ordered-icon lucide-list-ordered"><path d="M11 5h10"/><path d="M11 12h10"/><path d="M11 19h10"/><path d="M4 4h1v5"/><path d="M4 9h2"/><path d="M6.5 20H3.4c0-1 2.6-1.925 2.6-3.5a1.5 1.5 0 0 0-2.6-1.02"/></svg>
                                        </button>

                                        <button type="button" className="markdown-editor__tool" onClick={() => insertAtSelection("[link text](https://)")} aria-label="Link" title="Link" disabled={isPreviewVisible}>
                                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-link-icon lucide-link"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                                        </button>

                                        <button type="button" className="markdown-editor__tool" onClick={() => insertAtSelection("![alt text](https://)")} aria-label="Image" title="Image" disabled={isPreviewVisible}>
                                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-image-icon lucide-image"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
                                        </button>

                                        <label className="markdown-editor__preview-toggle">
                                            <input type="checkbox" checked={isPreviewVisible} onChange={(event) => setIsPreviewVisible(event.target.checked)} />
                                            <span className="markdown-editor__preview-toggle-ui" aria-hidden="true">
                                                <span className="markdown-editor__preview-toggle-thumb"></span>
                                            </span>
                                            <span>{tSettings("description.preview")}</span>
                                        </label>
                                    </div>
                                </div>

                                {!isPreviewVisible && (
                                    <div className="field field--default textarea markdown-editor__panel">
                                        <label style={{ marginBottom: "0" }} className="field__wrapper">
                                            <textarea
                                                ref={textareaRef}
                                                value={content}
                                                onChange={(event) => setContent(event.target.value)}
                                                onInput={resizeTextarea}
                                                placeholder={t("template.contentPlaceholder")}
                                                className="autosize textarea__input markdown-editor__textarea"
                                                style={{ minHeight: "260px", overflow: "hidden", resize: "none" }}
                                            />
                                        </label>
                                    </div>
                                )}

                                {isPreviewVisible && (
                                    <div className="markdown-editor__preview markdown-editor__panel markdown-body">
                                        <div className="markdown-editor__preview-scroll" style={{ maxHeight: "fit-content" }}>
                                            <ReactMarkdown
                                                remarkPlugins={[remarkGfm]}
                                                rehypePlugins={[rehypeRaw]}
                                                components={{
                                                    a: ({ href, children }) => {
                                                        const safeHref = getSafeMarkdownHref(href);
                                                        if(!safeHref) {
                                                            return <>{children}</>;
                                                        }

                                                        const isExternal = /^https?:\/\//i.test(safeHref);
                                                        return (
                                                            <a href={safeHref} target={isExternal ? "_blank" : undefined} rel={isExternal ? "noopener noreferrer" : undefined}>
                                                                {children}
                                                            </a>
                                                        );
                                                    },
                                                    img: ({ src, alt, title }) => {
                                                        const safeSrc = getSafeMarkdownImageSrc(src);
                                                        if(!safeSrc) {
                                                            return null;
                                                        }

                                                        return <img src={safeSrc} alt={alt || ""} title={title} loading="lazy" />;
                                                    },
                                                }}
                                            >
                                                {prepareProjectDescriptionMarkdown(content)}
                                            </ReactMarkdown>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <p className="blog-settings__field-title">{t("template.titlePlaceholder")}</p>
                            <div className="field field--default">
                                <label className="field__wrapper">
                                    <input type="text" className="text-input" value={titlePlaceholder} onChange={(event) => setTitlePlaceholder(event.target.value)} placeholder={t("template.titlePlaceholderPlaceholder")} />
                                </label>
                            </div>

                            <p className="blog-settings__field-title">{t("template.defaultLabels")}</p>
                            <div className="field field--default">
                                <div className="issue-label-grid">
                                    {labels.length === 0 && (
                                        <span className="field__hint">{t("template.noLabels")}</span>
                                    )}

                                    {labels.map((label) => {
                                        const isSelected = selectedLabels.includes(label.id);
                                        return (
                                            <button key={label.id} type="button" className={`issue-label-chip issue-label-chip--selectable ${isSelected ? "is-selected" : ""}`} onClick={() => toggleLabel(label.id)}>
                                                <span className="issue-label-chip__color" style={{ background: label.color }}></span>
                                                <span>{label.name}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "16px" }}>
                                <button type="button" className="button button--size-m button--type-minimal" onClick={handleCancel} disabled={isSubmitting}>
                                    {t("common.cancel")}
                                </button>

                                <button type="submit" className="button button--size-m button--type-primary" disabled={isSubmitting}>
                                    {isSubmitting ? t("common.saving") : t("template.save")}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
}