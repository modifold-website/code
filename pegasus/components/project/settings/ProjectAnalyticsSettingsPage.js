"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useLocale, useTranslations } from "next-intl";
import { getProjectPath } from "@/utils/projectRoutes";
import AnalyticsOnlineInfoModal from "@/modal/AnalyticsOnlineInfoModal";

const getTimeRangeHref = (project, range) => {
	const base = getProjectPath(project, "/settings/analytics");
	return range === "7d" ? base : `${base}?time_range=${range}`;
};

export const formatChartDate = (date, locale) => {
	const normalized = typeof date === "string" && date.includes("T") ? date : `${date}T00:00:00Z`;
	const value = new Date(normalized);
	return value.toLocaleDateString(locale, { day: "numeric", month: "short" });
};

export const formatChartDateTime = (date, locale) => {
	const normalized = typeof date === "string" && date.includes("T") ? date : `${date}T00:00:00Z`;
	const value = new Date(normalized);
	return value.toLocaleString(locale, {
		day: "numeric",
		month: "short",
		hour: "2-digit",
		minute: "2-digit",
	});
};

function AnalyticsTooltip({ active, payload, locale, labelKey, t }) {
    if(!active || !payload?.length) {
        return null;
    }

    const point = payload[0]?.payload;
    if(!point) {
        return null;
    }

    return (
        <div className="project-analytics-tooltip">
            <p>{formatChartDate(point.date, locale)}</p>
            <span>{t(labelKey, { count: point.count })}</span>
        </div>
	);
}

function OnlineTooltip({ active, payload, locale, t, visibleSeries }) {
	if(!active || !payload?.length) {
		return null;
	}

	const point = payload[0]?.payload;
	if(!point) {
		return null;
	}

	return (
		<div className="project-analytics-tooltip">
			<p>{formatChartDateTime(point.date, locale)}</p>
			{visibleSeries.servers ? <span>{t("analytics.online.tooltipServers", { count: Number(point.servers) || 0 })}</span> : null}
			{visibleSeries.players ? <span>{t("analytics.online.tooltipPlayers", { count: Number(point.players) || 0 })}</span> : null}
		</div>
	);
}

export function BarTooltipCursor({ x, y, width, height, color = "#00af5c" }) {
	if(x == null || y == null || width == null || height == null) {
		return null;
	}

	const cursorWidth = Math.min(Math.max(width * 0.45, 22), 42);
	const cursorX = x + (width - cursorWidth) / 2;

	return (
		<rect
			x={cursorX}
			y={y}
			width={cursorWidth}
			height={height}
			rx={8}
			fill={color}
			opacity={0.1}
			pointerEvents="none"
		/>
	);
}

export function ChartTypeToggle({ chartType, onChange, t }) {
	return (
		<div className="project-analytics-chart-toggle" role="group" aria-label={t("analytics.chartTypes.label")}>
			<button type="button" className={`project-analytics-chart-toggle__item button--active-transform ${chartType === "line" ? "is-active" : ""}`} onClick={() => onChange("line")} aria-pressed={chartType === "line"} aria-label={t("analytics.chartTypes.lineAria")}>
				<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
					<path d="M3 3v18h18"/>
					<path d="m19 9-5 5-4-4-3 3"/>
				</svg>

				<span>{t("analytics.chartTypes.line")}</span>
			</button>

			<button type="button" className={`project-analytics-chart-toggle__item button--active-transform ${chartType === "bar" ? "is-active" : ""}`} onClick={() => onChange("bar")} aria-pressed={chartType === "bar"} aria-label={t("analytics.chartTypes.barAria")}>
				<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
					<path d="M3 3v18h18"/>
					<path d="M7 16V9"/>
					<path d="M12 16V5"/>
					<path d="M17 16v-3"/>
				</svg>

				<span>{t("analytics.chartTypes.bar")}</span>
			</button>
		</div>
	);
}

export function AnalyticsChart({ title, data, locale, lineColor, gradientId, tooltipLabelKey, t }) {
	const [chartType, setChartType] = useState("line");
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
			<YAxis allowDecimals={false} tickLine={false} axisLine={false} width={24} tickMargin={4} style={{ fontSize: "12px" }} />
			<Tooltip content={<AnalyticsTooltip locale={locale} labelKey={tooltipLabelKey} t={t} />} cursor={chartType === "bar" ? <BarTooltipCursor color={lineColor} /> : undefined} />
		</>
	);

    return (
        <section className="content content--padding" style={{ padding: "24px" }}>
            <div className="project-analytics-card__header">
                <div>
                    <h2 className="project-analytics-card__title">{title}</h2>
                </div>

				<ChartTypeToggle chartType={chartType} onChange={setChartType} t={t} />
            </div>

            <div className="project-analytics-chart">
                <ResponsiveContainer width="100%" height={280}>
					{chartType === "bar" ? (
						<BarChart data={data} barCategoryGap="20%">
							{commonChartChildren}
							<Bar dataKey="count" fill={lineColor} radius={[6, 6, 0, 0]} maxBarSize={34} />
						</BarChart>
					) : (
						<AreaChart data={data}>
							<defs>
								<linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
									<stop offset="5%" stopColor={lineColor} stopOpacity={0.32} />
									<stop offset="95%" stopColor={lineColor} stopOpacity={0.02} />
								</linearGradient>
							</defs>
							{commonChartChildren}
							<Area type="monotone" dataKey="count" stroke={lineColor} strokeWidth={3} fill={`url(#${gradientId})`} />
						</AreaChart>
					)}
                </ResponsiveContainer>
            </div>
		</section>
	);
}

export function OnlineChart({ title, data, locale, t }) {
	const [visibleSeries, setVisibleSeries] = useState({ servers: true, players: true });
	const [chartType, setChartType] = useState("line");

	const toggleSeries = (entry) => {
		const dataKey = entry?.dataKey;
		if(dataKey !== "servers" && dataKey !== "players") {
			return;
		}

		setVisibleSeries((prev) => ({
			...prev,
			[dataKey]: !prev[dataKey],
		}));
	};

	const commonChartChildren = (
		<>
			<CartesianGrid stroke="var(--theme-color-text-primary)" strokeDasharray="4 4" strokeOpacity={0.1} vertical={false} />
			<XAxis
				dataKey="date"
				tickFormatter={(value) => formatChartDateTime(value, locale)}
				interval="preserveStartEnd"
				minTickGap={42}
				padding={{ left: 12, right: 12 }}
				tickLine={false}
				axisLine={false}
				tickMargin={8}
				style={{ fontSize: "12px" }}
			/>
			<YAxis allowDecimals={false} tickLine={false} axisLine={false} width={28} tickMargin={4} style={{ fontSize: "12px" }} />
			<Tooltip content={<OnlineTooltip locale={locale} t={t} visibleSeries={visibleSeries} />} cursor={chartType === "bar" ? <BarTooltipCursor color="#00af5c" /> : undefined} />
			<Legend
				verticalAlign="bottom"
				iconType="circle"
				iconSize={12}
				onClick={toggleSeries}
				formatter={(value, entry) => (
					<span className={`project-analytics-legend__label ${visibleSeries[entry?.dataKey] === false ? "project-analytics-legend__label--inactive" : ""}`}>{value}</span>
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

				<ChartTypeToggle chartType={chartType} onChange={setChartType} t={t} />
			</div>

			<div className="project-analytics-chart">
				<ResponsiveContainer width="100%" height={340}>
					{chartType === "bar" ? (
						<BarChart data={data} barCategoryGap="18%">
							{commonChartChildren}
							<Bar name={t("analytics.online.legendServers")} dataKey="servers" fill="#ff4f5e" radius={[6, 6, 0, 0]} maxBarSize={28} hide={!visibleSeries.servers} />
							<Bar name={t("analytics.online.legendPlayers")} dataKey="players" fill="#00af5c" radius={[6, 6, 0, 0]} maxBarSize={28} hide={!visibleSeries.players} />
						</BarChart>
					) : (
						<AreaChart data={data}>
							<defs>
								<linearGradient id="projectAnalyticsServers" x1="0" y1="0" x2="0" y2="1">
									<stop offset="5%" stopColor="#ff4f5e" stopOpacity={0.24} />
									<stop offset="95%" stopColor="#ff4f5e" stopOpacity={0.03} />
								</linearGradient>
								<linearGradient id="projectAnalyticsPlayers" x1="0" y1="0" x2="0" y2="1">
									<stop offset="5%" stopColor="#00af5c" stopOpacity={0.24} />
									<stop offset="95%" stopColor="#00af5c" stopOpacity={0.03} />
								</linearGradient>
							</defs>
							{commonChartChildren}
							<Area name={t("analytics.online.legendServers")} type="monotone" dataKey="servers" stroke="#ff4f5e" strokeWidth={3} fill="url(#projectAnalyticsServers)" hide={!visibleSeries.servers} />
							<Area name={t("analytics.online.legendPlayers")} type="monotone" dataKey="players" stroke="#00af5c" strokeWidth={3} fill="url(#projectAnalyticsPlayers)" hide={!visibleSeries.players} />
						</AreaChart>
					)}
				</ResponsiveContainer>
			</div>
		</section>
	);
}

export default function ProjectAnalyticsSettingsPage({ project, analytics, selectedTimeRange, onlineSummary = null, onlineSeries = [] }) {
	const t = useTranslations("SettingsProjectPage");
	const locale = useLocale();
	const router = useRouter();
	const [isSortOpen, setIsSortOpen] = useState(false);
	const [isOnlineInfoModalOpen, setIsOnlineInfoModalOpen] = useState(false);
	const sortRef = useRef(null);
	const regionNames = typeof Intl.DisplayNames === "function" ? new Intl.DisplayNames([locale], { type: "region" }) : null;
	const downloads = Array.isArray(analytics?.downloads) ? analytics.downloads : [];
	const views = Array.isArray(analytics?.views) ? analytics.views : [];
	const countries = Array.isArray(analytics?.countries) ? analytics.countries : [];
	const hasOnline = onlineSeries.length > 0;
	const totals = analytics?.totals || {};
	const activeServersNow = Number(onlineSummary?.activeServersNow) || 0;
	const playersOnlineNow = Number(onlineSummary?.playersOnlineNow) || 0;
	const currentTimeRange = selectedTimeRange || "7d";

	useEffect(() => {
		const handleClickOutside = (event) => {
			if(sortRef.current && !sortRef.current.contains(event.target)) {
				setIsSortOpen(false);
			}
		};

		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, []);

	const handleSortOptionClick = (nextSort) => {
		router.push(getTimeRangeHref(project, nextSort));
		setIsSortOpen(false);
	};

	return (
		<div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
			<div className="settings-wrapper">
				<div className="settings-content">
					<div className="blog-settings">
						<div className="blog-settings__body">
							<div className="project-analytics">
								<div className="project-analytics__toolbar">
									<p className="blog-settings__field-title" style={{ marginBottom: "0" }}>{t("analytics.title")}</p>

									<div className="project-analytics__ranges">
										<div className="sort-wrapper" ref={sortRef}>
											<div className="dropdown">
												<button className="dropdown__label button--active-transform" style={{ background: "var(--theme-color-background)", borderRadius: "12px", padding: "0 12px", height: "35px" }} onClick={() => setIsSortOpen((prev) => !prev)} aria-expanded={isSortOpen} type="button">
													<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: "8px", width: "20px", height: "20px", fill: "none" }}>
														<path d="M8 2v4"></path>
														<path d="M16 2v4"></path>
														<rect width="18" height="18" x="3" y="4" rx="2"></rect>
														<path d="M3 10h18"></path>
													</svg>
													
													{currentTimeRange === "3d" && t("analytics.ranges.3d")}
													{currentTimeRange === "7d" && t("analytics.ranges.7d")}
													{currentTimeRange === "30d" && t("analytics.ranges.30d")}
													{currentTimeRange === "90d" && t("analytics.ranges.90d")}

													<svg style={{ fill: "none" }} xmlns="http://www.w3.org/2000/svg" className={`icon icon--chevron_up ${isSortOpen ? "open" : ""}`} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
														<path d="m6 9 6 6 6-6"/>
													</svg>
												</button>
											</div>

											{isSortOpen && (
												<div className="popover popover--sort">
													<div className="context-list" data-scrollable="" style={{ maxHeight: "none" }}>
														<div className={`context-list-option ${currentTimeRange === "3d" ? "context-list-option--selected" : ""}`} onClick={() => handleSortOptionClick("3d")}>
															<div className="context-list-option__label">{t("analytics.ranges.3d")}</div>
														</div>
														<div className={`context-list-option ${currentTimeRange === "7d" ? "context-list-option--selected" : ""}`} onClick={() => handleSortOptionClick("7d")}>
															<div className="context-list-option__label">{t("analytics.ranges.7d")}</div>
														</div>
														<div className={`context-list-option ${currentTimeRange === "30d" ? "context-list-option--selected" : ""}`} onClick={() => handleSortOptionClick("30d")}>
															<div className="context-list-option__label">{t("analytics.ranges.30d")}</div>
														</div>
														<div className={`context-list-option ${currentTimeRange === "90d" ? "context-list-option--selected" : ""}`} onClick={() => handleSortOptionClick("90d")}>
															<div className="context-list-option__label">{t("analytics.ranges.90d")}</div>
														</div>
													</div>
												</div>
											)}
										</div>
									</div>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		
			<div className="project-analytics__stats">
				<div className="content content--padding project-analytics-stat">
					<p className="project-analytics-stat__label">
						{t("analytics.stats.downloads")}

						<svg xmlns="http://www.w3.org/2000/svg" style={{ fill: "none", marginLeft: "auto" }} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
							<path d="M12 15V3"></path>
							<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
							<path d="m7 10 5 5 5-5"></path>
						</svg>
					</p>

					<strong>{totals.downloads || 0}</strong>
				</div>

				<div className="content content--padding project-analytics-stat">
					<p className="project-analytics-stat__label">
						{t("analytics.live.activeServers")}

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
						{t("analytics.stats.onlineNow")}
						
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
					title={t("analytics.online.title")}
					data={onlineSeries}
					locale={locale}
					t={t}
				/>
			) : null}

			<AnalyticsOnlineInfoModal
				isOpen={isOnlineInfoModalOpen}
				onRequestClose={() => setIsOnlineInfoModalOpen(false)}
			/>

			<AnalyticsChart
				title={t("analytics.downloads.title")}
				data={downloads}
				locale={locale}
				lineColor="#00af5c"
				gradientId="projectAnalyticsDownloads"
				tooltipLabelKey="analytics.downloads.tooltip"
				t={t}
			/>

			{countries.length ? (
				<section className="content content--padding" style={{ padding: "24px" }}>
					<div className="project-analytics-card__header">
						<div>
							<p className="project-analytics-card__eyebrow">{t("analytics.countries.eyebrow")}</p>
							<h2 className="project-analytics-card__title" style={{ marginBottom: "0" }}>{t("analytics.countries.title")}</h2>
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

			<AnalyticsChart
				title={t("analytics.views.title")}
				data={views}
				locale={locale}
				lineColor="#307df0"
				gradientId="projectAnalyticsViews"
				tooltipLabelKey="analytics.views.tooltip"
				t={t}
			/>
		</div>
	);
}