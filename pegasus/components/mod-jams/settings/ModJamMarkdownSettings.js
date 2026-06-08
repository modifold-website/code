"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "react-toastify";
import UnsavedChangesBar from "@/components/ui/UnsavedChangesBar";
import { getSafeMarkdownHref, getSafeMarkdownImageSrc, prepareProjectDescriptionMarkdown } from "@/utils/projectDescriptionContent";

function prepareBasicMarkdown(value) {
	return prepareProjectDescriptionMarkdown(value || "")
		.replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
		.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
		.replace(/^#{1,6}\s+/gm, "")
		.replace(/^>\s?/gm, "")
		.replace(/~~([^~]+)~~/g, "$1")
		.replace(/`{3,}[\s\S]*?`{3,}/g, (match) => match.replace(/^`{3,}[^\n]*\n?/, "").replace(/\n?`{3,}$/, ""))
		.replace(/`([^`]+)`/g, "$1")
		.replace(/^\s*[-*_]{3,}\s*$/gm, "")
		.replace(/<[^>]*>/g, "").trim();
}

export default function ModJamMarkdownSettings({ authToken, jam, field, title, hint, placeholder, successMessage, saveErrorMessage, formatting = "full" }) {
	const t = useTranslations("ModJamsPage");
	const router = useRouter();
	const initialValue = jam[field] || "";
	const [value, setValue] = useState(initialValue);
	const [savedValue, setSavedValue] = useState(initialValue);
	const [saving, setSaving] = useState(false);
	const [isPreviewVisible, setIsPreviewVisible] = useState(false);
	const textareaRef = useRef(null);
	const isDirty = value !== savedValue;
	const isBasicFormatting = formatting === "basic";
	const previewValue = isBasicFormatting ? prepareBasicMarkdown(value) : prepareProjectDescriptionMarkdown(value);

	useEffect(() => {
		const nextValue = jam[field] || "";
		setValue(nextValue);
		setSavedValue(nextValue);
	}, [field, jam]);

	const resizeTextarea = () => {
		const textarea = textareaRef.current;
		if(!textarea) {
			return;
		}

		textarea.style.height = "auto";
		textarea.style.height = `${Math.max(textarea.scrollHeight, 260)}px`;
	};

	const updateTextareaValue = (nextValue, selectionStart, selectionEnd) => {
		setValue(nextValue);

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
		const selected = value.slice(start, end);
		const content = selected || "";
		const nextValue = `${value.slice(0, start)}${prefix}${content}${suffix}${value.slice(end)}`;
		const caretStart = start + prefix.length;

		if(selected) {
			updateTextareaValue(nextValue, caretStart, caretStart + content.length);
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
		const nextValue = `${value.slice(0, start)}${text}${value.slice(end)}`;
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

		const lineStart = value.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
		const selectedText = value.slice(lineStart, end);
		const transformed = selectedText.split("\n").map((line) => (line.trim() ? `${prefix}${line}` : line)).join("\n");
		const nextValue = `${value.slice(0, lineStart)}${transformed}${value.slice(end)}`;
		updateTextareaValue(nextValue, lineStart, lineStart + transformed.length);
	};

	useEffect(() => {
		if(isPreviewVisible) {
			return;
		}

		requestAnimationFrame(() => {
			resizeTextarea();
		});
	}, [value, isPreviewVisible]);

	const save = async (event) => {
		if(event) {
			event.preventDefault();
		}

		if(saving || !isDirty) {
			return;
		}

		setSaving(true);

		const payload = new FormData();
		payload.set(field, isBasicFormatting ? prepareBasicMarkdown(value) : prepareProjectDescriptionMarkdown(value));

		try {
			const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE}/mod-jams/${jam.slug}`, {
				method: "PUT",
				headers: { Authorization: `Bearer ${authToken}` },
				body: payload,
			});

			const data = await response.json().catch(() => ({}));
			if(!response.ok) {
				throw new Error(data?.message || saveErrorMessage);
			}

			const nextValue = data.mod_jam?.[field] || value;
			setValue(nextValue);
			setSavedValue(nextValue);
			toast.success(successMessage);
			router.refresh();
		} catch (error) {
			toast.error(error.message);
		} finally {
			setSaving(false);
		}
	};

	return (
		<>
			<div className="settings-wrapper">
				<div className="settings-content">
					<form onSubmit={save}>
						<div className="blog-settings">
							<div className="blog-settings__body">
								<p className="blog-settings__field-title">{title}</p>

								<div className="markdown-editor">
									<p className="markdown-editor__hint">{hint}</p>

									<div className="markdown-editor__toolbar" role="toolbar" aria-label={t("settings.markdown.toolbarLabel")}>
										<div className="markdown-editor__toolbar-buttons">
											{!isBasicFormatting && (
												<>
													<button type="button" className="markdown-editor__tool" onClick={() => prefixLines("# ")} aria-label={t("settings.markdown.heading1")} title={t("settings.markdown.heading1")} disabled={isPreviewVisible}>
														<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-heading1-icon lucide-heading-1"><path d="M4 12h8"/><path d="M4 18V6"/><path d="M12 18V6"/><path d="m17 12 3-2v8"/></svg>
													</button>

													<button type="button" className="markdown-editor__tool" onClick={() => prefixLines("## ")} aria-label={t("settings.markdown.heading2")} title={t("settings.markdown.heading2")} disabled={isPreviewVisible}>
														<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-heading2-icon lucide-heading-2"><path d="M4 12h8"/><path d="M4 18V6"/><path d="M12 18V6"/><path d="M21 18h-4c0-4 4-3 4-6 0-1.5-2-2.5-4-1"/></svg>
													</button>

													<button type="button" className="markdown-editor__tool" onClick={() => prefixLines("### ")} aria-label={t("settings.markdown.heading3")} title={t("settings.markdown.heading3")} disabled={isPreviewVisible}>
														<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-heading3-icon lucide-heading-3"><path d="M4 12h8"/><path d="M4 18V6"/><path d="M12 18V6"/><path d="M17.5 10.5c1.7-1 3.5 0 3.5 1.5a2 2 0 0 1-2 2"/><path d="M17 17.5c2 1.5 4 .3 4-1.5a2 2 0 0 0-2-2"/></svg>
													</button>
												</>
											)}

											<button type="button" className="markdown-editor__tool" onClick={() => wrapSelection("**", "**")} aria-label={t("settings.markdown.bold")} title={t("settings.markdown.bold")} disabled={isPreviewVisible}>
												<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-bold-icon lucide-bold"><path d="M6 12h9a4 4 0 0 1 0 8H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h7a4 4 0 0 1 0 8"/></svg>
											</button>

											<button type="button" className="markdown-editor__tool" onClick={() => wrapSelection("*", "*")} aria-label={t("settings.markdown.italic")} title={t("settings.markdown.italic")} disabled={isPreviewVisible}>
												<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-italic-icon lucide-italic"><line x1="19" x2="10" y1="4" y2="4"/><line x1="14" x2="5" y1="20" y2="20"/><line x1="15" x2="9" y1="4" y2="20"/></svg>
											</button>

											{!isBasicFormatting && (
												<>
													<button type="button" className="markdown-editor__tool" onClick={() => wrapSelection("~~", "~~")} aria-label={t("settings.markdown.strikethrough")} title={t("settings.markdown.strikethrough")} disabled={isPreviewVisible}>
														<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-strikethrough-icon lucide-strikethrough"><path d="M16 4H9a3 3 0 0 0-2.83 4"/><path d="M14 12a4 4 0 0 1 0 8H6"/><line x1="4" x2="20" y1="12" y2="12"/></svg>
													</button>

													<button type="button" className="markdown-editor__tool" onClick={() => wrapSelection("`", "`")} aria-label={t("settings.markdown.code")} title={t("settings.markdown.code")} disabled={isPreviewVisible}>
														<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-code-xml-icon lucide-code-xml"><path d="m18 16 4-4-4-4"/><path d="m6 8-4 4 4 4"/><path d="m14.5 4-5 16"/></svg>
													</button>
												</>
											)}

											<button type="button" className="markdown-editor__tool" onClick={() => prefixLines("- ")} aria-label={t("settings.markdown.bulletedList")} title={t("settings.markdown.bulletedList")} disabled={isPreviewVisible}>
												<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-list-icon lucide-list"><path d="M3 5h.01"/><path d="M3 12h.01"/><path d="M3 19h.01"/><path d="M8 5h13"/><path d="M8 12h13"/><path d="M8 19h13"/></svg>
											</button>

											<button type="button" className="markdown-editor__tool" onClick={() => prefixLines("1. ")} aria-label={t("settings.markdown.orderedList")} title={t("settings.markdown.orderedList")} disabled={isPreviewVisible}>
												<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-list-ordered-icon lucide-list-ordered"><path d="M11 5h10"/><path d="M11 12h10"/><path d="M11 19h10"/><path d="M4 4h1v5"/><path d="M4 9h2"/><path d="M6.5 20H3.4c0-1 2.6-1.925 2.6-3.5a1.5 1.5 0 0 0-2.6-1.02"/></svg>
											</button>

											{!isBasicFormatting && (
												<>
													<button type="button" className="markdown-editor__tool" onClick={() => insertAtSelection(t("settings.markdown.linkTemplate"))} aria-label={t("settings.markdown.link")} title={t("settings.markdown.link")} disabled={isPreviewVisible}>
														<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-link-icon lucide-link"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
													</button>

													<button type="button" className="markdown-editor__tool" onClick={() => insertAtSelection(t("settings.markdown.imageTemplate"))} aria-label={t("settings.markdown.image")} title={t("settings.markdown.image")} disabled={isPreviewVisible}>
														<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-image-icon lucide-image"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
													</button>
												</>
											)}

											<label className="markdown-editor__preview-toggle">
												<input type="checkbox" checked={isPreviewVisible} onChange={(event) => setIsPreviewVisible(event.target.checked)} />
												
												<span className="markdown-editor__preview-toggle-ui" aria-hidden="true">
													<span className="markdown-editor__preview-toggle-thumb"></span>
												</span>

												<span>{t("settings.markdown.preview")}</span>
											</label>
										</div>
									</div>

									{!isPreviewVisible && (
										<div className="field field--default textarea markdown-editor__panel">
											<label style={{ marginBottom: "0" }} className="field__wrapper">
												<textarea ref={textareaRef} value={value} onChange={(event) => setValue(event.target.value)} onInput={resizeTextarea} placeholder={placeholder} className="autosize textarea__input markdown-editor__textarea" minLength={50} required />
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
													{previewValue}
												</ReactMarkdown>
											</div>
										</div>
									)}
								</div>

							</div>
						</div>
					</form>
				</div>
			</div>

			<UnsavedChangesBar
				isDirty={isDirty}
				isSaving={saving}
				onSave={save}
				onReset={() => setValue(savedValue)}
				saveLabel={t("settings.unsaved.save")}
				resetLabel={t("settings.unsaved.reset")}
				message={t("settings.unsaved.message")}
			/>
		</>
	);
}