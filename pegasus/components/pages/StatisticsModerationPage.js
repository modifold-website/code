"use client";

import React, { useState } from "react";
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, Legend } from "recharts";
import { useLocale, useTranslations } from "next-intl";
import { useModerationStatistics } from "@/utils/moderation/hooks";

const formatDate = (isoDate, locale) => {
	const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(isoDate) ? `${isoDate}T00:00:00` : isoDate);
	return date.toLocaleDateString(locale, { day: "numeric", month: "short" });
};

const formatDateTime = (isoDate, locale) => {
	const date = new Date(isoDate);
	return date.toLocaleString(locale, {
		day: "numeric",
		month: "short",
		hour: "2-digit",
		minute: "2-digit",
	});
};

const CustomTooltip = ({ active, payload, chartType, locale, t }) => {
	if(active && payload && payload.length) {
		const dataPoint = payload[0].payload;
		const label = chartType === "registrations" ? t("charts.registrations") : t("charts.projects");

		return (
			<div className="project-analytics-tooltip">
				<p>{formatDate(dataPoint.date, locale)}</p>

				<span>{label}: {dataPoint.count}</span>
			</div>
		);
	}

	return null;
};

const OnlineTooltip = ({ active, payload, locale, tSettings, visibleSeries }) => {
	if(!active || !payload?.length) {
		return null;
	}

	const point = payload[0]?.payload;
	if(!point) {
		return null;
	}

	return (
		<div className="project-analytics-tooltip">
			<p>{formatDateTime(point.date, locale)}</p>
			
			{visibleSeries.servers ? <span>{tSettings("analytics.online.tooltipServers", { count: Number(point.servers) || 0 })}</span> : null}
			
			{visibleSeries.players ? <span>{tSettings("analytics.online.tooltipPlayers", { count: Number(point.players) || 0 })}</span> : null}
		</div>
	);
};

const OnlineChart = ({ data, locale, tSettings, t, available, loading }) => {
	const [visibleSeries, setVisibleSeries] = useState({ servers: true, players: true });

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

	return (
		<div className="content content--padding moderation-chart-card moderation-statistics__online">
			<h3>
				<span className={loading ? "skeleton skeleton-bar moderation-statistics__skeleton-text" : undefined} aria-hidden={loading || undefined}>
					{tSettings("analytics.online.title")}
				</span>
			</h3>

			{loading ? (
				<div className="skeleton skeleton-bar moderation-statistics__chart-skeleton moderation-statistics__chart-skeleton--online" aria-hidden="true" />
			) : !available ? (
				<p className="moderation-statistics__hint">{t("statistics.unavailable")}</p>
			) : !data.length ? (
				<p className="moderation-statistics__hint">{t("statistics.empty")}</p>
			) : (
				<div className="project-analytics-chart">
					<ResponsiveContainer width="100%" height={340}>
						<AreaChart data={data}>
							<defs>
								<linearGradient id="moderationAnalyticsServers" x1="0" y1="0" x2="0" y2="1">
									<stop offset="5%" stopColor="#ff4f5e" stopOpacity={0.24} />
									<stop offset="95%" stopColor="#ff4f5e" stopOpacity={0.03} />
								</linearGradient>
								<linearGradient id="moderationAnalyticsPlayers" x1="0" y1="0" x2="0" y2="1">
									<stop offset="5%" stopColor="#00af5c" stopOpacity={0.24} />
									<stop offset="95%" stopColor="#00af5c" stopOpacity={0.03} />
								</linearGradient>
							</defs>

							<CartesianGrid stroke="var(--theme-color-text-primary)" strokeDasharray="4 4" strokeOpacity={0.1} vertical={false} />
							<XAxis
								dataKey="date"
								tickFormatter={(value) => formatDateTime(value, locale)}
								interval="preserveStartEnd"
								minTickGap={42}
								padding={{ left: 12, right: 12 }}
								tickLine={false}
								axisLine={false}
								tickMargin={8}
								style={{ fontSize: "12px" }}
							/>
							<YAxis allowDecimals={false} tickLine={false} axisLine={false} width={28} tickMargin={4} style={{ fontSize: "12px" }} />
							<Tooltip content={<OnlineTooltip locale={locale} tSettings={tSettings} visibleSeries={visibleSeries} />} />
							<Legend
								verticalAlign="bottom"
								iconType="circle"
								iconSize={12}
								onClick={toggleSeries}
								formatter={(value, entry) => (
									<span className={`project-analytics-legend__label ${visibleSeries[entry?.dataKey] === false ? "project-analytics-legend__label--inactive" : ""}`}>{value}</span>
								)}
							/>
							<Area
								name={tSettings("analytics.online.legendServers")}
								type="monotone"
								dataKey="servers"
								stroke="#ff4f5e"
								strokeWidth={3}
								fill="url(#moderationAnalyticsServers)"
								hide={!visibleSeries.servers}
							/>
							<Area
								name={tSettings("analytics.online.legendPlayers")}
								type="monotone"
								dataKey="players"
								stroke="#00af5c"
								strokeWidth={3}
								fill="url(#moderationAnalyticsPlayers)"
								hide={!visibleSeries.players}
							/>
						</AreaChart>
					</ResponsiveContainer>
				</div>
			)}
		</div>
	);
};

export default function StatisticsModerationPage({ initialAnalytics, authToken }) {
	const t = useTranslations("ModerationPage");
	const tSettings = useTranslations("SettingsProjectPage");
	const locale = useLocale();
	const [timeRange, setTimeRange] = useState("30d");
	const query = useModerationStatistics({ authToken, timeRange, initialAnalytics });
	const analytics = query.data;
	const isLoading = query.isFetching;
	const statisticsCards = [
		{ key: "totalApproved", value: analytics?.totalApproved },
		{ key: "totalUnpublishedProjects", value: analytics?.totalUnpublishedProjects },
		{ key: "totalUsers", value: analytics?.totalUsers },
		{ key: "pending", value: analytics?.totalPending },
		{ key: "totalProjectVersions", value: analytics?.totalProjectVersions },
		{ key: "totalProjectDownloads", value: analytics?.totalProjectDownloads },
		{ key: "modServersOnlineNow", value: analytics?.onlineAvailable ? analytics?.onlineSummary?.activeServersNow : null },
		{ key: "modsPlayersOnlineNow", value: analytics?.onlineAvailable ? analytics?.onlineSummary?.playersOnlineNow : null },
	];
	const onlineSeries = Array.isArray(analytics?.globalOnlineSeries) ? analytics.globalOnlineSeries.map((point) => ({
		date: String(point.day || point.date || ""),
		players: Number(point.players ?? point.joins) || 0,
		servers: Number(point.servers) || 0,
	})).filter((point) => Boolean(point.date)) : [];

	return (
		<section className="moderation-statistics" aria-busy={query.isFetching}>
			{query.isError && (
				<div className="content content--padding moderation-statistics__error" role="alert">
					<p>{t("statistics.error")}</p>

					<button type="button" className="button button--size-m button--type-minimal" onClick={() => query.refetch()}>
						{t("statistics.retry")}
					</button>
				</div>
			)}

			<div className="analytics-grid">
				{statisticsCards.map(({ key, value }) => (
					<div key={key} className="content content--padding moderation-statistics__metric">
						<h3>
							<span className={isLoading ? "skeleton skeleton-bar moderation-statistics__skeleton-text" : undefined} aria-hidden={isLoading || undefined}>
								{t(`stats.${key}`)}
							</span>
						</h3>

						<p className={`moderation-statistics__value${isLoading ? " skeleton skeleton-bar moderation-statistics__skeleton-value" : ""}`} aria-hidden={isLoading || undefined}>
							{isLoading ? "00" : value ?? "—"}
						</p>
					</div>
				))}
			</div>

			<div className="moderation-toolbar">
				<h2 className="moderation-statistics__heading">{t("statistics.period")}</h2>

				<div className="moderation-statistics__periods" role="group" aria-label={t("statistics.period")}>
					{["7d", "30d", "90d"].map((value) => (
						<button key={value} type="button" className={`button button--size-m ${timeRange === value ? "button--type-primary" : "button--type-secondary"}`} aria-pressed={timeRange === value} onClick={() => setTimeRange(value)}>
							{t("statistics.days", { count: Number.parseInt(value, 10) })}
						</button>
					))}
				</div>
			</div>

			<div className="moderation-statistics__charts">
				<div className="content content--padding moderation-chart-card">
					<h3>
						<span className={isLoading ? "skeleton skeleton-bar moderation-statistics__skeleton-text" : undefined} aria-hidden={isLoading || undefined}>
							{t("charts.approvedProjects")}
						</span>
					</h3>

					{isLoading ? (
						<div className="skeleton skeleton-bar moderation-statistics__chart-skeleton" aria-hidden="true" />
					) : (
						<ResponsiveContainer width="100%" height={300}>
							<AreaChart data={analytics?.approvedProjects || []}>
								<defs>
									<linearGradient id="colorApprovedProjects" x1="0" y1="0" x2="0" y2="1">
										<stop offset="5%" stopColor="#307df0" stopOpacity={0.8} />
										<stop offset="95%" stopColor="#307df0" stopOpacity={0} />
									</linearGradient>
								</defs>
								<CartesianGrid stroke="var(--theme-color-text-primary)" strokeDasharray="5 5" strokeOpacity={0.1} />
								<XAxis dataKey="date" tickFormatter={(date) => formatDate(date, locale)} style={{ fontSize: "12px" }} stroke="var(--theme-color-text-primary)" strokeOpacity={0.1} />
								<YAxis dataKey="count" allowDecimals={false} width={36} style={{ fontSize: "12px" }} stroke="var(--theme-color-text-primary)" strokeOpacity={0.1} />
								<Tooltip content={<CustomTooltip chartType="projects" locale={locale} t={t} />} />
								<Area type="monotone" dataKey="count" stroke="#307df0" strokeWidth={3} fillOpacity={1} fill="url(#colorApprovedProjects)" />
							</AreaChart>
						</ResponsiveContainer>
					)}
				</div>

				<div className="content content--padding moderation-chart-card">
					<h3>
						<span className={isLoading ? "skeleton skeleton-bar moderation-statistics__skeleton-text" : undefined} aria-hidden={isLoading || undefined}>
							{t("charts.userRegistrations")}
						</span>
					</h3>

					{isLoading ? (
						<div className="skeleton skeleton-bar moderation-statistics__chart-skeleton" aria-hidden="true" />
					) : (
						<ResponsiveContainer width="100%" height={300}>
							<AreaChart data={analytics?.userRegistrations || []}>
								<defs>
									<linearGradient id="colorUserRegistrations" x1="0" y1="0" x2="0" y2="1">
										<stop offset="5%" stopColor="#307df0" stopOpacity={0.8} />
										<stop offset="95%" stopColor="#307df0" stopOpacity={0} />
									</linearGradient>
								</defs>
								<CartesianGrid stroke="var(--theme-color-text-primary)" strokeDasharray="5 5" strokeOpacity={0.1} />
								<XAxis dataKey="date" tickFormatter={(date) => formatDate(date, locale)} style={{ fontSize: "12px" }} stroke="var(--theme-color-text-primary)" strokeOpacity={0.1} />
								<YAxis dataKey="count" allowDecimals={false} width={36} style={{ fontSize: "12px" }} stroke="var(--theme-color-text-primary)" strokeOpacity={0.1} />
								<Tooltip content={<CustomTooltip chartType="registrations" locale={locale} t={t} />} />
								<Area type="monotone" dataKey="count" stroke="#307df0" strokeWidth={3} fillOpacity={1} fill="url(#colorUserRegistrations)" />
							</AreaChart>
						</ResponsiveContainer>
					)}
				</div>
			</div>

			<OnlineChart
				data={onlineSeries}
				locale={locale}
				tSettings={tSettings}
				t={t}
				available={Boolean(analytics?.onlineAvailable)}
				loading={isLoading}
			/>
		</section>
	);
}