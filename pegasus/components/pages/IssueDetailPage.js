"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { useTranslations, useLocale } from "next-intl";
import { useAuth } from "../providers/AuthProvider";
import { toast } from "react-toastify";
import { getSafeMarkdownHref, getSafeMarkdownImageSrc, prepareProjectDescriptionMarkdown } from "@/utils/projectDescriptionContent";
import Tooltip from "@/components/ui/Tooltip";

const formatDateTime = (timestamp, locale) => {
    if(!timestamp) {
        return "";
    }

    const date = new Date(Number(timestamp));
    const now = new Date();
    const isSameYear = date.getFullYear() === now.getFullYear();
    const options = isSameYear ? { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" } : { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" };
    return date.toLocaleString(locale, options);
};

const formatDateShort = (timestamp, locale) => {
    if(!timestamp) {
        return "";
    }

    const date = new Date(Number(timestamp));
    return date.toLocaleDateString(locale, { day: "numeric", month: "short" });
};

const formatDateTimeFull = (timestamp, locale) => {
    if(!timestamp) {
        return "";
    }

    const date = new Date(Number(timestamp));
    const now = new Date();
    const isSameYear = date.getFullYear() === now.getFullYear();
    const options = isSameYear ? { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" } : { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" };
    return date.toLocaleString(locale, options);
};

const applyLabelStyle = (label) => ({
    background: `${label.color}22`,
    color: label.color,
    border: `1px solid ${label.color}44`,
    padding: "3px 10px"
});

const buildCommentTree = (comments) => {
    const map = new Map();
    const roots = [];

    comments.forEach((comment) => {
        map.set(comment.id, { ...comment, children: [] });
    });

    comments.forEach((comment) => {
        const node = map.get(comment.id);
        if(comment.parent_id && map.has(comment.parent_id)) {
            map.get(comment.parent_id).children.push(node);
        } else {
            roots.push(node);
        }
    });

    return roots;
};

export default function IssueDetailPage({ project, authToken, initialIssue, initialComments, initialEvents, initialCanManage, initialAvailableLabels }) {
    const t = useTranslations("Issues");
    const locale = useLocale();
    const { isLoggedIn, user } = useAuth();

    const [issue, setIssue] = useState(initialIssue);
    const [comments, setComments] = useState(initialComments || []);
    const [events, setEvents] = useState(initialEvents || []);
    const [availableLabels, setAvailableLabels] = useState(initialAvailableLabels || []);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isPosting, setIsPosting] = useState(false);
    const [commentText, setCommentText] = useState("");
    const [replyTo, setReplyTo] = useState(null);
    const [replyText, setReplyText] = useState("");
    const [labelMenuOpen, setLabelMenuOpen] = useState(false);
    const [isEditingIssue, setIsEditingIssue] = useState(false);
    const [isIssueSaving, setIsIssueSaving] = useState(false);
    const [isIssuePreviewVisible, setIsIssuePreviewVisible] = useState(false);
    const [editIssueTitle, setEditIssueTitle] = useState(initialIssue?.title || "");
    const [editIssueBody, setEditIssueBody] = useState(initialIssue?.body || "");
    const [editingCommentId, setEditingCommentId] = useState(null);
    const [editingCommentText, setEditingCommentText] = useState("");
    const [isCommentSaving, setIsCommentSaving] = useState(false);
    const labelMenuRef = useRef(null);
    const issueTextareaRef = useRef(null);

    const canManage = !!initialCanManage;
    const canEditIssue = canManage || (user?.id && issue?.author?.id && Number(user.id) === Number(issue.author.id));

    useEffect(() => {
        setEditIssueTitle(issue?.title || "");
        setEditIssueBody(issue?.body || "");
    }, [issue?.id, issue?.title, issue?.body]);

    const labelLookup = useMemo(() => {
        const map = new Map();
        (issue.labels || []).forEach((label) => map.set(label.id, label));
        (availableLabels || []).forEach((label) => map.set(label.id, label));
        return map;
    }, [issue.labels, availableLabels]);

    const commentTree = useMemo(() => buildCommentTree(comments), [comments]);
    const timelineItems = useMemo(() => {
        const items = [];

        (events || []).forEach((event) => {
            items.push({ type: "event", createdAt: event.created_at, event });
        });

        commentTree.forEach((comment) => {
            items.push({ type: "comment", createdAt: comment.created_at, comment });
        });

        return items.sort((a, b) => Number(a.createdAt || 0) - Number(b.createdAt || 0));
    }, [events, commentTree]);

    const refreshIssue = async () => {
        try {
            setIsRefreshing(true);

            const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE}/projects/${project.slug}/issues/${issue.id}`, {
                headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined,
            });

            if(!res.ok) {
                throw new Error("Failed");
            }

            const data = await res.json();
            setIssue(data.issue);
            setComments(data.comments || []);
            setEvents(data.events || []);
            setAvailableLabels(data.availableLabels || []);
        } catch {
            toast.error(t("errors.loadIssue"));
        } finally {
            setIsRefreshing(false);
        }
    };

    useEffect(() => {
        if(!labelMenuOpen) {
            return;
        }

        const handleClick = (event) => {
            if(labelMenuRef.current && !labelMenuRef.current.contains(event.target)) {
                setLabelMenuOpen(false);
            }
        };

        document.addEventListener("click", handleClick);
        return () => document.removeEventListener("click", handleClick);
    }, [labelMenuOpen]);

    const handleCommentSubmit = async (content, parentId = null) => {
        if(!isLoggedIn) {
            toast.error(t("newIssue.loginRequired"));
            return;
        }

        if(!content.trim()) {
            return;
        }

        try {
            setIsPosting(true);
            
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE}/projects/${project.slug}/issues/${issue.id}/comments`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: authToken ? `Bearer ${authToken}` : `Bearer ${localStorage.getItem("authToken")}`,
                },
                body: JSON.stringify({ content, parent_id: parentId }),
            });

            if(res.status === 429) {
                toast.error(t("errors.rateLimited"));
                return;
            }

            if(!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.message || "Failed");
            }

            setCommentText("");
            setReplyText("");
            setReplyTo(null);
            await refreshIssue();
        } catch (error) {
            toast.error(error.message || t("errors.comment"));
        } finally {
            setIsPosting(false);
        }
    };

    const handleStatusChange = async (action) => {
        if(!canManage) {
            return;
        }

        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE}/projects/${project.slug}/issues/${issue.id}`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: authToken ? `Bearer ${authToken}` : `Bearer ${localStorage.getItem("authToken")}`,
                },
                body: JSON.stringify({ action }),
            });

            if(!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.message || "Failed");
            }

            await refreshIssue();
        } catch (error) {
            toast.error(error.message || t("errors.status"));
        }
    };

    const handleIssueSave = async () => {
        if(!canEditIssue) {
            return;
        }

        if(!editIssueTitle.trim()) {
            toast.error(t("newIssue.titleRequired"));
            return;
        }

        try {
            setIsIssueSaving(true);

            const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE}/projects/${project.slug}/issues/${issue.id}`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: authToken ? `Bearer ${authToken}` : `Bearer ${localStorage.getItem("authToken")}`,
                },
                body: JSON.stringify({ title: editIssueTitle, body: editIssueBody }),
            });

            if(!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.message || "Failed");
            }

            await refreshIssue();
            setIsEditingIssue(false);
        } catch (error) {
            toast.error(error.message || t("errors.status"));
        } finally {
            setIsIssueSaving(false);
        }
    };

    const updateIssueTextareaValue = (nextValue, selectionStart, selectionEnd) => {
        setEditIssueBody(nextValue);

        requestAnimationFrame(() => {
            if(!issueTextareaRef.current) {
                return;
            }

            resizeIssueTextarea();
            issueTextareaRef.current.focus();
            if(typeof selectionStart === "number" && typeof selectionEnd === "number") {
                issueTextareaRef.current.setSelectionRange(selectionStart, selectionEnd);
            }
        });
    };

    const resizeIssueTextarea = () => {
        const textarea = issueTextareaRef.current;
        if(!textarea) {
            return;
        }

        textarea.style.height = "auto";
        textarea.style.height = `${Math.max(textarea.scrollHeight, 260)}px`;
    };

    const wrapIssueSelection = (prefix, suffix = prefix) => {
        const textarea = issueTextareaRef.current;
        if(!textarea) {
            return;
        }

        const start = textarea.selectionStart ?? 0;
        const end = textarea.selectionEnd ?? 0;
        const selected = editIssueBody.slice(start, end);
        const nextValue = `${editIssueBody.slice(0, start)}${prefix}${selected || ""}${suffix}${editIssueBody.slice(end)}`;
        const caretStart = start + prefix.length;

        if(selected) {
            updateIssueTextareaValue(nextValue, caretStart, caretStart + selected.length);
            return;
        }

        updateIssueTextareaValue(nextValue, caretStart, caretStart);
    };

    const insertAtIssueSelection = (text, selectInserted = false) => {
        const textarea = issueTextareaRef.current;
        if(!textarea) {
            return;
        }

        const start = textarea.selectionStart ?? 0;
        const end = textarea.selectionEnd ?? 0;
        const nextValue = `${editIssueBody.slice(0, start)}${text}${editIssueBody.slice(end)}`;
        const caret = start + text.length;
        updateIssueTextareaValue(nextValue, selectInserted ? start : caret, selectInserted ? caret : caret);
    };

    const prefixIssueLines = (prefix) => {
        const textarea = issueTextareaRef.current;
        if(!textarea) {
            return;
        }

        const start = textarea.selectionStart ?? 0;
        const end = textarea.selectionEnd ?? 0;

        if(start === end) {
            insertAtIssueSelection(prefix);
            return;
        }

        const lineStart = editIssueBody.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
        const selectedText = editIssueBody.slice(lineStart, end);
        const transformed = selectedText.split("\n").map((line) => (line.trim() ? `${prefix}${line}` : line)).join("\n");
        const nextValue = `${editIssueBody.slice(0, lineStart)}${transformed}${editIssueBody.slice(end)}`;
        updateIssueTextareaValue(nextValue, lineStart, lineStart + transformed.length);
    };

    useEffect(() => {
        if(!isEditingIssue || isIssuePreviewVisible) {
            return;
        }

        requestAnimationFrame(() => {
            resizeIssueTextarea();
        });
    }, [isEditingIssue, isIssuePreviewVisible, editIssueBody]);

    const startCommentEdit = (comment) => {
        setEditingCommentId(comment.id);
        setEditingCommentText(comment.content || "");
    };

    const cancelCommentEdit = () => {
        setEditingCommentId(null);
        setEditingCommentText("");
    };

    const handleCommentEditSubmit = async (commentId) => {
        if(!isLoggedIn) {
            toast.error(t("newIssue.loginRequired"));
            return;
        }

        if(!editingCommentText.trim()) {
            return;
        }

        try {
            setIsCommentSaving(true);

            const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE}/projects/${project.slug}/issues/${issue.id}/comments/${commentId}`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: authToken ? `Bearer ${authToken}` : `Bearer ${localStorage.getItem("authToken")}`,
                },
                body: JSON.stringify({ action: "edit", content: editingCommentText }),
            });

            if(!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.message || "Failed");
            }

            await refreshIssue();
            cancelCommentEdit();
        } catch (error) {
            toast.error(error.message || t("errors.comment"));
        } finally {
            setIsCommentSaving(false);
        }
    };

    const handleToggleLabel = async (labelId, isActive) => {
        if(!canManage) {
            return;
        }

        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE}/projects/${project.slug}/issues/${issue.id}/labels`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: authToken ? `Bearer ${authToken}` : `Bearer ${localStorage.getItem("authToken")}`,
                },
                body: JSON.stringify({ label_id: labelId, action: isActive ? "remove" : "add" }),
            });

            if(!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.message || "Failed");
            }

            await refreshIssue();
        } catch (error) {
            toast.error(error.message || t("errors.labels"));
        }
    };

    const getEventLabel = (event) => {
        const labelId = event?.meta?.label_id;
        if(labelId === undefined || labelId === null) {
            return null;
        }

        return labelLookup.get(labelId) || labelLookup.get(Number(labelId)) || labelLookup.get(String(labelId)) || null;
    };

    const renderEvent = (event) => {
        if(event.type === "issue_opened") {
            return t("history.opened", { name: event.actor?.username || t("history.system") });
        }

        if(event.type === "issue_closed") {
            return t("history.closed", { name: event.actor?.username || t("history.system") });
        }

        if(event.type === "issue_reopened") {
            return t("history.reopened", { name: event.actor?.username || t("history.system") });
        }

        if(event.type === "label_added") {
            const label = labelLookup.get(event.meta?.label_id);
            return t("history.labelAdded", { name: event.actor?.username || t("history.system"), label: label?.name || t("history.unknownLabel") });
        }

        if(event.type === "label_removed") {
            const label = labelLookup.get(event.meta?.label_id);
            return t("history.labelRemoved", { name: event.actor?.username || t("history.system"), label: label?.name || t("history.unknownLabel") });
        }

        return t("history.generic", { name: event.actor?.username || t("history.system") });
    };

    const renderEventMessage = (event) => {
        if(event.type !== "label_added" && event.type !== "label_removed") {
            return <span style={{ fontWeight: "500" }}>{renderEvent(event)}</span>;
        }

        const label = getEventLabel(event);
        const actorName = event.actor?.username || t("history.system");
        const labelName = label?.name || t("history.unknownLabel");
        const historyKey = event.type === "label_added" ? "history.labelAdded" : "history.labelRemoved";
        const rawMessage = t(historyKey, { name: actorName, label: labelName });
        const messageWithoutLabel = rawMessage.replace(labelName, "").replace(/\s{2,}/g, " ").replace(/\s+([.,!?])/g, "$1").trim();

        return (
            <span style={{ fontWeight: "500", display: "inline-flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                <span>{messageWithoutLabel}</span>
                <span className="issue-label" style={label ? applyLabelStyle(label) : undefined}>
                    {labelName}
                </span>
            </span>
        );
    };

    const renderMarkdown = (value) => (
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
            {prepareProjectDescriptionMarkdown(value)}
        </ReactMarkdown>
    );

    const renderComment = (comment, depth = 0) => {
        const isDeleted = comment.status === "deleted" && !comment.content;
        const isEditingThisComment = editingCommentId === comment.id;
        const canEditThisComment = isLoggedIn && user?.id && Number(user.id) === Number(comment.author?.id) && !isDeleted;
        const isEdited = !isDeleted && Number(comment.updated_at || 0) > Number(comment.created_at || 0);
        
        return (
            <div key={comment.id} className="issue-comment" style={{ marginLeft: `${Math.min(depth, 4) * 20}px` }}>
                <div className="issue-comment__header">
                    {comment.author?.avatar ? (
                        <img src={comment.author.avatar} alt={comment.author.username} style={{ width: "28px", height: "28px", borderRadius: "50%" }} />
                    ) : null}

                    <Link href={`/user/${comment.author?.slug || ""}`} className="issue-comment__author">
                        {comment.author?.username || t("comments.unknown")}
                    </Link>

                    <span className="issue-comment__time">{formatDateTime(comment.created_at, locale)}</span>

                    {isEdited && (
                        <Tooltip content={formatDateTimeFull(comment.updated_at, locale)}>
                            <span className="issue-comment__time">
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/>
                                    <path d="m15 5 4 4"/>
                                </svg>
                            </span>
                        </Tooltip>
                    )}
                </div>

                <div className="issue-comment__content markdown-body">
                    {isDeleted ? (
                        <p>{t("comments.deleted")}</p>
                    ) : isEditingThisComment ? (
                        <div className="issue-comment-form" style={{ marginTop: "0", padding: "0" }}>
                            <textarea
                                className="text-input"
                                value={editingCommentText}
                                onChange={(event) => setEditingCommentText(event.target.value)}
                                placeholder={t("comments.replyPlaceholder")}
                            />

                            <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                                <button type="button" className="button button--size-m button--type-minimal button--active-transform" onClick={cancelCommentEdit} disabled={isCommentSaving}>
                                    {t("common.cancel")}
                                </button>

                                <button type="button" className="button button--size-m button--type-primary button--active-transform" disabled={isCommentSaving} onClick={() => handleCommentEditSubmit(comment.id)}>
                                    {isCommentSaving ? t("common.saving") : t("common.save")}
                                </button>
                            </div>
                        </div>
                    ) : (
                        renderMarkdown(comment.content || "")
                    )}
                </div>

                {issue.status === "open" && isLoggedIn && !isDeleted && (
                    <button type="button" className="comment__action comment__action--reply" onClick={() => setReplyTo(comment.id)}>
                        {t("comments.reply")}
                    </button>
                )}

                {canEditThisComment && !isEditingThisComment && (
                    <button type="button" className="comment__action comment__action--reply" onClick={() => startCommentEdit(comment)}>
                        {t("comments.edit")}
                    </button>
                )}

                {replyTo === comment.id && (
                    <div style={{ marginTop: "10px", padding: "0", background: "transparent" }} className="issue-comment-form">
                        <textarea
                            className="text-input"
                            value={replyText}
                            onChange={(event) => setReplyText(event.target.value)}
                            placeholder={t("comments.replyPlaceholder")}
                        />

                        <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                            <button type="button" className="button button--size-m button--type-minimal button--active-transform" onClick={() => { setReplyTo(null); setReplyText(""); }}>
                                {t("common.cancel")}
                            </button>

                            <button type="button" className="button button--size-m button--type-primary button--active-transform" disabled={isPosting} onClick={() => handleCommentSubmit(replyText, comment.id)}>
                                {isPosting ? t("common.sending") : t("comments.send")}
                            </button>
                        </div>
                    </div>
                )}

                {comment.children?.length > 0 && comment.children.map((child) => renderComment(child, depth + 1))}
            </div>
        );
    };

    return (
        <div className="issue-detail-layout">
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div className="content content--padding issue-detail-header">
                    <svg className={`issue-badge--${issue.status === "closed" ? "closed" : "open"}`} xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" color="currentColor">
                        <path d="M2 12C2 17.5228 6.47715 22 12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2" stroke="currentColor" strokeLinecap="round" strokeWidth="2"></path>
                        <path d="M4.64856 5.07876C4.7869 4.93211 4.92948 4.7895 5.0761 4.65111M7.94733 2.72939C8.12884 2.6478 8.31313 2.57128 8.5 2.5M2.5 8.5C2.57195 8.31127 2.64925 8.12518 2.73172 7.94192" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
                        <path d="M12 8V16M16 12L8 12" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
                    </svg>

                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        <div className="issue-card__title">
                            {isEditingIssue ? (
                                <input
                                    className="text-input"
                                    value={editIssueTitle}
                                    onChange={(event) => setEditIssueTitle(event.target.value)}
                                    maxLength={120}
                                    style={{ maxWidth: "500px", fontSize: "20px", fontWeight: "500" }}
                                />
                            ) : (
                                <h1>{issue.title}</h1>
                            )}
                        </div>

                        <div className="issue-detail-meta">
                            <span className={`issue-status-badge issue-status-badge--${issue.status === "closed" ? "closed" : "open"}`}>
                                {issue.status === "closed" ? t("status.closed") : t("status.open")}
                            </span>

                            {issue.author && (
                                <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                                    {t("meta.by")}

                                    <Link href={issue.author.profile_url || `/user/${issue.author.slug || ""}`} className="issue-comment__author" style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                                        {issue.author.avatar && (
                                            <img src={issue.author.avatar} alt={issue.author.username} style={{ width: "18px", height: "18px", borderRadius: "50%" }} />
                                        )}

                                        {issue.author.username}
                                    </Link>
                                </span>
                            )}

                            <span>{formatDateShort(issue.created_at, locale)}</span>
                        </div>
                    </div>
                </div>

                <div className="content content--padding markdown-body">
                    {isEditingIssue ? (
                        <div className="markdown-editor">
                            <p className="markdown-editor__hint" style={{ marginBottom: "0" }}>{t("newIssue.markdownHint")}</p>

                            <div className="markdown-editor__toolbar" role="toolbar" aria-label="Markdown editor toolbar">
                                <div className="markdown-editor__toolbar-buttons">
                                    <button type="button" className="markdown-editor__tool" onClick={() => prefixIssueLines("# ")} aria-label="Heading 1" title="Heading 1" disabled={isIssuePreviewVisible}>
                                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-heading1-icon lucide-heading-1"><path d="M4 12h8"/><path d="M4 18V6"/><path d="M12 18V6"/><path d="m17 12 3-2v8"/></svg>
                                    </button>

                                    <button type="button" className="markdown-editor__tool" onClick={() => prefixIssueLines("## ")} aria-label="Heading 2" title="Heading 2" disabled={isIssuePreviewVisible}>
                                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-heading2-icon lucide-heading-2"><path d="M4 12h8"/><path d="M4 18V6"/><path d="M12 18V6"/><path d="M21 18h-4c0-4 4-3 4-6 0-1.5-2-2.5-4-1"/></svg>
                                    </button>
                                    
                                    <button type="button" className="markdown-editor__tool" onClick={() => prefixIssueLines("### ")} aria-label="Heading 3" title="Heading 3" disabled={isIssuePreviewVisible}>
                                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-heading3-icon lucide-heading-3"><path d="M4 12h8"/><path d="M4 18V6"/><path d="M12 18V6"/><path d="M17.5 10.5c1.7-1 3.5 0 3.5 1.5a2 2 0 0 1-2 2"/><path d="M17 17.5c2 1.5 4 .3 4-1.5a2 2 0 0 0-2-2"/></svg>
                                    </button>

                                    <button type="button" className="markdown-editor__tool" onClick={() => wrapIssueSelection("**", "**")} aria-label="Bold" title="Bold" disabled={isIssuePreviewVisible}>
                                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-bold-icon lucide-bold"><path d="M6 12h9a4 4 0 0 1 0 8H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h7a4 4 0 0 1 0 8"/></svg>
                                    </button>

                                    <button type="button" className="markdown-editor__tool" onClick={() => wrapIssueSelection("*", "*")} aria-label="Italic" title="Italic" disabled={isIssuePreviewVisible}>
                                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-italic-icon lucide-italic"><line x1="19" x2="10" y1="4" y2="4"/><line x1="14" x2="5" y1="20" y2="20"/><line x1="15" x2="9" y1="4" y2="20"/></svg>
                                    </button>

                                    <button type="button" className="markdown-editor__tool" onClick={() => wrapIssueSelection("~~", "~~")} aria-label="Strikethrough" title="Strikethrough" disabled={isIssuePreviewVisible}>
                                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-strikethrough-icon lucide-strikethrough"><path d="M16 4H9a3 3 0 0 0-2.83 4"/><path d="M14 12a4 4 0 0 1 0 8H6"/><line x1="4" x2="20" y1="12" y2="12"/></svg>
                                    </button>

                                    <button type="button" className="markdown-editor__tool" onClick={() => wrapIssueSelection("`", "`")} aria-label="Code" title="Code" disabled={isIssuePreviewVisible}>
                                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-code-xml-icon lucide-code-xml"><path d="m18 16 4-4-4-4"/><path d="m6 8-4 4 4 4"/><path d="m14.5 4-5 16"/></svg>
                                    </button>

                                    <button type="button" className="markdown-editor__tool" onClick={() => prefixIssueLines("- ")} aria-label="Bulleted list" title="Bulleted list" disabled={isIssuePreviewVisible}>
                                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-list-icon lucide-list"><path d="M3 5h.01"/><path d="M3 12h.01"/><path d="M3 19h.01"/><path d="M8 5h13"/><path d="M8 12h13"/><path d="M8 19h13"/></svg>
                                    </button>

                                    <button type="button" className="markdown-editor__tool" onClick={() => prefixIssueLines("1. ")} aria-label="Ordered list" title="Ordered list" disabled={isIssuePreviewVisible}>
                                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-list-ordered-icon lucide-list-ordered"><path d="M11 5h10"/><path d="M11 12h10"/><path d="M11 19h10"/><path d="M4 4h1v5"/><path d="M4 9h2"/><path d="M6.5 20H3.4c0-1 2.6-1.925 2.6-3.5a1.5 1.5 0 0 0-2.6-1.02"/></svg>
                                    </button>

                                    <button type="button" className="markdown-editor__tool" onClick={() => insertAtIssueSelection("[link text](https://)")} aria-label="Link" title="Link" disabled={isIssuePreviewVisible}>
                                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-link-icon lucide-link"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                                    </button>

                                    <button type="button" className="markdown-editor__tool" onClick={() => insertAtIssueSelection("![alt text](https://)")} aria-label="Image" title="Image" disabled={isIssuePreviewVisible}>
                                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-image-icon lucide-image"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
                                    </button>

                                    <label className="markdown-editor__preview-toggle">
                                        <input type="checkbox" checked={isIssuePreviewVisible} onChange={(event) => setIsIssuePreviewVisible(event.target.checked)} />
                                        <span className="markdown-editor__preview-toggle-ui" aria-hidden="true">
                                            <span className="markdown-editor__preview-toggle-thumb"></span>
                                        </span>
                                        <span>Preview</span>
                                    </label>
                                </div>
                            </div>

                            {!isIssuePreviewVisible && (
                                <div className="field field--default textarea markdown-editor__panel">
                                    <label style={{ marginBottom: "0" }} className="field__wrapper">
                                        <textarea
                                            ref={issueTextareaRef}
                                            value={editIssueBody}
                                            onChange={(event) => setEditIssueBody(event.target.value)}
                                            onInput={resizeIssueTextarea}
                                            placeholder={t("details.emptyBody")}
                                            className="autosize textarea__input markdown-editor__textarea"
                                            style={{ minHeight: "260px", overflow: "hidden", resize: "none" }}
                                        />
                                    </label>
                                </div>
                            )}

                            {isIssuePreviewVisible && (
                                <div className="markdown-editor__preview markdown-editor__panel markdown-body">
                                    <div className="markdown-editor__preview-scroll" style={{ maxHeight: "fit-content" }}>
                                        {renderMarkdown(editIssueBody)}
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        renderMarkdown(issue.body || t("details.emptyBody"))
                    )}
                </div>

                <div className="issue-timeline">
                    {timelineItems.length === 0 ? (
                        <span className="issues-empty">{t("history.empty")}</span>
                    ) : (
                        timelineItems.map((item) => {
                            if(item.type === "comment") {
                                return renderComment(item.comment);
                            }

                            const event = item.event;
                            const isLabelEvent = event.type === "label_added" || event.type === "label_removed";
                            const isClosedEvent = event.type === "issue_closed";

                            return (
                                <div key={event.id} className="issue-event">
                                    <div className="issue-event__dot">
                                        {isLabelEvent ? (
                                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"/>
                                                <circle cx="7.5" cy="7.5" r=".5" fill="currentColor"/>
                                            </svg>
                                        ) : isClosedEvent ? (
                                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>
                                                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                                            </svg>
                                        ) : (
                                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <circle cx="12" cy="12" r="10"></circle>
                                                <circle cx="12" cy="12" r="1"></circle>
                                            </svg>
                                        )}
                                    </div>

                                    <div className="issue-event__info">
                                        {renderEventMessage(event)}
                                        <span style={{ color: "var(--theme-color-text-secondary)" }}>{formatDateTime(event.created_at, locale)}</span>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {issue.status === "open" ? (
                    <div className="issue-comment-form">
                        <h2>{t("comments.title")}</h2>

                        <textarea
                            className="text-input"
                            value={commentText}
                            onChange={(event) => setCommentText(event.target.value)}
                            placeholder={t("comments.placeholder")}
                        />

                        <div style={{ display: "flex", justifyContent: "flex-end" }}>
                            <button type="button" className="button button--size-m button--type-primary button--active-transform" disabled={isPosting} onClick={() => handleCommentSubmit(commentText)}>
                                {isPosting ? t("common.sending") : t("comments.send")}
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="issues-empty">{t("comments.closed")}</div>
                )}
            </div>

            <aside className="issue-sidebar">
                {(canManage || canEditIssue) && (
                    <div style={{ display: "flex", gap: "8px", justifyContent: "space-between" }}>
                        {isEditingIssue ? (
                            <>
                                <button
                                    type="button"
                                    className="button button--size-m button--type-secondary button--with-icon button--active-transform"
                                    style={{ "--icon-size": "16px" }}
                                    onClick={() => {
                                        setIsEditingIssue(false);
                                        setIsIssuePreviewVisible(false);
                                        setEditIssueTitle(issue.title || "");
                                        setEditIssueBody(issue.body || "");
                                    }}
                                    disabled={isIssueSaving}
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <circle cx="12" cy="12" r="10"/>
                                        <path d="m15 9-6 6"/>
                                        <path d="m9 9 6 6"/>
                                    </svg>

                                    {t("common.cancel")}
                                </button>

                                <button type="button" className="button button--size-m button--type-primary button--active-transform" onClick={handleIssueSave} disabled={isIssueSaving}>
                                    {isIssueSaving ? t("common.saving") : t("common.save")}
                                </button>
                            </>
                        ) : (
                            <>
                                {canManage && (
                                    issue.status === "open" ? (
                                        <button type="button" className="button button--size-m button--type-secondary button--with-icon button--active-transform" style={{ "--icon-size": "16px" }} onClick={() => handleStatusChange("close")} disabled={isRefreshing}>
                                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>
                                                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                                            </svg>

                                            {t("actions.close")}
                                        </button>
                                    ) : (
                                        <button type="button" className="button button--size-m button--type-primary button--with-icon button--active-transform" style={{ "--icon-size": "16px" }} onClick={() => handleStatusChange("reopen")} disabled={isRefreshing}>
                                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>
                                                <path d="M7 11V7a5 5 0 0 1 9.9-1"/>
                                            </svg>

                                            {t("actions.reopen")}
                                        </button>
                                    )
                                )}

                                {canEditIssue && (
                                    <button type="button" className="button button--size-m button--type-secondary button--with-icon button--active-transform" style={{ "--icon-size": "16px" }} onClick={() => { setIsEditingIssue(true); setIsIssuePreviewVisible(false); }}>
                                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/>
                                            <path d="m15 5 4 4"/>
                                        </svg>
                                        
                                        {t("actions.edit")}
                                    </button>
                                )}
                            </>
                        )}
                    </div>
                )}

                <div className="content content--padding" ref={labelMenuRef}>
                    <h2>{t("sidebar.labels")}</h2>

                    <div className="issue-labels-list">
                        {(issue.labels || []).length === 0 && (
                            <span className="field__hint">{t("sidebar.noLabels")}</span>
                        )}

                        {(issue.labels || []).map((label) => (
                            <span key={label.id} className="issue-label" style={applyLabelStyle(label)}>
                                {label.name}
                            </span>
                        ))}
                    </div>

                    {canManage && (
                        <div className="issue-label-manage" style={{ position: "relative" }}>
                            <button type="button" className="button button--size-m button--type-minimal button--active-transform" onClick={() => setLabelMenuOpen((prev) => !prev)}>
                                {t("sidebar.manageLabels")}
                            </button>

                            {labelMenuOpen && (
                                <div className="popover popover--sort" style={{ top: "calc(100% + 10px)" }}>
                                    <div className="context-list" style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "10px" }}>
                                        {availableLabels.map((label) => {
                                            const isActive = issue.labels.some((item) => item.id === label.id);
                                            return (
                                                <button key={label.id} type="button" className={`issue-label-chip issue-label-chip--selectable ${isActive ? "is-selected" : ""}`} onClick={() => handleToggleLabel(label.id, isActive)}>
                                                    <span className="issue-label-chip__color" style={{ background: label.color }}></span>
                                                    <span>{label.name}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="content content--padding">
                    <h2>{t("sidebar.details")}</h2>

                    <div className="details-list">
                        <div className="license">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M8 2v4"></path>
                                <path d="M16 2v4"></path>
                                <rect width="18" height="18" x="3" y="4" rx="2"></rect>
                                <path d="M3 10h18"></path>
                            </svg>

                            <Tooltip content={formatDateTimeFull(issue.created_at, locale)}>
                                <span>{t("sidebar.created")} {formatDateShort(issue.created_at, locale)}</span>
                            </Tooltip>
                        </div>

                        {issue.updated_at && (
                            <div className="license">
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
                                    <path d="M3 3v5h5"></path>
                                    <path d="M3.05 13A9 9 0 1 0 6 5.3L3 8"></path>
                                    <path d="M12 7v5l4 2"></path>
                                </svg>

                                <Tooltip content={formatDateTimeFull(issue.updated_at, locale)}>
                                    <span>{t("sidebar.updated")} {formatDateShort(issue.updated_at, locale)}</span>
                                </Tooltip>
                            </div>
                        )}

                        <div className="license">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="4" x2="20" y1="9" y2="9"></line>
                                <line x1="4" x2="20" y1="15" y2="15"></line>
                                <line x1="10" x2="8" y1="3" y2="21"></line>
                                <line x1="16" x2="14" y1="3" y2="21"></line>
                            </svg>
                            
                            <span>ID: {issue.id}</span>
                        </div>
                    </div>
                </div>
            </aside>
        </div>
    );
}