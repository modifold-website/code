"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Modal from "react-modal";
import axios from "axios";
import { toast } from "react-toastify";
import { useLocale, useTranslations } from "next-intl";
import { getProjectPath } from "@/utils/projectRoutes";
import { formatRelativeTime } from "@/utils/date/relativeTime";

const statusOptions = ["needs_review", "pending", "scanning", "error", "blocked", "all"];
const sortOptions = ["oldest", "newest"];

const formatBytes = (value) => {
	const bytes = Number(value) || 0;
	if(bytes < 1024) {
		return `${bytes} B`;
	}

	if(bytes < 1024 * 1024) {
		return `${(bytes / 1024).toFixed(1)} KB`;
	}

	return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

const formatDate = (value) => {
	if(!value) {
		return "";
	}

	const date = new Date(value);
	if(Number.isNaN(date.getTime())) {
		return "";
	}

	return date.toLocaleString();
};

const severityOrder = {
	critical: 4,
	severe: 4,
	high: 3,
	medium: 2,
	low: 1,
	info: 0,
};

const getSeverity = (value) => {
	const severity = String(value || "low").toLowerCase();
	return severityOrder[severity] === undefined ? "low" : severity;
};

const getHighestSeverity = (items) => {
	return items
		.map((item) => getSeverity(item.severity))
		.sort((a, b) => (severityOrder[b] || 0) - (severityOrder[a] || 0))[0] || "low";
};

const getFileNameFromUrl = (value) => {
	if(!value) {
		return "";
	}

	try {
		const url = new URL(value);
		return decodeURIComponent(url.pathname.split("/").filter(Boolean).pop() || "");
	} catch {
		return String(value).split("/").filter(Boolean).pop() || "";
	}
};

const getFindingSource = (finding) => {
	return String(finding?.source || finding?.file || finding?.path || finding?.class || finding?.class_name || "").trim();
};

const normalizeFindingMessage = (finding) => {
	if(typeof finding === "string") {
		return finding;
	}

	return String(finding?.message || finding?.reason || finding?.type || "").trim();
};

const formatFindingType = (value) => {
	return String(value || "suspicious pattern").replace(/_/g, " ").toUpperCase();
};

const ARGUS_PASSED_MESSAGE = "Argus security worker did not find suspicious signals";

const normalizeArgusSignals = (report) => {
	if(!report || typeof report !== "object") {
		return [];
	}

	if(Array.isArray(report.findings)) {
		return report.findings.map((finding) => {
			if(typeof finding === "string") {
				return {
					message: finding,
					severity: "low",
					type: "",
					source: "",
					excerpt: "",
					isPassed: finding === ARGUS_PASSED_MESSAGE,
				};
			}

			const message = normalizeFindingMessage(finding);
			return {
				message,
				severity: getSeverity(finding?.severity),
				type: String(finding?.type || "").trim(),
				source: getFindingSource(finding),
				excerpt: String(finding?.excerpt || finding?.code || "").trim(),
				isPassed: finding?.type === "passed" || message === ARGUS_PASSED_MESSAGE,
			};
		}).filter((finding) => finding.message);
	}

	if(Array.isArray(report.reasons)) {
		return report.reasons.map((reason) => {
			const message = String(reason || "").trim();
			return {
				message,
				severity: "low",
				type: "",
				source: "",
				excerpt: "",
				isPassed: message === ARGUS_PASSED_MESSAGE,
			};
		}).filter((finding) => finding.message);
	}

	return [];
};

const buildReviewGroups = (signals) => {
	const flaggedSignals = signals.filter((signal) => !signal.isPassed);
	const groupsMap = new Map();

	flaggedSignals.forEach((signal, index) => {
		const source = signal.source || signal.message || `finding-${index + 1}`;

		if(!groupsMap.has(source)) {
			groupsMap.set(source, {
				source,
				flags: [],
			});
		}

		groupsMap.get(source).flags.push(signal);
	});

	return [...groupsMap.values()];
};

const getArgusThreadMessage = (version, signals) => {
	const flaggedSignal = signals.find((signal) => !signal.isPassed);
	const passedSignal = signals.find((signal) => signal.isPassed);

	return version.moderation_reason || flaggedSignal?.message || passedSignal?.message || "";
};

export default function TechnicalReviewPage({ authToken, initialVersions, initialTotalPages }) {
	const t = useTranslations("TechnicalReviewPage");
	const tModeration = useTranslations("ModerationPage");
	const locale = useLocale();
	const [versions, setVersions] = useState(initialVersions || []);
	const [totalPages, setTotalPages] = useState(initialTotalPages || 1);
	const [searchInput, setSearchInput] = useState("");
	const [search, setSearch] = useState("");
	const [status, setStatus] = useState("needs_review");
	const [sort, setSort] = useState("oldest");
	const [page, setPage] = useState(1);
	const [blockingVersion, setBlockingVersion] = useState(null);
	const [blockReason, setBlockReason] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [isStatusPopoverOpen, setIsStatusPopoverOpen] = useState(false);
	const [isSortPopoverOpen, setIsSortPopoverOpen] = useState(false);
	const [reviewTabs, setReviewTabs] = useState({});
	const [selectedReviewFiles, setSelectedReviewFiles] = useState({});
	const [expandedThreads, setExpandedThreads] = useState({});
	const statusPopoverRef = useRef(null);
	const sortPopoverRef = useRef(null);

	useEffect(() => {
		Modal.setAppElement("body");
	}, []);

	useEffect(() => {
		const handleClickOutside = (event) => {
			if(statusPopoverRef.current && !statusPopoverRef.current.contains(event.target)) {
				setIsStatusPopoverOpen(false);
			}

			if(sortPopoverRef.current && !sortPopoverRef.current.contains(event.target)) {
				setIsSortPopoverOpen(false);
			}
		};

		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, []);

	useEffect(() => {
		const timer = setTimeout(() => {
			if(search !== searchInput) {
				setPage(1);
				setSearch(searchInput);
			}
		}, 350);

		return () => clearTimeout(timer);
	}, [searchInput, search]);

	useEffect(() => {
		const fetchVersions = async () => {
			try {
				const response = await axios.get(`${process.env.NEXT_PUBLIC_API_BASE}/moderation/technical-review`, {
					headers: { Authorization: `Bearer ${authToken}` },
					params: {
						search: search || undefined,
						status,
						sort,
						page,
						limit: 20,
					},
				});

				setVersions(response.data.versions || []);
				setTotalPages(response.data.totalPages || 1);
			} catch (error) {
				toast.error(t("errors.fetch"));
			}
		};

		fetchVersions();
	}, [authToken, page, search, sort, status, t]);

	const sortedStatusOptions = useMemo(() => statusOptions, []);
	const statusLabel = t(`statuses.${status}`);
	const sortLabel = t(`filters.sort.${sort}`);

	const handleStatusSelect = (selectedStatus) => {
		setStatus(selectedStatus);
		setIsStatusPopoverOpen(false);
		setPage(1);
	};

	const handleSortSelect = (selectedSort) => {
		setSort(selectedSort);
		setIsSortPopoverOpen(false);
		setPage(1);
	};

	const getReviewTab = (versionId) => reviewTabs[versionId] || "thread";

	const setReviewTab = (versionId, tab) => {
		setReviewTabs((current) => ({
			...current,
			[versionId]: tab,
		}));

		if(tab === "thread") {
			setExpandedThreads((current) => ({
				...current,
				[versionId]: true,
			}));
		}
	};

	const selectReviewFile = (versionId) => {
		setSelectedReviewFiles((current) => ({
			...current,
			[versionId]: true,
		}));
		setReviewTab(versionId, "file");
	};

	const toggleThread = (versionId) => {
		setExpandedThreads((current) => ({
			...current,
			[versionId]: !current[versionId],
		}));
	};

	const submitDecision = async (version, decision, reason = "") => {
		setIsSubmitting(true);

		try {
			await axios.post(
				`${process.env.NEXT_PUBLIC_API_BASE}/moderation/technical-review/${version.id}/decision`,
				{ decision, reason },
				{ headers: { Authorization: `Bearer ${authToken}` } }
			);

			toast.success(decision === "approved" ? t("success.approved") : t("success.blocked"));
			setVersions((current) => current.filter((item) => item.id !== version.id));
			setBlockingVersion(null);
			setBlockReason("");
		} catch (error) {
			toast.error(t("errors.decision"));
		} finally {
			setIsSubmitting(false);
		}
	};

	const openBlockModal = (version) => {
		setBlockingVersion(version);
		setBlockReason(version.moderation_reason || "");
	};

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

							<input
								placeholder={t("filters.searchPlaceholder")}
								className="text-input"
								type="text"
								value={searchInput}
								onChange={(event) => setSearchInput(event.target.value)}
							/>
						</div>
					</label>
				</div>

				<div className="moderation-toolbar__controls">
					<div className="field field--default blog-settings__input" style={{ width: "200px" }} ref={statusPopoverRef}>
						<label className="field__wrapper" onClick={() => setIsStatusPopoverOpen(!isStatusPopoverOpen)} style={{ cursor: "pointer", background: "var(--theme-color-background-content)" }}>
							<div className="field__wrapper-body">
								<div className="select">
									<div className="select__selected">{statusLabel}</div>
								</div>
							</div>

							<svg style={{ fill: "none" }} className={`icon icon--chevron_down ${isStatusPopoverOpen ? "rotate" : ""}`} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"></path></svg>
						</label>

						{isStatusPopoverOpen && (
							<div className="popover">
								<div className="context-list" data-scrollable style={{ maxHeight: "200px", overflowY: "auto" }}>
									{sortedStatusOptions.map((option) => (
										<div key={option} className={`context-list-option ${status === option ? "context-list-option--selected" : ""}`} onClick={() => handleStatusSelect(option)}>
											<div className="context-list-option__label">{t(`statuses.${option}`)}</div>
										</div>
									))}
								</div>
							</div>
						)}
					</div>

					<div className="field field--default blog-settings__input" style={{ width: "200px" }} ref={sortPopoverRef}>
						<label className="field__wrapper" onClick={() => setIsSortPopoverOpen(!isSortPopoverOpen)} style={{ cursor: "pointer", background: "var(--theme-color-background-content)" }}>
							<div className="field__wrapper-body">
								<div className="select">
									<div className="select__selected">{sortLabel}</div>
								</div>
							</div>

							<svg style={{ fill: "none" }} className={`icon icon--chevron_down ${isSortPopoverOpen ? "rotate" : ""}`} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"></path></svg>
						</label>

						{isSortPopoverOpen && (
							<div className="popover">
								<div className="context-list" data-scrollable style={{ maxHeight: "200px", overflowY: "auto" }}>
									{sortOptions.map((option) => (
										<div key={option} className={`context-list-option ${sort === option ? "context-list-option--selected" : ""}`} onClick={() => handleSortSelect(option)}>
											<div className="context-list-option__label">{t(`filters.sort.${option}`)}</div>
										</div>
									))}
								</div>
							</div>
						)}
					</div>
				</div>
			</div>

			{versions.length === 0 ? (
				<div className="content content--padding">
					<p>{t("empty")}</p>
				</div>
			) : (
				<div className="browse-project-list">
					{versions.map((version) => {
						const project = {
							project_type: version.project_type,
							slug: version.project_slug,
						};
						const report = version.argus_report || {};
						const argusSignals = normalizeArgusSignals(report);
						const reviewGroups = buildReviewGroups(argusSignals);
						const highestSeverity = getHighestSeverity(argusSignals);
						const fileName = report.file_name || getFileNameFromUrl(version.file_url) || version.version_number;
						const activeReviewTab = getReviewTab(version.id);
						const hasSelectedFile = Boolean(selectedReviewFiles[version.id]);
						const isThreadExpanded = Boolean(expandedThreads[version.id]);
						const argusThreadMessage = getArgusThreadMessage(version, argusSignals);
						const relativeDate = formatRelativeTime(version.created_at, locale);

						return (
							<div key={version.id} className="new-project-card technical-review-card">
								<div className="technical-review-card__header">
									<Link href={getProjectPath(project)} target="_blank" rel="noreferrer" tabIndex={-1} className="technical-review-card__icon-link">
										<img className="new-project-icon" alt={version.project_title} src={version.project_icon_url} />
									</Link>

									<div className="technical-review-card__summary">
										<div className="technical-review-card__title-row">
											<Link href={getProjectPath(project)} target="_blank" rel="noreferrer" className="technical-review-card__project">
												{version.project_title}
											</Link>

											<span className="moderation-card-pill">
												<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/>
                                                    <path d="m3.3 7 8.7 5 8.7-5"/>
                                                    <path d="M12 22V12"/>
                                                </svg>

												<span>{tModeration(`filters.types.${version.project_type}`)}</span>
											</span>

											<div className="technical-review-card__version">{version.version_number}</div>

											<div className="technical-review-card__badges">
												<span className={`technical-review-badge technical-review-badge--status-${version.moderation_status}`}>
													{t(`statuses.${version.moderation_status}`)}
												</span>

												<span className={`technical-review-badge technical-review-badge--severity-${highestSeverity}`}>
													{t(`severity.${highestSeverity}`)}
												</span>
											</div>
										</div>

										<div className="technical-review-card__meta">
											{version.owner_username ? <Link href={`/user/${version.owner_slug || version.owner_username}`} target="_blank" rel="noreferrer" className="technical-review-card__owner">{version.owner_username}</Link> : null}
											
											<span>{fileName} · {formatBytes(version.file_size)}</span>
											
											{version.scan_requested_at && <span>{t("fields.scanRequested")}: {formatDate(version.scan_requested_at)}</span>}
										</div>
									</div>

									<div className="technical-review-card__actions">
										{relativeDate ? <time className="technical-review-card__date" dateTime={version.created_at} title={formatDate(version.created_at)}>{relativeDate}</time> : null}

										<button className="technical-review-card__icon-action" type="button" onClick={() => navigator.clipboard?.writeText(version.project_id)} aria-label="Copy project ID" title="Copy project ID">
											<svg viewBox="0 0 24 24" aria-hidden="true">
												<rect width="14" height="14" x="8" y="8" rx="2" ry="2"></rect>
												<path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"></path>
											</svg>
										</button>

										<Link className="technical-review-card__icon-action" href={getProjectPath(project)} target="_blank" rel="noreferrer" aria-label="Open in new tab" title="Open in new tab">
											<svg viewBox="0 0 24 24" aria-hidden="true">
												<path d="M15 3h6v6"></path>
												<path d="M10 14 21 3"></path>
												<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
											</svg>
										</Link>
									</div>
								</div>

								<div className="technical-review-tabs-bar">
									<div className="technical-review-tabs" role="tablist" aria-label="Technical review sections">
										<button type="button" role="tab" aria-selected={activeReviewTab === "thread"} className={activeReviewTab === "thread" ? "technical-review-tabs__active" : ""} onClick={() => setReviewTab(version.id, "thread")}>
											{t("tabs.thread")}
										</button>

										<button type="button" role="tab" aria-selected={activeReviewTab === "files"} className={activeReviewTab === "files" ? "technical-review-tabs__active" : ""} onClick={() => setReviewTab(version.id, "files")}>
											{t("tabs.files")}
										</button>

										{hasSelectedFile && (
											<button type="button" role="tab" aria-selected={activeReviewTab === "file"} className={activeReviewTab === "file" ? "technical-review-tabs__active" : ""} onClick={() => setReviewTab(version.id, "file")}>
												{fileName}
											</button>
										)}
									</div>

									{hasSelectedFile && (
										<div className="technical-review-tabs-bar__actions">
											<a className="button button--size-m button--type-minimal button--with-icon" href={version.file_url} target="_blank" rel="noreferrer" download={fileName} aria-label={t("actions.download")} title={t("actions.download")}>
												<svg viewBox="0 0 24 24" aria-hidden="true">
													<path d="M12 3v12"></path>
													<path d="m7 10 5 5 5-5"></path>
													<path d="M5 21h14"></path>
												</svg>
											</a>

											<a className="button button--size-m button--type-minimal button--with-icon" href={version.file_url} target="_blank" rel="noreferrer">
												<svg viewBox="0 0 24 24" aria-hidden="true">
													<path d="M15 3h6v6"></path>
													<path d="M10 14 21 3"></path>
													<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
												</svg>
												Open
											</a>
										</div>
									)}
								</div>

								<div className="technical-review-card__body">
									{activeReviewTab === "thread" && (
										<div className={`technical-review-thread-region ${isThreadExpanded ? "technical-review-thread-region--open" : ""}`}>
											<div className="technical-review-thread-region__content">
												<div className="technical-review-thread">
													<div className="technical-review-thread__message">
														{t("fields.argusNotice", { message: argusThreadMessage || t("fields.noArgusSummary") })}
													</div>

													<div className="technical-review-thread__actions">
														<button className="button button--size-m button--type-positive" type="button" onClick={() => submitDecision(version, "approved")} disabled={isSubmitting}>
															{t("actions.approve")}
														</button>

														<button className="button button--size-m button--type-negative" type="button" onClick={() => openBlockModal(version)} disabled={isSubmitting}>
															{t("actions.block")}
														</button>
													</div>
												</div>
											</div>

											{!isThreadExpanded && <div className="technical-review-thread-region__gradient" aria-hidden="true"></div>}

											<button className="technical-review-thread-region__toggle" type="button" onClick={() => toggleThread(version.id)}>
												{isThreadExpanded ? "Collapse thread" : "Expand"}
											</button>
										</div>
									)}

									{activeReviewTab === "files" && (
										<div className="technical-review-files">
											<div className="technical-review-file-row">
												<div className="technical-review-file-row__main">
													<button className={`technical-review-file-row__name ${reviewGroups.length > 0 ? "technical-review-file-row__name--clickable" : ""}`} type="button" onClick={() => reviewGroups.length > 0 && selectReviewFile(version.id)} disabled={reviewGroups.length === 0}>
														{fileName}
													</button>

													<span className="technical-review-pill">{formatBytes(version.file_size)}</span>

													{reviewGroups.length > 0 ? (
														<>
															<span className={`technical-review-badge technical-review-badge--severity-${highestSeverity}`}>
																{t(`severity.${highestSeverity}`)}
															</span>
															<span className="technical-review-badge technical-review-badge--flags-open">0/{argusSignals.filter((signal) => !signal.isPassed).length} flags</span>
														</>
													) : (
														<span className="technical-review-badge technical-review-badge--flags-done">No flags</span>
													)}
												</div>

												<div className="technical-review-file-row__actions">
													{reviewGroups.length > 0 && (
														<button className="button button--size-m" type="button" onClick={() => selectReviewFile(version.id)}>Flags</button>
													)}

													<a className="button button--size-m button--type-minimal button--with-icon" href={version.file_url} target="_blank" rel="noreferrer" download={fileName} aria-label={t("actions.download")} title={t("actions.download")}>
														<svg viewBox="0 0 24 24" aria-hidden="true">
															<path d="M12 3v12"></path>
															<path d="m7 10 5 5 5-5"></path>
															<path d="M5 21h14"></path>
														</svg>
													</a>

													<a className="button button--size-m button--type-minimal button--with-icon" href={version.file_url} target="_blank" rel="noreferrer">
														<svg viewBox="0 0 24 24" aria-hidden="true">
															<path d="M15 3h6v6"></path>
															<path d="M10 14 21 3"></path>
															<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
														</svg>
														Open
													</a>
												</div>
											</div>
										</div>
									)}

									{activeReviewTab === "file" && (
										<>
											{reviewGroups.length === 0 ? (
												<div className="technical-review-empty-flags">{t("fields.noFlags")}</div>
											) : (
												reviewGroups.map((group) => (
													<details key={group.source} className="technical-review-class">
														<summary className="technical-review-class__summary">
															<span className="technical-review-class__chevron" aria-hidden="true">
																<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
																	<path d="m6 9 6 6 6-6"></path>
																</svg>
															</span>

															<code className="technical-review-class__path">{group.source}</code>
															<span className={`technical-review-badge technical-review-badge--severity-${getHighestSeverity(group.flags)}`}>
																{t(`severity.${getHighestSeverity(group.flags)}`)}
															</span>
															<span className="technical-review-badge technical-review-badge--flags-open">0/{group.flags.length} flags</span>
														</summary>

														<div className="technical-review-class__details">
															{group.flags.map((flag) => (
																<div key={`${group.source}-${flag.type}-${flag.message}`} className="technical-review-finding">
																	<div className="technical-review-finding__header">
																		<div>
																	<div className="technical-review-finding__title">
																		{formatFindingType(flag.type)}
																		<span className={`technical-review-badge technical-review-badge--severity-${getSeverity(flag.severity)}`}>
																			{t(`severity.${getSeverity(flag.severity)}`)}
																		</span>
																	</div>

																			<div className="technical-review-finding__reason">
																				{flag.message}
																			</div>
																		</div>
																	</div>

																	{flag.excerpt && (
																		<div className="technical-review-code">
																			<div className="technical-review-code__line">1</div>
																			<pre><code>{flag.excerpt}</code></pre>
																			<button className="technical-review-code__copy" type="button" onClick={() => navigator.clipboard?.writeText(flag.excerpt)} aria-label={t("actions.copyCode")}>
																				<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
																					<rect width="14" height="14" x="8" y="8" rx="2" ry="2"></rect>
																					<path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"></path>
																				</svg>
																			</button>
																		</div>
																	)}
																</div>
															))}
														</div>
													</details>
												))
											)}
										</>
									)}
								</div>
							</div>
						);
					})}
				</div>
			)}

			{totalPages > 1 && (
				<div className="pagination" style={{ marginTop: "20px", textAlign: "center" }}>
					<button className="button button--size-m" type="button" disabled={page === 1} onClick={() => setPage(page - 1)}>
						{t("pagination.previous")}
					</button>

					<span style={{ margin: "0 10px" }}>{t("pagination.pageOf", { page, totalPages })}</span>

					<button className="button button--size-m" type="button" disabled={page === totalPages} onClick={() => setPage(page + 1)}>
						{t("pagination.next")}
					</button>
				</div>
			)}

			<Modal closeTimeoutMS={150} isOpen={Boolean(blockingVersion)} onRequestClose={() => setBlockingVersion(null)} className="modal active" overlayClassName="modal-overlay">
				<div className="modal-window">
					<div className="modal-window__header">
						<span style={{ fontSize: "18px", fontWeight: "500" }}>{t("modal.title")}</span>
						<button className="icon-button modal-window__close" type="button" onClick={() => setBlockingVersion(null)} disabled={isSubmitting} aria-label={t("modal.close")}>
							<svg className="icon icon--x" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
								<path d="M18 6 6 18"></path>
								<path d="m6 6 12 12"></path>
							</svg>
						</button>
					</div>

					<div className="modal-window__content">
						<p className="blog-settings__field-title" style={{ marginBottom: "4px" }}>{t("modal.reason")}</p>
						<p style={{ marginBottom: "8px", color: "var(--theme-color-text-secondary)" }}>{t("modal.reasonPlaceholder")}</p>
						
						<div className="field field--default textarea">
							<label className="field__wrapper">
								<textarea
									name="reason"
									placeholder={t("modal.reasonPlaceholder")}
									className="autosize textarea__input"
									required
									minLength={30}
									maxLength={256}
									style={{ height: "128px" }}
									value={blockReason}
									onChange={(event) => setBlockReason(event.target.value)}
								/>
							</label>
						</div>

						<div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "16px" }}>
							<button className="button button--size-m button--type-minimal" type="button" onClick={() => setBlockingVersion(null)} disabled={isSubmitting}>
								{t("modal.cancel")}
							</button>

							<button className="button button--size-m button--type-primary" type="button" onClick={() => blockingVersion && submitDecision(blockingVersion, "blocked", blockReason)} disabled={isSubmitting || blockReason.trim().length < 30}>
								{t("modal.confirm")}
							</button>
						</div>
					</div>
				</div>
			</Modal>
		</>
	);
}