"use client";

import React, { useEffect, useRef, useState } from "react";
import { useAuth } from "../providers/AuthProvider";
import axios from "axios";
import { toast } from "react-toastify";
import { useLocale, useTranslations } from "next-intl";
import UserName from "../ui/UserName";
import Link from "next/link";
import { getProjectPathByType } from "@/utils/projectRoutes";

export default function ReportsModerationPage({ authToken, initialReports, initialTotalPages }) {
    const t = useTranslations("ReportsModerationPage");
    const locale = useLocale();
    const { user } = useAuth();

    const [reports, setReports] = useState(initialReports || []);
    const [totalPages, setTotalPages] = useState(initialTotalPages || 1);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("open");
    const [reasonFilter, setReasonFilter] = useState("all");
    const [sort, setSort] = useState("newest");
    const [isStatusPopoverOpen, setIsStatusPopoverOpen] = useState(false);
    const [isReasonPopoverOpen, setIsReasonPopoverOpen] = useState(false);
    const [isSortPopoverOpen, setIsSortPopoverOpen] = useState(false);
    const [decisionLoadingId, setDecisionLoadingId] = useState(null);
    const statusPopoverRef = useRef(null);
    const reasonPopoverRef = useRef(null);
    const sortPopoverRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if(statusPopoverRef.current && !statusPopoverRef.current.contains(event.target)) {
                setIsStatusPopoverOpen(false);
            }
            if(reasonPopoverRef.current && !reasonPopoverRef.current.contains(event.target)) {
                setIsReasonPopoverOpen(false);
            }
            if(sortPopoverRef.current && !sortPopoverRef.current.contains(event.target)) {
                setIsSortPopoverOpen(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    useEffect(() => {
        const fetchReports = async () => {
            try {
                const response = await axios.get(`${process.env.NEXT_PUBLIC_API_BASE}/moderation/reports`, {
                    headers: { Authorization: `Bearer ${authToken}` },
                    params: {
                        page,
                        limit: 20,
                        search,
                        status: statusFilter,
                        reason: reasonFilter,
                        sort,
                    },
                });

                setReports(response.data.reports || []);
                setTotalPages(response.data.totalPages || 1);
            } catch (error) {
                toast.error(t("errors.fetch"));
            }
        };

        const timer = setTimeout(fetchReports, 250);
        return () => clearTimeout(timer);
    }, [authToken, page, reasonFilter, search, sort, statusFilter, t]);

    const handleDecision = async (reportId, nextStatus) => {
        const moderatorNoteInput = prompt(t("actions.notePrompt"));
        if(moderatorNoteInput === null) {
            return;
        }

        const moderatorNote = moderatorNoteInput;

        try {
            setDecisionLoadingId(reportId);
            await axios.post(
                `${process.env.NEXT_PUBLIC_API_BASE}/moderation/reports/${reportId}/decision`,
                { status: nextStatus, moderator_note: moderatorNote },
                { headers: { Authorization: `Bearer ${authToken}` } }
            );

            toast.success(nextStatus === "resolved" ? t("success.resolved") : t("success.dismissed"));

            setReports((prev) => prev.map((item) => (
                item.id === reportId ? {
                    ...item,
                    status: nextStatus,
                    moderator_note: moderatorNote || null,
                    resolved_at: new Date().toISOString(),
                    resolver_username: user?.username || item.resolver_username,
                } : item
            )));
        } catch (error) {
            toast.error(t("errors.decision"));
        } finally {
            setDecisionLoadingId(null);
        }
    };

    const statusOptions = ["open", "resolved", "dismissed", "all"];
    const reasonOptions = ["all", "rules_violation", "spam", "malware", "copyright", "nsfw", "fraud", "other"];
    const sortOptions = ["newest", "oldest"];

    return (
        <>
            <div className="moderation-toolbar">
                <div className="field field--large" style={{ width: "100%", maxWidth: "420px" }}>
                    <label className="field__wrapper" style={{ background: "var(--theme-color-background-content)" }}>
                        <div className="field__wrapper-body">
                            <svg className="icon icon--search field__icon field__icon--left" xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="m21 21-4.34-4.34"></path>
                                <circle cx="11" cy="11" r="8"></circle>
                            </svg>

                            <input className="text-input" type="text" placeholder={t("filters.searchPlaceholder")} value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
                        </div>
                    </label>
                </div>

                <div className="moderation-toolbar__controls">
                    <div className="field field--default blog-settings__input" style={{ width: "220px" }} ref={statusPopoverRef}>
                        <label className="field__wrapper" onClick={() => setIsStatusPopoverOpen((v) => !v)} style={{ cursor: "pointer", background: "var(--theme-color-background-content)" }}>
                            <div className="field__wrapper-body">
                                <div className="select">
                                    <div className="select__selected">
                                        {t(`filters.status.${statusFilter}`)}
                                    </div>
                                </div>
                            </div>
                            
                            <svg style={{ fill: "none" }} className={`icon icon--chevron_down ${isStatusPopoverOpen ? "rotate" : ""}`} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"></path></svg>
                        </label>

                        {isStatusPopoverOpen && (
                            <div className="popover">
                                <div className="context-list">
                                    {statusOptions.map((value) => (
                                        <div key={value} className={`context-list-option ${statusFilter === value ? "context-list-option--selected" : ""}`} onClick={() => { setStatusFilter(value); setPage(1); setIsStatusPopoverOpen(false); }}>
                                            <div className="context-list-option__label">
                                                {t(`filters.status.${value}`)}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="field field--default blog-settings__input" style={{ width: "220px" }} ref={reasonPopoverRef}>
                        <label className="field__wrapper" onClick={() => setIsReasonPopoverOpen((v) => !v)} style={{ cursor: "pointer", background: "var(--theme-color-background-content)" }}>
                            <div className="field__wrapper-body">
                                <div className="select">
                                    <div className="select__selected">
                                        {t(`filters.reasons.${reasonFilter}`)}
                                    </div>
                                </div>
                            </div>

                            <svg style={{ fill: "none" }} className={`icon icon--chevron_down ${isReasonPopoverOpen ? "rotate" : ""}`} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"></path></svg>
                        </label>

                        {isReasonPopoverOpen && (
                            <div className="popover">
                                <div className="context-list" data-scrollable style={{ maxHeight: "240px", overflowY: "auto" }}>
                                    {reasonOptions.map((value) => (
                                        <div key={value} className={`context-list-option ${reasonFilter === value ? "context-list-option--selected" : ""}`} onClick={() => { setReasonFilter(value); setPage(1); setIsReasonPopoverOpen(false); }}>
                                            <div className="context-list-option__label">
                                                {t(`filters.reasons.${value}`)}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="field field--default blog-settings__input" style={{ width: "220px" }} ref={sortPopoverRef}>
                        <label className="field__wrapper" onClick={() => setIsSortPopoverOpen((v) => !v)} style={{ cursor: "pointer", background: "var(--theme-color-background-content)" }}>
                            <div className="field__wrapper-body">
                                <div className="select">
                                    <div className="select__selected">
                                        {t(`filters.sort.${sort}`)}
                                    </div>
                                </div>
                            </div>

                            <svg style={{ fill: "none" }} className={`icon icon--chevron_down ${isSortPopoverOpen ? "rotate" : ""}`} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"></path></svg>
                        </label>

                        {isSortPopoverOpen && (
                            <div className="popover">
                                <div className="context-list">
                                    {sortOptions.map((value) => (
                                        <div key={value} className={`context-list-option ${sort === value ? "context-list-option--selected" : ""}`} onClick={() => { setSort(value); setPage(1); setIsSortPopoverOpen(false); }}>
                                            <div className="context-list-option__label">
                                                {t(`filters.sort.${value}`)}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="content content--padding" style={{ marginBottom: "15px" }}>
                {reports.length === 0 ? (
                    <p>{t("empty")}</p>
                ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                        {reports.map((report) => (
                            <div key={report.id} className="content content--padding" style={{ background: "var(--theme-color-background)", display: "flex", flexDirection: "column", gap: "10px" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", flexWrap: "wrap" }}>
                                    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                                        <Link href={`${getProjectPathByType({ slug: report.project_slug, projectType: report.project_type })}`} style={{ fontWeight: 600 }}>{report.project_title || report.project_slug}</Link>
                                    </div>

                                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                                        <span className="button button--size-s button--type-primary" style={{ pointerEvents: "none" }}>{t(`statuses.${report.status}`)}</span>
                                        <span style={{ color: "var(--theme-color-text-secondary)", fontSize: "14px" }}>
                                            {new Date(report.created_at).toLocaleString(locale)}
                                        </span>
                                    </div>
                                </div>

                                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "10px" }}>
                                    <div>
                                        <div style={{ fontWeight: 500 }}>{t("fields.reason")}</div>
                                        <div>{t(`filters.reasons.${report.reason_code}`)}</div>
                                    </div>

                                    <div>
                                        <div style={{ fontWeight: 500 }}>{t("fields.reporter")}</div>
                                        {report.reporter_username ? (
                                            <Link href={`/user/${report.reporter_slug}`} style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
                                                <img src={report.reporter_avatar || "/images/user/default_ava.png"} alt={report.reporter_username} width="24" height="24" style={{ borderRadius: "6px" }} />
                                                <UserName user={{ username: report.reporter_username, slug: report.reporter_slug, isVerified: 0 }} />
                                            </Link>
                                        ) : (
                                            <span style={{ color: "var(--theme-color-text-secondary)" }}>—</span>
                                        )}
                                    </div>
                                </div>

                                {report.comment && (
                                    <div>
                                        <div style={{ fontWeight: 500 }}>{t("fields.comment")}</div>
                                        <div style={{ whiteSpace: "pre-wrap" }}>{report.comment}</div>
                                    </div>
                                )}

                                {(report.moderator_note || report.resolver_username || report.resolved_at) && (
                                    <div style={{ borderTop: "1px solid var(--theme-color-border, rgba(255,255,255,.08))", paddingTop: "8px" }}>
                                        <div style={{ fontWeight: 500 }}>{t("fields.moderationResult")}</div>
                                        <div style={{ color: "var(--theme-color-text-secondary)", fontSize: "16px" }}>
                                            {report.resolver_username ? t("fields.resolvedBy", { username: report.resolver_username }) : t("fields.noResolver")}
                                            {" · "}
                                            {report.resolved_at ? new Date(report.resolved_at).toLocaleString(locale) : "—"}
                                        </div>
                                        {report.moderator_note && <div style={{ marginTop: "4px", whiteSpace: "pre-wrap" }}>{report.moderator_note}</div>}
                                    </div>
                                )}

                                {report.status === "open" && (
                                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                                        <button className="button button--size-m button--type-positive" disabled={decisionLoadingId === report.id} onClick={() => handleDecision(report.id, "resolved")}>
                                            {t("actions.resolve")}
                                        </button>

                                        <button className="button button--size-m button--type-negative" disabled={decisionLoadingId === report.id} onClick={() => handleDecision(report.id, "dismissed")}>
                                            {t("actions.dismiss")}
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {totalPages > 1 && (
                    <div className="pagination" style={{ marginTop: "20px", alignItems: "center" }}>
                        <button className="button button--size-m button--type-minimal" disabled={page === 1} onClick={() => setPage(page - 1)}>
                            {t("pagination.previous")}
                        </button>
                        
                        <span style={{ margin: "0 10px" }}>
                            {t("pagination.pageOf", { page, totalPages })}
                        </span>
                        
                        <button className="button button--size-m button--type-minimal" disabled={page === totalPages} onClick={() => setPage(page + 1)}>
                            {t("pagination.next")}
                        </button>
                    </div>
                )}
            </div>
        </>
    );
}