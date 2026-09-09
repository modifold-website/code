"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Modal from "react-modal";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import Link from "next/link";
import Tooltip from "@/components/ui/Tooltip";
import { getProjectPathByType } from "@/utils/projectRoutes";

import { getCurseForgeImport, prepareCurseForgeProfile, prepareCurseForgeProjects, retryCurseForgeImportItem, startCurseForgeImport, verifyCurseForgeImport } from "@/utils/imports/curseForge";

const TERMINAL_STATUSES = new Set(["completed", "partial", "failed"]);
const MAX_PROJECTS_PER_IMPORT = 10;

const getErrorMessage = (error, fallback) => error?.response?.data?.message || fallback;

const getCurseForgeUrlStatus = (value, expectedType) => {
	if(!value.trim()) return "empty";

	try {
		const url = new URL(value.trim());
		const hostname = url.hostname.replace(/^www\./, "").toLowerCase();
		if(url.protocol !== "https:" || !["curseforge.com", "legacy.curseforge.com"].includes(hostname)) return "invalid";

		const parts = url.pathname.split("/").filter(Boolean);
		if(expectedType === "profile") {
			const memberIndex = parts.findIndex((part) => part.toLowerCase() === "members");
			return memberIndex >= 0 && parts[memberIndex + 1] ? "valid" : "invalid";
		}

		return parts[0]?.toLowerCase() === "hytale" && parts.length >= 3 ? "valid" : "invalid";
	} catch {
		return "invalid";
	}
};

export default function CurseForgeImportModal({ isOpen, authToken, onBack, onRequestClose }) {
	const t = useTranslations("CurseForgeImportModal");
	const router = useRouter();
	const queryClient = useQueryClient();
	const [method, setMethod] = useState("profile");
	const [phase, setPhase] = useState("source");
	const [profileUrl, setProfileUrl] = useState("");
	const [projectUrls, setProjectUrls] = useState([""]);
	const [session, setSession] = useState(null);
	const [verificationCode, setVerificationCode] = useState("");
	const [selectedIds, setSelectedIds] = useState(() => new Set());
	const [rejectedLinks, setRejectedLinks] = useState([]);
	const [verificationStatuses, setVerificationStatuses] = useState({});
	const [codeCopied, setCodeCopied] = useState(false);
	const [verificationExpiresAt, setVerificationExpiresAt] = useState(null);
	const [verificationNow, setVerificationNow] = useState(() => Date.now());
	const [retryingItemId, setRetryingItemId] = useState(null);
	const [loading, setLoading] = useState(false);
	const contentRef = useRef(null);
	const linkListRef = useRef(null);
	const projectListRef = useRef(null);

	const progressQuery = useQuery({
		queryKey: ["curseforge-import", session?.id],
		queryFn: () => getCurseForgeImport({ authToken, importId: session.id }),
		enabled: Boolean(isOpen && session?.id && phase === "progress"),
		refetchInterval: (query) => TERMINAL_STATUSES.has(query.state.data?.status) ? false : 5000,
		refetchIntervalInBackground: false,
	});
	const currentSession = progressQuery.data || session;
	const sessionItems = Array.isArray(session?.items) ? session.items : [];
	const selectableItems = sessionItems.filter((item) => !item.alreadyImported);
	const selectedCount = selectableItems.reduce((count, item) => count + Number(selectedIds.has(item.curseforgeProjectId)), 0);
	const selectableCount = Math.min(selectableItems.length, MAX_PROJECTS_PER_IMPORT);
	const isAllSelected = selectableCount > 0 && selectedCount === selectableCount;
	const profileUrlStatus = getCurseForgeUrlStatus(profileUrl, "profile");
	const projectUrlStatuses = projectUrls.map((url) => getCurseForgeUrlStatus(url, "project"));
	const areProjectUrlsValid = projectUrlStatuses.length > 0 && projectUrlStatuses.every((status) => status === "valid");
	const isFinished = TERMINAL_STATUSES.has(currentSession?.status);
	const verificationRemainingMinutes = verificationExpiresAt ? Math.max(0, Math.ceil((verificationExpiresAt - verificationNow) / 60000)) : 0;
	const verificationExpiryLabel = verificationRemainingMinutes > 0
		? t("verification.expiresIn", { minutes: verificationRemainingMinutes })
		: t("verification.expired");
	const overallProgress = useMemo(() => {
		const items = (currentSession?.items || []).filter((item) => item.selected);
		if(!items.length) return 0;
		return Math.round(items.reduce((total, item) => total + Number(item.progress || 0), 0) / items.length);
	}, [currentSession]);
	const updateListFade = useCallback((list) => {
		if(!list) return;

		const canScrollTop = list.scrollTop > 1;
		const canScrollBottom = list.scrollTop + list.clientHeight < list.scrollHeight - 1;

		list.style.setProperty("--_top-fade-height", canScrollTop ? "var(--_fade-height)" : "0px");
		list.style.setProperty("--_bottom-fade-height", canScrollBottom ? "var(--_fade-height)" : "0px");
	}, []);
	const updateLinkListFade = useCallback(() => updateListFade(linkListRef.current), [updateListFade]);
	const updateProjectListFade = useCallback(() => updateListFade(projectListRef.current), [updateListFade]);

	useEffect(() => {
		if(isOpen && phase === "source" && method === "links") updateLinkListFade();
	}, [isOpen, method, phase, projectUrls.length, updateLinkListFade]);

	useEffect(() => {
		if(isOpen && phase === "selection") updateProjectListFade();
	}, [isOpen, phase, sessionItems.length, updateProjectListFade]);

	useEffect(() => {
		if(!codeCopied) return undefined;
		const timeout = window.setTimeout(() => setCodeCopied(false), 3000);
		return () => window.clearTimeout(timeout);
	}, [codeCopied]);

	useEffect(() => {
		if(!isOpen || phase !== "verification" || !verificationExpiresAt) return undefined;
		const interval = window.setInterval(() => setVerificationNow(Date.now()), 30000);
		return () => window.clearInterval(interval);
	}, [isOpen, phase, verificationExpiresAt]);

	const selectAll = (items) => setSelectedIds(new Set(items
		.filter((item) => !item.alreadyImported)
		.slice(0, MAX_PROJECTS_PER_IMPORT)
		.map((item) => item.curseforgeProjectId)));
	const updateVerificationExpiration = (data) => {
		const now = Date.now();
		setVerificationNow(now);
		setVerificationExpiresAt(now + Math.max(0, Number(data.expiresInSeconds ?? 30 * 60)) * 1000);
	};

	const changePhase = (nextPhase) => {
		contentRef.current?.scrollTo({ top: 0 });
		setPhase(nextPhase);
	};

	const handleProgressClose = () => {
		onRequestClose();
		if(isFinished) router.push("/dashboard");
	};

	const handleProfilePrepare = async (event) => {
		event.preventDefault();
		setLoading(true);

		try {
			const data = await prepareCurseForgeProfile({ authToken, profileUrl });
			setSession(data);
			setVerificationCode(data.verificationCode);
			setCodeCopied(false);
			updateVerificationExpiration(data);
			changePhase("verification");
		} catch(error) {
			toast.error(getErrorMessage(error, t("errors.prepare")));
		} finally {
			setLoading(false);
		}
	};

	const handleLinksPrepare = async (event) => {
		event.preventDefault();
		setLoading(true);

		try {
			const data = await prepareCurseForgeProjects({ authToken, projectUrls: projectUrls.filter((url) => url.trim()) });
			setSession(data);
			setVerificationCode(data.verificationCode);
			setRejectedLinks(data.rejected || []);
			setVerificationStatuses(Object.fromEntries((data.items || []).map((item) => [item.curseforgeProjectId, "pending"])));
			setCodeCopied(false);
			updateVerificationExpiration(data);
			selectAll(data.items || []);
			changePhase("verification");
		} catch(error) {
			toast.error(getErrorMessage(error, t("errors.prepare")));
		} finally {
			setLoading(false);
		}
	};

	const handleVerify = async () => {
		setLoading(true);

		if(method === "links") {
			setVerificationStatuses(Object.fromEntries((session.items || []).map((item) => [item.curseforgeProjectId, "pending"])));
		}

		try {
			const data = await verifyCurseForgeImport({ authToken, importId: session.id, code: verificationCode });
			setSession((current) => ({ ...current, ...data }));
			selectAll(data.items || []);
			changePhase("selection");
		} catch(error) {
			const unverifiedProjects = error?.response?.data?.unverifiedProjects;
			if(method === "links" && Array.isArray(unverifiedProjects)) {
				const unverifiedNames = new Set(unverifiedProjects.map((name) => String(name).toLowerCase()));
				setVerificationStatuses(Object.fromEntries(session.items.map((item) => [
					item.curseforgeProjectId,
					unverifiedNames.has(String(item.name).toLowerCase()) ? "missing" : "verified",
				])));
			}

			toast.error(getErrorMessage(error, t("errors.verify")));
		} finally {
			setLoading(false);
		}
	};

	const handleCopyVerificationCode = async () => {
		try {
			await navigator.clipboard.writeText(verificationCode);
			setCodeCopied(true);
		} catch {
			toast.error(t("verification.copyError"));
		}
	};

	const handleStart = async () => {
		setLoading(true);

		try {
			const projectIds = sessionItems.filter((item) => selectedIds.has(item.curseforgeProjectId)).map((item) => item.curseforgeProjectId);
			const data = await startCurseForgeImport({ authToken, importId: session.id, projectIds });
			setSession((current) => ({ ...current, ...data }));
			changePhase("progress");
		} catch(error) {
			toast.error(getErrorMessage(error, t("errors.start")));
		} finally {
			setLoading(false);
		}
	};

	const handleRetryItem = async (itemId) => {
		setRetryingItemId(itemId);

		try {
			const data = await retryCurseForgeImportItem({ authToken, importId: session.id, itemId });
			setSession((current) => ({ ...current, ...data }));
			queryClient.setQueryData(["curseforge-import", session.id], data);
		} catch(error) {
			toast.error(getErrorMessage(error, t("errors.retry")));
		} finally {
			setRetryingItemId(null);
		}
	};

	const updateProjectUrl = (index, value) => {
		setProjectUrls((current) => current.map((url, itemIndex) => itemIndex === index ? value : url));
	};

	const removeProjectUrl = (index) => {
		setProjectUrls((current) => current.filter((_, itemIndex) => itemIndex !== index));
	};

	const toggleProject = (projectId) => {
		if(!selectedIds.has(projectId) && selectedIds.size >= MAX_PROJECTS_PER_IMPORT) {
			toast.info(t("selection.limitReached", { limit: MAX_PROJECTS_PER_IMPORT }));
			return;
		}

		setSelectedIds((current) => {
			const next = new Set(current);
			if(next.has(projectId)) next.delete(projectId);
			else next.add(projectId);
			return next;
		});
	};

	const renderSource = () => (
		<>
			<div className="technical-review-tabs curseforge-import__methods" role="tablist" aria-label={t("methodLabel")} data-active-tab={method}>
				<button type="button" role="tab" aria-selected={method === "profile"} className={method === "profile" ? "technical-review-tabs__active" : ""} onClick={() => setMethod("profile")}>
					{t("methods.profile")}
				</button>
				
				<button type="button" role="tab" aria-selected={method === "links"} className={method === "links" ? "technical-review-tabs__active" : ""} onClick={() => setMethod("links")}>
					{t("methods.links")}
				</button>
			</div>

			{method === "profile" ? (
				<form className="curseforge-import__form" onSubmit={handleProfilePrepare}>
					<div>
						<p className="blog-settings__field-title">{t("profile.title")}</p>
						<p style={{ color: "var(--theme-color-text-secondary)" }}>{t("profile.hint")}</p>
					</div>

					<label className="field field--default">
						<span className="field__wrapper">
							<input className="text-input" type="url" value={profileUrl} onChange={(event) => setProfileUrl(event.target.value)} placeholder={t("profile.placeholder")} aria-label={t("profile.title")} required disabled={loading} />

							{profileUrlStatus !== "empty" ? (
								<Tooltip content={t(`validation.${profileUrlStatus === "valid" ? "validProfile" : "invalidProfile"}`)} delay={200}>
									<span className={`curseforge-import__input-status curseforge-import__input-status--${profileUrlStatus}`} tabIndex={0} aria-label={t(`validation.${profileUrlStatus === "valid" ? "validProfile" : "invalidProfile"}`)}>
										{profileUrlStatus === "valid" ? (
											<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
												<path d="m20 6-11 11-5-5" />
											</svg>
										) : (
											<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
												<circle cx="12" cy="12" r="10" />
												<path d="m15 9-6 6M9 9l6 6" />
											</svg>
										)}
									</span>
								</Tooltip>
							) : null}
						</span>
					</label>

					<div className="curseforge-import__actions">
						<button className="button button--size-m button--type-primary" type="submit" disabled={loading || profileUrlStatus !== "valid"}>
							{loading ? t("checking") : t("continue")}
						</button>
					</div>
				</form>
			) : (
				<form className="curseforge-import__form" onSubmit={handleLinksPrepare}>
					<div>
						<p className="blog-settings__field-title">{t("links.title")}</p>
						<p style={{ color: "var(--theme-color-text-secondary)" }}>{t("links.hint", { limit: MAX_PROJECTS_PER_IMPORT })}</p>
					</div>

					<div ref={linkListRef} className="curseforge-import__link-fields curseforge-import__scrollable-list" onScroll={updateLinkListFade}>
						{projectUrls.map((url, index) => (
							<div className="curseforge-import__link-row" key={index}>
								<label className="field field--default">
									<span className="field__wrapper">
										<input className="text-input" type="url" value={url} onChange={(event) => updateProjectUrl(index, event.target.value)} placeholder={t("links.placeholder")} aria-label={`${t("links.title")} ${index + 1}`} required disabled={loading} />

										{projectUrlStatuses[index] !== "empty" ? (
											<Tooltip content={t(`validation.${projectUrlStatuses[index] === "valid" ? "validProject" : "invalidProject"}`)} delay={200}>
												<span className={`curseforge-import__input-status curseforge-import__input-status--${projectUrlStatuses[index]}`} tabIndex={0} aria-label={t(`validation.${projectUrlStatuses[index] === "valid" ? "validProject" : "invalidProject"}`)}>
													{projectUrlStatuses[index] === "valid" ? (
														<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
															<path d="m20 6-11 11-5-5" />
														</svg>
													) : (
														<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
															<circle cx="12" cy="12" r="10" />
															<path d="m15 9-6 6M9 9l6 6" />
														</svg>
													)}
												</span>
											</Tooltip>
										) : null}
									</span>
								</label>

								{projectUrls.length > 1 ? (
									<button className="icon-button curseforge-import__remove" type="button" onClick={() => removeProjectUrl(index)} aria-label={t("links.remove")} disabled={loading}>
										<svg className="icon icon--cross" height="24" width="24" aria-hidden="true">
											<path fillRule="evenodd" clipRule="evenodd" d="M5.293 5.293a1 1 0 0 1 1.414 0L12 10.586l5.293-5.293a1 1 0 0 1 1.414 1.414L13.414 12l5.293 5.293a1 1 0 0 1-1.414 1.414L12 13.414l-5.293 5.293a1 1 0 0 1-1.414-1.414L10.586 12 5.293 6.707a1 1 0 0 1 0-1.414Z" />
										</svg>
									</button>
								) : null}
							</div>
						))}
					</div>

					<div className="curseforge-import__actions curseforge-import__actions--split">
						<button className="button button--size-m button--type-minimal button--with-icon" type="button" onClick={() => setProjectUrls((current) => [...current, ""])} disabled={loading || projectUrls.length >= MAX_PROJECTS_PER_IMPORT}>
							<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
								<path d="M12 5v14M5 12h14" />
							</svg>

							{t("links.add")}
						</button>

						<button className="button button--size-m button--type-primary" type="submit" disabled={loading || !areProjectUrlsValid}>
							{loading ? t("checking") : t("continue")}
						</button>
					</div>
				</form>
			)}
		</>
	);

	const renderVerification = () => (
		<div className="curseforge-import__flow">
			<div>
				<p className="blog-settings__field-title">{t("verification.title")}</p>
				<p style={{ color: "var(--theme-color-text-secondary)" }}>{t(method === "profile" ? "verification.hint" : "verification.linksHint")}</p>
			</div>

			<div className="curseforge-import__verification">
				<div className="curseforge-import__verification-label">
					<Tooltip content={verificationExpiryLabel} position="bottom" delay={200}>
						<span className={`curseforge-import__verification-expiry${verificationRemainingMinutes === 0 ? " curseforge-import__verification-expiry--expired" : ""}`} tabIndex={0} aria-label={verificationExpiryLabel}>
							<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
								<circle cx="12" cy="12" r="10" />
								<path d="M12 6v6l4 2" />
							</svg>
						</span>
					</Tooltip>

					<span>{t("verification.codeLabel")}</span>
				</div>

				<div className="curseforge-import__verification-code">
					<code>{verificationCode}</code>

					<Tooltip content={t(codeCopied ? "verification.copied" : "verification.copy")} delay={200}>
						<button className={`icon-button curseforge-import__verification-copy${codeCopied ? " curseforge-import__verification-copy--copied" : ""}`} type="button" onClick={handleCopyVerificationCode} aria-label={t(codeCopied ? "verification.copied" : "verification.copy")}>
							{codeCopied ? (
								<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
									<path d="m20 6-11 11-5-5" />
								</svg>
							) : (
								<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
									<rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
									<path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
								</svg>
							)}
						</button>
					</Tooltip>
				</div>
			</div>

			<ol className="curseforge-import__steps">
				{method === "profile" ? (
					<li>{t.rich("verification.stepOne", { project: String(session.verificationProject?.name || ""), link: (chunks) => <a href={session.verificationProject?.url} target="_blank" rel="noreferrer">{chunks}</a> })}</li>
				) : (
					<li>{t("verification.linksStepOne")}</li>
				)}

				<li>{t(method === "profile" ? "verification.stepTwo" : "verification.linksStepTwo", { code: verificationCode })}</li>

				<li>{t("verification.stepThree")}</li>
			</ol>

			{method === "links" ? (
				<div className="curseforge-import__verification-projects">
					{(session.items || []).map((item) => {
						const status = verificationStatuses[item.curseforgeProjectId] || "pending";
						return (
							<div className="curseforge-import__verification-project" key={item.curseforgeProjectId}>
								<a href={item.sourceUrl} target="_blank" rel="noreferrer">
									{item.name}
								</a>

								<Tooltip content={t(`verification.status.${status}`)} delay={200}>
									<span className={`curseforge-import__verification-status curseforge-import__verification-status--${status}`} tabIndex={0} aria-label={t(`verification.status.${status}`)}>
										{status === "verified" ? (
											<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
												<circle cx="12" cy="12" r="10" />
												<path d="m8 12 2.5 2.5L16 9" />
											</svg>
										) : status === "missing" ? (
											<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
												<circle cx="12" cy="12" r="10" />
												<path d="m15 9-6 6M9 9l6 6" />
											</svg>
										) : (
											<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
												<path d="M21.73 18 13.73 4a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
												<path d="M12 9v4M12 17h.01" />
											</svg>
										)}
									</span>
								</Tooltip>
							</div>
						);
					})}
				</div>
			) : null}

			<div className="curseforge-import__notice curseforge-import__notice--warning">
				<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
					<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
					<path d="m9 12 2 2 4-4" />
				</svg>

				<p>{t("verification.alternative")}</p>
			</div>

			<div className="curseforge-import__actions">
				<button className="button button--size-m button--type-minimal" type="button" onClick={() => changePhase("source")} disabled={loading}>
					{t("back")}
				</button>

				<button className="button button--size-m button--type-primary" type="button" onClick={handleVerify} disabled={loading || verificationRemainingMinutes === 0}>
					{loading ? t("verification.checking") : t("verification.check")}
				</button>
			</div>
		</div>
	);

	const renderSelection = () => (
		<div className="curseforge-import__flow">
			<div className="curseforge-import__selection-heading">
				<div>
					<p className="blog-settings__field-title">{t("selection.title")}</p>
					<p style={{ color: "var(--theme-color-text-secondary)" }}>{t("selection.hint", { selected: selectedCount, limit: MAX_PROJECTS_PER_IMPORT })}</p>
				</div>

				<button className="button button--size-s button--type-minimal" type="button" onClick={() => isAllSelected ? setSelectedIds(new Set()) : selectAll(sessionItems)} disabled={selectableItems.length === 0}>
					{isAllSelected ? t("selection.clear") : t(selectableItems.length > MAX_PROJECTS_PER_IMPORT ? "selection.firstTen" : "selection.all")}
				</button>
			</div>

			{rejectedLinks.length ? <div className="curseforge-import__notice">{t("selection.rejected", { count: rejectedLinks.length })}</div> : null}

			<div ref={projectListRef} className="curseforge-import__projects curseforge-import__projects--selection curseforge-import__scrollable-list" onScroll={updateProjectListFade}>
				{sessionItems.map((item) => {
					const selected = selectedIds.has(item.curseforgeProjectId);
					const disabled = Boolean(item.alreadyImported);

					return (
						<div className={`curseforge-import__project${disabled ? " curseforge-import__project--disabled" : ""}`} key={item.curseforgeProjectId} onClick={() => {
							if(!disabled) toggleProject(item.curseforgeProjectId);
						}}>
							<button className="curseforge-import__project-toggle" type="button" aria-pressed={selected} aria-label={item.name} onClick={(event) => {
								event.stopPropagation();
								toggleProject(item.curseforgeProjectId);
							}} disabled={disabled}>
								<span className={`organization-member-card__permission-check ${selected ? "organization-member-card__permission-check--active" : ""}`} aria-hidden="true">
									{selected ? (
										<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
											<path d="M20 6 9 17l-5-5" />
										</svg>
									) : null}
								</span>
							</button>

							<span className="curseforge-import__project-icon">{item.iconUrl ? <img src={item.iconUrl} alt="" /> : <span aria-hidden="true">CF</span>}</span>

							<span className="curseforge-import__project-copy">
								<span className="curseforge-import__project-title">
									<a href={item.sourceUrl} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>{item.name}</a>

									{item.nameConflict ? (
										<Tooltip content={t("selection.nameConflict")} delay={200}>
											<span className="curseforge-import__project-warning" tabIndex={0} aria-label={t("selection.nameConflict")} onClick={(event) => event.stopPropagation()}>
												<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
													<path d="M21.73 18 13.73 4a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
													<path d="M12 9v4M12 17h.01" />
												</svg>
											</span>
										</Tooltip>
									) : null}

									{disabled ? <span className="curseforge-import__project-badge">{t("selection.alreadyImported")}</span> : null}
								</span>

								<span className="curseforge-import__project-summary">{item.summary}</span>
							</span>
						</div>
					);
				})}
			</div>

			<div className="curseforge-import__actions">
				<button className="button button--size-m button--type-minimal" type="button" onClick={() => changePhase("source")} disabled={loading}>
					{t("back")}
				</button>

				<button className="button button--size-m button--type-primary" type="button" onClick={handleStart} disabled={loading || selectedCount === 0}>
					{loading ? t("starting") : t("selection.import", { count: selectedCount })}
				</button>
			</div>
		</div>
	);

	const renderProgress = () => (
		<div className="curseforge-import__flow">
			<div>
				<p className="blog-settings__field-title">{isFinished ? t(`result.${currentSession.status}.title`) : t("progress.title")}</p>
				<p style={{ color: "var(--theme-color-text-secondary)" }} aria-live="polite">{isFinished ? t(`result.${currentSession.status}.hint`) : t("progress.hint", { progress: overallProgress })}</p>
			</div>

			<div className="curseforge-import__overall" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow={overallProgress}>
				<span style={{ transform: `scaleX(${overallProgress / 100})` }} />
			</div>

			<div className="curseforge-import__projects curseforge-import__projects--progress">
				{(currentSession?.items || []).filter((item) => item.selected).map((item) => {
					const knownStatus = ["pending", "queued", "processing", "completed", "failed"].includes(item.status) ? item.status : "pending";
					const status = knownStatus === "completed" && item.warningMessage ? "warning" : knownStatus;
					const statusLabel = item.errorMessage || item.warningMessage || t(`status.${status}`);

					return (
						<div className="curseforge-import__progress-item" key={item.curseforgeProjectId}>
							<Tooltip content={statusLabel} delay={200}>
								<span className={`curseforge-import__status curseforge-import__status--${status}`} tabIndex={0} aria-label={statusLabel}>
									{status === "completed" ? (
										<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
											<circle cx="12" cy="12" r="10" />
											<path d="m8 12 2.5 2.5L16 9" />
										</svg>
									) : status === "failed" ? (
										<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
											<circle cx="12" cy="12" r="10" />
											<path d="m15 9-6 6M9 9l6 6" />
										</svg>
									) : status === "warning" ? (
										<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
											<path d="M21.73 18 13.73 4a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
											<path d="M12 9v4M12 17h.01" />
										</svg>
									) : (
										<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
											<circle cx="12" cy="12" r="10" />
											<path d="M12 6v6l4 2" />
										</svg>
									)}
								</span>
							</Tooltip>

							<span className="curseforge-import__project-copy">
								{item.projectSlug ? <Link href={`${getProjectPathByType({ slug: item.projectSlug, projectType: item.projectType })}/settings`} prefetch={false}>{item.name}</Link> : <a href={item.sourceUrl} target="_blank" rel="noreferrer">{item.name}</a>}

								<span className="curseforge-import__project-summary">{item.errorMessage || item.warningMessage || t(`stages.${item.stage}`)}</span>
							</span>

							{status === "failed" ? (
								<button className="button button--size-s button--type-minimal" type="button" onClick={() => handleRetryItem(item.id)} disabled={retryingItemId === item.id}>
									{retryingItemId === item.id ? t("progress.retrying") : t("progress.retry")}
								</button>
							) : <strong>{item.progress}%</strong>}
						</div>
					);
				})}
			</div>

			{progressQuery.isError ? <p className="curseforge-import__error">{t("errors.progress")}</p> : null}

			<div className="curseforge-import__actions">
				<button className="button button--size-m button--type-primary" type="button" onClick={handleProgressClose}>
					{isFinished ? t("done") : t("closeAndContinue")}
				</button>
			</div>
		</div>
	);

	return (
		<Modal closeTimeoutMS={150} isOpen={isOpen} onRequestClose={onRequestClose} className="modal active curseforge-import-modal" overlayClassName="modal-overlay modal-overlay--version-details-wide">
			<div className="modal-window">
				<div className="curseforge-import-modal__media" aria-hidden="true">
					<Image className="curseforge-import-modal__image" src="/images/5e7ba01a50cbcd001176c5f5_25___collection_time.webp" alt="" fill sizes="800px" />
				</div>

				<div className="curseforge-import-modal__main">
					<div className="modal-window__header curseforge-import-modal__header curseforge-import-modal__header--back">
						<button className="icon-button modal-window__back" type="button" onClick={onBack} aria-label={t("back")} disabled={loading}>
							<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
								<path d="m15 18-6-6 6-6" />
							</svg>
						</button>

						<h2 className="modal-window__title">{t("title")}</h2>

						<button className="icon-button modal-window__close" type="button" onClick={onRequestClose} aria-label={t("close")}>
							<svg className="icon icon--cross" height="24" width="24" aria-hidden="true">
								<path fillRule="evenodd" clipRule="evenodd" d="M5.293 5.293a1 1 0 0 1 1.414 0L12 10.586l5.293-5.293a1 1 0 0 1 1.414 1.414L13.414 12l5.293 5.293a1 1 0 0 1-1.414 1.414L12 13.414l-5.293 5.293a1 1 0 0 1-1.414-1.414L10.586 12 5.293 6.707a1 1 0 0 1 0-1.414Z" />
							</svg>
						</button>
					</div>

					<div ref={contentRef} className="modal-window__content curseforge-import__content">
						<div className="curseforge-import__pages" data-page={phase}>
							<section className="curseforge-import__page" data-page-id="source" aria-hidden={phase !== "source"} inert={phase !== "source"}>
								{renderSource()}
							</section>

							<section className="curseforge-import__page" data-page-id="verification" aria-hidden={phase !== "verification"} inert={phase !== "verification"}>
								{session ? renderVerification() : null}
							</section>

							<section className="curseforge-import__page" data-page-id="selection" aria-hidden={phase !== "selection"} inert={phase !== "selection"}>
								{Array.isArray(session?.items) ? renderSelection() : null}
							</section>

							<section className="curseforge-import__page" data-page-id="progress" aria-hidden={phase !== "progress"} inert={phase !== "progress"}>
								{session ? renderProgress() : null}
							</section>
						</div>
					</div>
				</div>
			</div>
		</Modal>
	);
}