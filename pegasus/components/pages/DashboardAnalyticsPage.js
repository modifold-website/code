"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useLocale, useTranslations } from "next-intl";
import { useAuth } from "../providers/AuthProvider";
import UserSettingsSidebar from "@/components/ui/UserSettingsSidebar";
import DatePopover from "@/components/ui/DatePopover";
import AnalyticsOnlineInfoModal from "@/modal/AnalyticsOnlineInfoModal";
import { AnalyticsChart, BarTooltipCursor, ChartTypeToggle, OnlineChart, formatChartDate } from "@/components/project/settings/ProjectAnalyticsSettingsPage";

const FALLBACK_COLORS = ["#00af5c", "#307df0", "#ff4f5e", "#e6833f", "#8b5cf6", "#14b8a6", "#f97316", "#ec4899"];

const normalizeProjectColor = (value) => {
	if(typeof value === "number" && Number.isFinite(value)) {
		return `#${Math.max(0, Math.min(0xffffff, value)).toString(16).padStart(6, "0")}`;
	}

	if(typeof value !== "string") {
		return null;
	}

	const color = value.trim();
	if(/^#[0-9a-f]{6}$/i.test(color)) {
		return color;
	}

	if(/^[0-9a-f]{6}$/i.test(color)) {
		return `#${color}`;
	}

	if(/^\d+$/.test(color)) {
		const numericColor = Number(color);
		if(Number.isFinite(numericColor)) {
			return `#${Math.max(0, Math.min(0xffffff, numericColor)).toString(16).padStart(6, "0")}`;
		}
	}

	return null;
};

const getFallbackColorIndex = (project, index) => {
	const seed = String(project?.slug || project?.id || project?.title || "");
	if(!seed) {
		return index % FALLBACK_COLORS.length;
	}

	let hash = 0;
	for(let charIndex = 0; charIndex < seed.length; charIndex += 1) {
		hash = ((hash << 5) - hash + seed.charCodeAt(charIndex)) | 0;
	}

	return Math.abs(hash) % FALLBACK_COLORS.length;
};

const getProjectColor = (project, index) => {
	return normalizeProjectColor(project?.color) || FALLBACK_COLORS[getFallbackColorIndex(project, index)];
};

const normalizeProjectIds = (value) => String(value || "").split(",").map((item) => item.trim()).filter(Boolean);

const getProjectGradientId = (projectSlug) => `dashboardAnalytics${String(projectSlug || "").replace(/[^a-zA-Z0-9_-]/g, "")}`;

const formatDateValue = (date) => {
	const year = date.getFullYear();
	const month = `${date.getMonth() + 1}`.padStart(2, "0");
	const day = `${date.getDate()}`.padStart(2, "0");
	return `${year}-${month}-${day}`;
};

const getDefaultDateRange = () => {
	const endDate = new Date();
	endDate.setHours(0, 0, 0, 0);
	const startDate = new Date(endDate);
	startDate.setMonth(endDate.getMonth() - 1);

	return {
		from: formatDateValue(startDate),
		to: formatDateValue(endDate),
	};
};

function MultiProjectTooltip({ active, payload, label, locale, t }) {
	if(!active || !payload?.length) {
		return null;
	}

	const visiblePayload = payload.filter((entry) => entry?.value !== undefined && entry?.value !== null);

	return (
		<div className="project-analytics-tooltip dashboard-analytics-tooltip">
			<p>{formatChartDate(label, locale)}</p>

			{visiblePayload.map((entry) => (
				<span key={entry.dataKey} className="dashboard-analytics-tooltip__row">
					<span className="dashboard-analytics-tooltip__dot" style={{ backgroundColor: entry.color }} />
					{entry.name}: {Number(entry.value) || 0}
				</span>
			))}

			{!visiblePayload.length ? <span>{t("emptyPoint")}</span> : null}
		</div>
	);
}

function DashboardChartLegend({ payload, hiddenSeries, onToggleSeries, isExpanded, onToggleExpanded, t }) {
	const entries = Array.isArray(payload) ? payload : [];
	const visibleEntries = isExpanded ? entries : entries.slice(0, 8);
	const hiddenCount = Math.max(entries.length - visibleEntries.length, 0);

	return (
		<div className="dashboard-analytics-legend">
			{visibleEntries.map((entry) => (
				<button key={entry.dataKey} type="button" className={`dashboard-analytics-legend__item ${hiddenSeries[entry.dataKey] ? "project-analytics-legend__label--inactive" : ""}`} onClick={() => onToggleSeries(entry)}>
					<span className="dashboard-analytics-legend__dot" style={{ backgroundColor: entry.color }} />
					<span>{entry.value}</span>
				</button>
			))}

			{hiddenCount > 0 || isExpanded ? (
				<button type="button" className="dashboard-analytics-legend__more" onClick={onToggleExpanded}>
					{isExpanded ? t("legend.showLess") : t("legend.showMore", { count: hiddenCount })}
				</button>
			) : null}
		</div>
	);
}

function MultiProjectChart({ title, projects, seriesByProject, locale, t, tSettings }) {
	const [chartType, setChartType] = useState("line");
	const [hiddenSeries, setHiddenSeries] = useState({});
	const [isLegendExpanded, setIsLegendExpanded] = useState(false);
	const projectSeries = useMemo(() => {
		const selectedProjects = Array.isArray(projects) ? projects : [];
		const dateSet = new Set();

		selectedProjects.forEach((project) => {
			const rows = Array.isArray(seriesByProject?.[project.slug]) ? seriesByProject[project.slug] : [];
			rows.forEach((point) => dateSet.add(point.date));
		});

		const sortedDates = [...dateSet].sort();
		const countsByProject = new Map(selectedProjects.map((project) => [
			project.slug,
			new Map((Array.isArray(seriesByProject?.[project.slug]) ? seriesByProject[project.slug] : []).map((point) => [point.date, Number(point.count) || 0])),
		]));

		return sortedDates.map((date) => {
			const point = { date };
			selectedProjects.forEach((project) => {
				point[project.slug] = countsByProject.get(project.slug)?.get(date) || 0;
			});

			return point;
		});
	}, [projects, seriesByProject]);

	const toggleSeries = (entry) => {
		const dataKey = entry?.dataKey;
		if(!dataKey) {
			return;
		}

		setHiddenSeries((prev) => ({
			...prev,
			[dataKey]: !prev[dataKey],
		}));
	};

	const commonChartChildren = (
		<>
			<CartesianGrid stroke="var(--theme-color-text-primary)" strokeDasharray="4 4" strokeOpacity={0.1} vertical={false} />
			<XAxis
				dataKey="date"
				tickFormatter={(value) => formatChartDate(value, locale)}
				minTickGap={24}
				tickLine={false}
				axisLine={false}
				tickMargin={8}
				style={{ fontSize: "12px" }}
			/>
			<YAxis allowDecimals={false} tickLine={false} axisLine={false} width={28} tickMargin={4} style={{ fontSize: "12px" }} />
			<Tooltip content={<MultiProjectTooltip locale={locale} t={t} />} cursor={chartType === "bar" ? <BarTooltipCursor /> : undefined} />
			<Legend
				verticalAlign="bottom"
				content={(props) => (
					<DashboardChartLegend
						payload={props.payload}
						hiddenSeries={hiddenSeries}
						onToggleSeries={toggleSeries}
						isExpanded={isLegendExpanded}
						onToggleExpanded={() => setIsLegendExpanded((current) => !current)}
						t={t}
					/>
				)}
			/>
		</>
	);

	return (
		<section className="content content--padding" style={{ padding: "24px" }}>
			<div className="project-analytics-card__header">
				<div>
					<h2 className="project-analytics-card__title">{title}</h2>
				</div>

				<ChartTypeToggle chartType={chartType} onChange={setChartType} t={tSettings} />
			</div>

			<div className="project-analytics-chart dashboard-analytics-chart">
				<ResponsiveContainer width="100%" height={projects.length > 4 ? 360 : 320}>
					{chartType === "bar" ? (
						<BarChart data={projectSeries} barCategoryGap="18%">
							{commonChartChildren}
							{projects.map((project, index) => (
								<Bar
									key={project.slug}
									name={project.title}
									dataKey={project.slug}
									fill={getProjectColor(project, index)}
									radius={[6, 6, 0, 0]}
									maxBarSize={24}
									hide={hiddenSeries[project.slug]}
								/>
							))}
						</BarChart>
					) : (
						<AreaChart data={projectSeries}>
							<defs>
								{projects.map((project, index) => {
									const lineColor = getProjectColor(project, index);
									const gradientId = getProjectGradientId(project.slug);

									return (
										<linearGradient key={project.slug} id={gradientId} x1="0" y1="0" x2="0" y2="1">
											<stop offset="5%" stopColor={lineColor} stopOpacity={0.32} />
											<stop offset="95%" stopColor={lineColor} stopOpacity={0.02} />
										</linearGradient>
									);
								})}
							</defs>
							{commonChartChildren}
							{projects.map((project, index) => (
								<Area
									key={project.slug}
									name={project.title}
									type="monotone"
									dataKey={project.slug}
									stroke={getProjectColor(project, index)}
									strokeWidth={2.5}
									fill={`url(#${getProjectGradientId(project.slug)})`}
									dot={false}
									activeDot={{ r: 5, strokeWidth: 2, stroke: "var(--theme-color-background-content)" }}
									hide={hiddenSeries[project.slug]}
									isAnimationActive={false}
								/>
							))}
						</AreaChart>
					)}
				</ResponsiveContainer>
			</div>
		</section>
	);
}

export default function DashboardAnalyticsPage({ initialAnalytics, initialFrom, initialTo, initialProjectIds }) {
	const t = useTranslations("DashboardAnalyticsPage");
	const tSettings = useTranslations("SettingsProjectPage");
	const tSidebar = useTranslations("SettingsBlogPage.sidebar");
	const locale = useLocale();
	const router = useRouter();
	const { isLoggedIn, user } = useAuth();
	const [isPending, startTransition] = useTransition();
	const [from, setFrom] = useState(initialFrom || "");
	const [to, setTo] = useState(initialTo || "");
	const [draftProjectIds, setDraftProjectIds] = useState(() => normalizeProjectIds(initialProjectIds));
	const [isProjectFilterOpen, setIsProjectFilterOpen] = useState(false);
	const [isOnlineInfoModalOpen, setIsOnlineInfoModalOpen] = useState(false);
	const projectFilterRef = useRef(null);

	const analytics = initialAnalytics || {};
	const projects = Array.isArray(analytics.projects) ? analytics.projects : [];
	const selectedProjects = Array.isArray(analytics.selectedProjects) ? analytics.selectedProjects : [];
	const selectedProjectIds = normalizeProjectIds(initialProjectIds);
	const isAllProjects = selectedProjectIds.length === 0;
	const downloads = Array.isArray(analytics.downloads) ? analytics.downloads : [];
	const views = Array.isArray(analytics.views) ? analytics.views : [];
	const countries = Array.isArray(analytics.countries) ? analytics.countries : [];
	const totals = analytics.totals || {};
	const onlineSeries = Array.isArray(analytics.onlineSeries) ? analytics.onlineSeries : [];
	const onlineSummary = analytics.onlineSummary || {};
	const hasOnline = onlineSeries.length > 0;
	const activeServersNow = Number(onlineSummary.activeServersNow) || 0;
	const playersOnlineNow = Number(onlineSummary.playersOnlineNow) || 0;
	const canCompareProjects = selectedProjects.length > 1;
	const selectedProjectColor = !isAllProjects && selectedProjects.length === 1 ? getProjectColor(selectedProjects[0], 0) : null;
	const regionNames = typeof Intl.DisplayNames === "function" ? new Intl.DisplayNames([locale], { type: "region" }) : null;
	const projectFilterLabel = isAllProjects ? t("filters.allProjects") : t("filters.selectedProjects", { count: selectedProjectIds.length });
	const datePopoverLabels = {
		placeholder: t("filters.selectDate"),
		clear: t("filters.clearDate"),
		today: t("filters.today"),
		previousMonth: t("filters.previousMonth"),
		nextMonth: t("filters.nextMonth"),
	};

	useEffect(() => {
		if(!isLoggedIn) {
			router.push("/");
		}
	}, [isLoggedIn, router]);

	useEffect(() => {
		setFrom(initialFrom || "");
		setTo(initialTo || "");
		setDraftProjectIds(normalizeProjectIds(initialProjectIds));
	}, [initialFrom, initialTo, initialProjectIds]);

	useEffect(() => {
		const handleClickOutside = (event) => {
			if(projectFilterRef.current && !projectFilterRef.current.contains(event.target)) {
				setIsProjectFilterOpen(false);
			}
		};

		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, []);

	const applyFilters = () => {
		const params = new URLSearchParams();
		if(from) {
			params.set("from", from);
		}
		if(to) {
			params.set("to", to);
		}
		if(draftProjectIds.length && draftProjectIds.length < projects.length) {
			params.set("project_ids", draftProjectIds.join(","));
		}

		setIsProjectFilterOpen(false);
		startTransition(() => {
			const queryString = params.toString();
			router.push(queryString ? `/dashboard/analytics?${queryString}` : "/dashboard/analytics");
		});
	};

	const resetFilters = () => {
		const defaultRange = getDefaultDateRange();

		setFrom(defaultRange.from);
		setTo(defaultRange.to);
		setDraftProjectIds([]);
		setIsProjectFilterOpen(false);
		startTransition(() => {
			const params = new URLSearchParams(defaultRange);
			router.push(`/dashboard/analytics?${params.toString()}`);
		});
	};

	const refreshAnalytics = () => {
		setIsProjectFilterOpen(false);
		startTransition(() => {
			router.refresh();
		});
	};

	const toggleProject = (projectId) => {
		setDraftProjectIds((prev) => {
			if(prev.includes(projectId)) {
				return prev.filter((id) => id !== projectId);
			}

			return [...prev, projectId];
		});
	};

	const selectAllProjects = () => {
		setDraftProjectIds([]);
	};

	return (
		<div className="layout">
			<div className="page-content settings-page">
				<UserSettingsSidebar
					user={user}
					profileIconAlt={t("userAvatarAlt", { username: user?.username || "" })}
					mode="dashboard"
					labels={{
						projects: tSidebar("projects"),
						analytics: tSidebar("analytics"),
						likes: tSidebar("likes"),
						organizations: tSidebar("organizations"),
						jams: tSidebar("jams"),
						notifications: tSidebar("notifications"),
						settings: tSidebar("settings"),
						apiTokens: tSidebar("apiTokens"),
						verification: tSidebar("verification"),
					}}
				/>

				<div className="settings-content">
					<div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
						<section className="content content--padding dashboard-analytics-filter-card">
							<div className="dashboard-analytics-filter-card__header">
								<h1>{t("title")}</h1>

								<div className="dashboard-analytics-filter-card__actions">
									<button type="button" className="button button--size-m button--type-secondary button--active-transform" onClick={resetFilters} disabled={isPending}>
										{t("filters.reset")}
									</button>

									<button type="button" className="button button--size-m button--type-secondary button--with-icon button--active-transform" onClick={refreshAnalytics} disabled={isPending}>
										<svg xmlns="http://www.w3.org/2000/svg" style={{ fill: "none" }} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
											<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"></path>
											<path d="M21 3v5h-5"></path>
											<path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"></path>
											<path d="M8 16H3v5"></path>
										</svg>

										{t("filters.refresh")}
									</button>
								</div>
							</div>

							<div className="dashboard-analytics-filter-card__body">
								<div className="dashboard-analytics-filter-row">
									<div className="dashboard-analytics-filter-row__label">
										<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
											<path d="M8 2v4"></path>
											<path d="M16 2v4"></path>
											<rect width="18" height="18" x="3" y="4" rx="2"></rect>
											<path d="M3 10h18"></path>
										</svg>

										<span>{t("filters.dateRange")}:</span>
									</div>

									<div className="version-filters dashboard-analytics-filters">
										<DatePopover id="analytics-from" label={t("filters.from")} value={from} onChange={setFrom} locale={locale} labels={datePopoverLabels} />
										<DatePopover id="analytics-to" label={t("filters.to")} value={to} onChange={setTo} locale={locale} labels={datePopoverLabels} />
									</div>
								</div>

								<div className="dashboard-analytics-filter-row">
									<div className="dashboard-analytics-filter-row__label">
											<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
											<rect width="7" height="7" x="3" y="3" rx="1"></rect>
											<rect width="7" height="7" x="14" y="3" rx="1"></rect>
											<rect width="7" height="7" x="14" y="14" rx="1"></rect>
											<rect width="7" height="7" x="3" y="14" rx="1"></rect>
										</svg>

										<span>{t("filters.filteredBy")}:</span>
									</div>

									<div className="version-filters dashboard-analytics-filters">
										<div className="field field--default dashboard-analytics-project-field" ref={projectFilterRef}>
											<button className="button button--size-m button--type-secondary dashboard-analytics-project-filter" onClick={() => setIsProjectFilterOpen((prev) => !prev)} aria-expanded={isProjectFilterOpen} type="button">
												<span className="dashboard-analytics-project-filter__dot" />
												<span className="dashboard-analytics-project-filter__label">{projectFilterLabel}</span>

												<svg className={`icon icon--chevron_down ${isProjectFilterOpen ? "open" : ""}`} width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
													<path fillRule="evenodd" clipRule="evenodd" d="M17.707 8.793a1 1 0 0 1 0 1.414l-5 5a1 1 0 0 1-1.414 0l-5-5a1 1 0 1 1 1.414-1.414L12 13.086l4.293-4.293a1 1 0 0 1 1.414 0Z" fill="currentColor"></path>
												</svg>
											</button>

											{isProjectFilterOpen && (
												<div className="popover dashboard-analytics-project-popover">
													<div className="context-list" data-scrollable="">
															<button type="button" className={`context-list-option dashboard-analytics-project-option ${draftProjectIds.length === 0 ? "context-list-option--selected" : ""}`} onClick={selectAllProjects}>
																<span className={`dashboard-analytics-project-option__check ${draftProjectIds.length === 0 ? "dashboard-analytics-project-option__check--checked" : ""}`}>
																	{draftProjectIds.length === 0 ? (
																		<svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" viewBox="0 0 24 24" aria-hidden="true">
																			<path d="M20 6 9 17l-5-5"></path>
																		</svg>
																	) : null}
																</span>
																<span className="context-list-option__label">{t("filters.allProjects")}</span>
															</button>

														{projects.map((project, index) => {
															const projectId = String(project.id);
															const isSelected = draftProjectIds.includes(projectId);

																return (
																	<button key={project.id} type="button" className={`context-list-option dashboard-analytics-project-option ${isSelected ? "context-list-option--selected" : ""}`} onClick={() => toggleProject(projectId)}>
																		<span className={`dashboard-analytics-project-option__check ${isSelected ? "dashboard-analytics-project-option__check--checked" : ""}`}>
																			{isSelected ? (
																				<svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" viewBox="0 0 24 24" aria-hidden="true">
																					<path d="M20 6 9 17l-5-5"></path>
																				</svg>
																			) : null}
																		</span>
																		<span className="dashboard-analytics-project-option__color" style={{ backgroundColor: getProjectColor(project, index) }} />
																		<span className="context-list-option__label">{project.title}</span>
																	</button>
															);
														})}
													</div>
												</div>
											)}
										</div>

										<button type="button" className="button button--size-m button--type-primary button--active-transform dashboard-analytics-apply" onClick={applyFilters} disabled={isPending}>
											{isPending ? t("filters.applying") : t("filters.apply")}
										</button>
									</div>
								</div>
							</div>
						</section>

						{projects.length ? (
							<>
								<div className="project-analytics__stats">
									<div className="content content--padding project-analytics-stat">
										<p className="project-analytics-stat__label">
											{tSettings("analytics.stats.downloads")}

											<svg xmlns="http://www.w3.org/2000/svg" style={{ fill: "none", marginLeft: "auto" }} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
												<path d="M12 15V3"></path>
												<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
												<path d="m7 10 5 5 5-5"></path>
											</svg>
										</p>

										<strong>{Number(totals.downloads) || 0}</strong>
									</div>

									<div className="content content--padding project-analytics-stat">
										<p className="project-analytics-stat__label">
											{tSettings("analytics.live.activeServers")}

											<svg xmlns="http://www.w3.org/2000/svg" style={{ fill: "none", marginLeft: "auto" }} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
												<rect width="20" height="8" x="2" y="2" rx="2" ry="2"/>
												<rect width="20" height="8" x="2" y="14" rx="2" ry="2"/>
												<line x1="6" x2="6.01" y1="6" y2="6"/>
												<line x1="6" x2="6.01" y1="18" y2="18"/>
											</svg>
										</p>

										<strong>{activeServersNow}</strong>
									</div>

									<div className="content content--padding project-analytics-stat project-analytics-stat--online">
										<p className="project-analytics-stat__label">
											{tSettings("analytics.stats.onlineNow")}

											{!hasOnline && (
												<span className="project-analytics-info" onClick={() => setIsOnlineInfoModalOpen(true)}>
													<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
														<circle cx="12" cy="12" r="10"/>
														<path d="M12 16v-4"/>
														<path d="M12 8h.01"/>
													</svg>
												</span>
											)}

											<svg xmlns="http://www.w3.org/2000/svg" style={{ fill: "none", marginLeft: "auto" }} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
												<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
												<path d="M16 3.128a4 4 0 0 1 0 7.744"></path>
												<path d="M22 21v-2a4 4 0 0 0-3-3.87"></path>
												<circle cx="9" cy="7" r="4"></circle>
											</svg>
										</p>

										<strong>{playersOnlineNow}</strong>
									</div>
								</div>

								{hasOnline ? (
									<OnlineChart
										title={tSettings("analytics.online.title")}
										data={onlineSeries}
										locale={locale}
										t={tSettings}
									/>
								) : null}

								<AnalyticsOnlineInfoModal
									isOpen={isOnlineInfoModalOpen}
									onRequestClose={() => setIsOnlineInfoModalOpen(false)}
								/>

								{canCompareProjects ? (
									<MultiProjectChart
										title={t("charts.downloads")}
										projects={selectedProjects}
										seriesByProject={analytics.downloadsByProject}
										locale={locale}
										t={t}
										tSettings={tSettings}
									/>
								) : (
									<AnalyticsChart
										title={t("charts.downloads")}
										data={downloads}
										locale={locale}
										lineColor={selectedProjectColor || "#00af5c"}
										gradientId="dashboardAnalyticsDownloads"
										tooltipLabelKey="analytics.downloads.tooltip"
										t={tSettings}
									/>
								)}

								{countries.length ? (
									<section className="content content--padding" style={{ padding: "24px" }}>
										<div className="project-analytics-card__header">
											<div>
												<p className="project-analytics-card__eyebrow">{tSettings("analytics.countries.eyebrow")}</p>
												<h2 className="project-analytics-card__title" style={{ marginBottom: "0" }}>{tSettings("analytics.countries.title")}</h2>
											</div>
										</div>

										<div className="project-analytics-countries">
											{countries.map((country) => (
												<div key={country.country_code} className="project-analytics-country">
													<div className="project-analytics-country__identity">
														<img src={`https://flagcdn.com/${country.country_code}.svg`} alt={country.country_code.toUpperCase()} className="project-analytics-country__flag" loading="lazy" />

														<div>
															<strong>{regionNames?.of(country.country_code.toUpperCase()) || country.country_code.toUpperCase()}</strong>
														</div>
													</div>

													<strong>{country.count}</strong>
												</div>
											))}
										</div>
									</section>
								) : null}

								{canCompareProjects ? (
									<MultiProjectChart
										title={t("charts.views")}
										projects={selectedProjects}
										seriesByProject={analytics.viewsByProject}
										locale={locale}
										t={t}
										tSettings={tSettings}
									/>
								) : (
									<AnalyticsChart
										title={t("charts.views")}
										data={views}
										locale={locale}
										lineColor={selectedProjectColor || "#307df0"}
										gradientId="dashboardAnalyticsViews"
										tooltipLabelKey="analytics.views.tooltip"
										t={tSettings}
									/>
								)}
							</>
						) : (
							<div className="notifications">
								<div className="subsite-empty-feed">
									<p className="subsite-empty-feed__title">{t("empty")}</p>
								</div>
							</div>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}