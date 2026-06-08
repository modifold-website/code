"use client";

import { useEffect, useRef, useState } from "react";
import Modal from "react-modal";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { getSafeMarkdownHref, getSafeMarkdownImageSrc } from "@/utils/projectDescriptionContent";
import VersionDependenciesEditor from "./VersionDependenciesEditor";

if(typeof window !== "undefined") {
    Modal.setAppElement("body");
}

export default function VersionEditDetailsModal({ isOpen, onRequestClose, editLoading, onSubmit, t, tProject, editFormData, handleEditInputChange, handleSelectEditReleaseChannel, releaseChannels, dependencyTypes, editDependencyDraft, handleEditDependencyDraftChange, handleAddEditDependency, handleRemoveEditDependency }) {
    const [isPreviewVisible, setIsPreviewVisible] = useState(false);
    const textareaRef = useRef(null);
    const changelog = editFormData.changelog || "";

    useEffect(() => {
        if(!isOpen) {
            setIsPreviewVisible(false);
        }
    }, [isOpen]);

    const setChangelog = (nextValue) => {
        handleEditInputChange({
            target: {
                name: "changelog",
                value: nextValue,
            },
        });
    };

    const withSelection = (transform) => {
        const textarea = textareaRef.current;
        if(!textarea) {
            return;
        }

        const start = textarea.selectionStart ?? 0;
        const end = textarea.selectionEnd ?? 0;
        const next = transform(changelog, start, end);
        setChangelog(next.value);

        requestAnimationFrame(() => {
            if(!textareaRef.current) {
                return;
            }

            textareaRef.current.focus();
            if(typeof next.selectionStart === "number" && typeof next.selectionEnd === "number") {
                textareaRef.current.setSelectionRange(next.selectionStart, next.selectionEnd);
            }
        });
    };

    const wrapSelection = (prefix, suffix = prefix) => {
        withSelection((value, start, end) => {
            const selected = value.slice(start, end);
            const nextValue = `${value.slice(0, start)}${prefix}${selected}${suffix}${value.slice(end)}`;
            const selectionStart = start + prefix.length;
            const selectionEnd = selectionStart + selected.length;
            return { value: nextValue, selectionStart, selectionEnd };
        });
    };

    const prefixLines = (prefix) => {
        withSelection((value, start, end) => {
            if(start === end) {
                const nextValue = `${value.slice(0, start)}${prefix}${value.slice(end)}`;
                const caret = start + prefix.length;
                return { value: nextValue, selectionStart: caret, selectionEnd: caret };
            }

            const lineStart = value.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
            const selectedText = value.slice(lineStart, end);
            const transformed = selectedText.split("\n").map((line) => (line.trim() ? `${prefix}${line}` : line)).join("\n");
            const nextValue = `${value.slice(0, lineStart)}${transformed}${value.slice(end)}`;
            return {
                value: nextValue,
                selectionStart: lineStart,
                selectionEnd: lineStart + transformed.length,
            };
        });
    };

    const insertAtSelection = (text) => {
        withSelection((value, start, end) => {
            const nextValue = `${value.slice(0, start)}${text}${value.slice(end)}`;
            const caret = start + text.length;
            return { value: nextValue, selectionStart: caret, selectionEnd: caret };
        });
    };

    return (
        <Modal closeTimeoutMS={150} isOpen={isOpen} onRequestClose={onRequestClose} className="modal active" overlayClassName="modal-overlay modal-overlay--version-details-wide">
            <div className="modal-window version-upload-modal version-edit-details-modal">
                <div className="modal-window__header">
                    <p className="modal-window__title">{t("versions.modal.editDetailsTitle")}</p>

                    <button className="icon-button modal-window__close" type="button" onClick={onRequestClose} disabled={editLoading}>
                        <svg className="icon icon--cross" height="24" width="24">
                            <path fillRule="evenodd" clipRule="evenodd" d="M5.293 5.293a1 1 0 0 1 1.414 0L12 10.586l5.293-5.293a1 1 0 0 1 1.414 1.414L13.414 12l5.293 5.293a1 1 0 0 1-1.414 1.414L12 13.414l-5.293 5.293a1 1 0 0 1-1.414-1.414L10.586 12 5.293 6.707a1 1 0 0 1 0-1.414Z" />
                        </svg>
                    </button>
                </div>

                <div className="modal-window__content">
                    <form onSubmit={onSubmit}>
                        <p className="blog-settings__field-title">{t("versions.fields.releaseChannel")}</p>
                        <div className="version-release-channel-picker" role="group" aria-label={t("versions.fields.releaseChannel")}>
                            {releaseChannels.map((channel) => {
                                const isActive = editFormData.release_channel === channel;

                                return (
                                    <button key={channel} type="button" className={`version-release-channel-picker__option ${isActive ? "is-active" : ""}`} onClick={() => handleSelectEditReleaseChannel(channel)} disabled={editLoading} aria-pressed={isActive}>
                                        <svg className="version-release-channel-picker__check" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                            <path d="M20 6 9 17l-5-5" />
                                        </svg>
                                        
                                        {t(`versions.releaseChannels.${channel}`)}
                                    </button>
                                );
                            })}
                        </div>

                        <p className="blog-settings__field-title">{t("versions.fields.versionNumber")}</p>
                        <div className="field field--default">
                            <label className="field__wrapper">
                                <input type="text" name="version_number" value={editFormData.version_number} onChange={handleEditInputChange} className="text-input" required disabled={editLoading} />
                            </label>
                        </div>

                        <p className="blog-settings__field-title">{t("versions.fields.changelog")}</p>
                        <div className="markdown-editor">
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
                                        <input type="checkbox" checked={isPreviewVisible} onChange={(e) => setIsPreviewVisible(e.target.checked)} />
                                        <span className="markdown-editor__preview-toggle-ui" aria-hidden="true">
                                            <span className="markdown-editor__preview-toggle-thumb"></span>
                                        </span>
                                        <span>{t("description.preview")}</span>
                                    </label>
                                </div>
                            </div>

                            {!isPreviewVisible && (
                                <div className="field field--default textarea markdown-editor__panel">
                                    <label style={{ marginBottom: "0" }} className="field__wrapper">
                                        <textarea
                                            ref={textareaRef}
                                            name="changelog"
                                            value={changelog}
                                            onChange={handleEditInputChange}
                                            placeholder={t("versions.placeholders.changelog")}
                                            className="autosize textarea__input markdown-editor__textarea"
                                            style={{ minHeight: "220px" }}
                                            disabled={editLoading}
                                        />
                                    </label>
                                </div>
                            )}

                            {isPreviewVisible && (
                                <div className="markdown-editor__preview markdown-editor__panel markdown-body">
                                    <div className="markdown-editor__preview-scroll">
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
                                            {changelog}
                                        </ReactMarkdown>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div style={{ marginTop: "14px" }}>
                            <VersionDependenciesEditor
                                dependencies={editFormData.dependencies}
                                dependencyDraft={editDependencyDraft}
                                dependencyTypes={dependencyTypes}
                                onDraftChange={handleEditDependencyDraftChange}
                                onAddDependency={handleAddEditDependency}
                                onRemoveDependency={handleRemoveEditDependency}
                                disabled={editLoading}
                            />
                        </div>

                        <div className="version-upload-actions">
                            <button type="submit" className="button button--size-m button--type-primary" disabled={editLoading}>
                                {editLoading ? tProject("updating") : tProject("update")}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </Modal>
    );
}