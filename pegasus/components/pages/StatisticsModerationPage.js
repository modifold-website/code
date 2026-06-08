"use client";

import React, { useState } from "react";
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, Legend } from "recharts";
import { useLocale, useTranslations } from "next-intl";

const formatDate = (isoDate, locale) => {
	const date = new Date(isoDate);
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
				<p>{formatDateTime(dataPoint.date, locale)}</p>
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

const OnlineChart = ({ data, locale, tSettings }) => {
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
		<div className="content content--padding moderation-chart-card" style={{ marginBottom: "15px", padding: "24px" }}>
			<h3>{tSettings("analytics.online.title")}</h3>

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
		</div>
	);
};

const EMPTY_ANALYTICS = {
	approvedProjects: [],
	pendingProjects: [],
	userRegistrations: [],
	totalApproved: 0,
	totalPending: 0,
	totalUsers: 0,
	totalProjectVersions: 0,
	totalProjectDownloads: 0,
	totalUnpublishedProjects: 0,
	totalPlayersOnlineNow: 0,
	totalActiveServersNow: 0,
	onlineSummary: {
		playersOnlineNow: 0,
		activeServersNow: 0,
	},
	globalOnlineSeries: [],
};

export default function StatisticsModerationPage({ initialAnalytics }) {
	const t = useTranslations("ModerationPage");
	const tSettings = useTranslations("SettingsProjectPage");
	const locale = useLocale();
	const [analytics] = useState(initialAnalytics || EMPTY_ANALYTICS);
	const onlineSummary = analytics?.onlineSummary || {};
	const playersOnlineNow = Number(onlineSummary.playersOnlineNow ?? analytics?.totalPlayersOnlineNow) || 0;
	const activeServersNow = Number(onlineSummary.activeServersNow ?? analytics?.totalActiveServersNow) || 0;
	const onlineSeries = Array.isArray(analytics?.globalOnlineSeries) ? analytics.globalOnlineSeries.map((point) => ({
		date: String(point.day || point.date || "").slice(0, 19),
		players: Number(point.players ?? point.joins) || 0,
		servers: Number(point.servers) || 0,
	})).filter((point) => Boolean(point.date)) : [];

	return (
		<>
			<div className="analytics-grid">
				<div className="content content--padding">
					<h3>{t("stats.totalApproved")}</h3>
					<p style={{ fontSize: "2rem", margin: "10px 0" }}>{analytics.totalApproved}</p>
				</div>

				<div className="content content--padding">
					<h3>{t("stats.totalUnpublishedProjects")}</h3>
					<p style={{ fontSize: "2rem", margin: "10px 0" }}>{analytics.totalUnpublishedProjects}</p>
				</div>

				<div className="content content--padding">
					<h3>{t("stats.totalUsers")}</h3>
					<p style={{ fontSize: "2rem", margin: "10px 0" }}>{analytics.totalUsers}</p>
				</div>

				<div className="content content--padding">
					<h3>{t("stats.pending")}</h3>
					<p style={{ fontSize: "2rem", margin: "10px 0" }}>{analytics.totalPending}</p>
				</div>

				<div className="content content--padding">
					<h3>{t("stats.totalProjectVersions")}</h3>
					<p style={{ fontSize: "2rem", margin: "10px 0" }}>{analytics.totalProjectVersions}</p>
				</div>

				<div className="content content--padding">
					<h3>{t("stats.totalProjectDownloads")}</h3>
					<p style={{ fontSize: "2rem", margin: "10px 0" }}>{analytics.totalProjectDownloads}</p>
				</div>

				<div className="content content--padding">
					<h3>{t("stats.modServersOnlineNow")}</h3>
					<p style={{ fontSize: "2rem", margin: "10px 0" }}>{activeServersNow}</p>
				</div>

				<div className="content content--padding">
					<h3>{t("stats.modsPlayersOnlineNow")}</h3>
					<p style={{ fontSize: "2rem", margin: "10px 0" }}>{playersOnlineNow}</p>
				</div>
			</div>

			{onlineSeries.length ? (
				<OnlineChart
					data={onlineSeries}
					locale={locale}
					tSettings={tSettings}
				/>
			) : null}

			<div className="content content--padding moderation-chart-card" style={{ marginBottom: "15px" }}>
				<h3>{t("charts.approvedProjects")}</h3>

				<ResponsiveContainer width="100%" height={300}>
					<AreaChart data={analytics.approvedProjects}>
						<defs>
							<linearGradient id="colorApprovedProjects" x1="0" y1="0" x2="0" y2="1">
								<stop offset="5%" stopColor="#307df0" stopOpacity={0.8} />
								<stop offset="95%" stopColor="#307df0" stopOpacity={0} />
							</linearGradient>
						</defs>
						<CartesianGrid stroke="var(--theme-color-text-primary)" strokeDasharray="5 5" strokeOpacity={0.1} />
						<XAxis dataKey="date" tickFormatter={(date) => formatDate(date, locale)} style={{ fontSize: "12px" }} stroke="var(--theme-color-text-primary)" strokeOpacity={0.1} />
						<YAxis dataKey="count" style={{ fontSize: "12px" }} stroke="var(--theme-color-text-primary)" strokeOpacity={0.1} />
						<Tooltip content={<CustomTooltip chartType="projects" locale={locale} t={t} />} />
						<Area type="monotone" dataKey="count" stroke="#307df0" strokeWidth={3} fillOpacity={1} fill="url(#colorApprovedProjects)" />
					</AreaChart>
				</ResponsiveContainer>
			</div>

			<div className="content content--padding moderation-chart-card" style={{ marginBottom: "15px" }}>
				<h3>{t("charts.userRegistrations")}</h3>

				<ResponsiveContainer width="100%" height={300}>
					<AreaChart data={analytics.userRegistrations}>
						<defs>
							<linearGradient id="colorUserRegistrations" x1="0" y1="0" x2="0" y2="1">
								<stop offset="5%" stopColor="#307df0" stopOpacity={0.8} />
								<stop offset="95%" stopColor="#307df0" stopOpacity={0} />
							</linearGradient>
						</defs>
						<CartesianGrid stroke="var(--theme-color-text-primary)" strokeDasharray="5 5" strokeOpacity={0.1} />
						<XAxis dataKey="date" tickFormatter={(date) => formatDate(date, locale)} style={{ fontSize: "12px" }} stroke="var(--theme-color-text-primary)" strokeOpacity={0.1} />
						<YAxis dataKey="count" style={{ fontSize: "12px" }} stroke="var(--theme-color-text-primary)" strokeOpacity={0.1} />
						<Tooltip content={<CustomTooltip chartType="registrations" locale={locale} t={t} />} />
						<Area type="monotone" dataKey="count" stroke="#307df0" strokeWidth={3} fillOpacity={1} fill="url(#colorUserRegistrations)" />
					</AreaChart>
				</ResponsiveContainer>
			</div>
		</>
	);
}