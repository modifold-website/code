"use client";

import { useState } from "react";
import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import AnalyticsOnlineInfoModal from "@/modal/AnalyticsOnlineInfoModal";

const analyticsPreviewData = [
	{ date: "2026-05-21T00:00:00Z", players: 18, servers: 7 },
	{ date: "2026-05-21T02:00:00Z", players: 42, servers: 15 },
	{ date: "2026-05-21T04:00:00Z", players: 36, servers: 19 },
	{ date: "2026-05-21T06:00:00Z", players: 72, servers: 28 },
	{ date: "2026-05-21T08:00:00Z", players: 54, servers: 36 },
	{ date: "2026-05-21T10:00:00Z", players: 95, servers: 48 },
	{ date: "2026-05-21T12:00:00Z", players: 68, servers: 45 },
	{ date: "2026-05-21T14:00:00Z", players: 118, servers: 57 },
	{ date: "2026-05-21T16:00:00Z", players: 82, servers: 51 },
	{ date: "2026-05-21T18:00:00Z", players: 136, servers: 64 },
	{ date: "2026-05-21T20:00:00Z", players: 104, servers: 61 },
	{ date: "2026-05-21T22:00:00Z", players: 148, servers: 74 },
	{ date: "2026-05-22T00:00:00Z", players: 96, servers: 58 },
	{ date: "2026-05-22T02:00:00Z", players: 132, servers: 66 },
	{ date: "2026-05-22T04:00:00Z", players: 88, servers: 55 },
	{ date: "2026-05-22T06:00:00Z", players: 154, servers: 72 },
	{ date: "2026-05-22T08:00:00Z", players: 112, servers: 78 },
	{ date: "2026-05-22T10:00:00Z", players: 126, servers: 83 },
	{ date: "2026-05-22T12:00:00Z", players: 101, servers: 77 },
	{ date: "2026-05-22T14:00:00Z", players: 138, servers: 88 },
	{ date: "2026-05-22T16:00:00Z", players: 118, servers: 92 },
	{ date: "2026-05-22T18:00:00Z", players: 146, servers: 86 },
	{ date: "2026-05-22T20:00:00Z", players: 121, servers: 96 },
	{ date: "2026-05-22T22:00:00Z", players: 162, servers: 102 },
];

const formatAnalyticsDate = (date, locale) => {
	const normalized = typeof date === "string" && date.includes("T") ? date : `${date}T00:00:00Z`;
	const value = new Date(normalized);
	return value.toLocaleString(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
};

function HomeAnalyticsTooltip({ active, payload, locale, t }) {
	if(!active || !payload?.length) {
		return null;
	}

	const point = payload[0]?.payload;
	if(!point) {
		return null;
	}

	return (
		<div className="project-analytics-tooltip creator-analytics-tooltip">
			<p>{formatAnalyticsDate(point.date, locale)}</p>
			<span>{t("analyticsSection.players")}: {point.players}</span>
			<span>{t("analyticsSection.servers")}: {point.servers}</span>
		</div>
	);
}

export default function HomeAnalyticsSection({ currentLocale, t }) {
	const [isOnlineInfoModalOpen, setIsOnlineInfoModalOpen] = useState(false);

	return (
		<>
			<section className="creator-analytics-section">
				<div className="creator-analytics-copy">
					<span className="home-pill home-pill--analytics">{t("analyticsSection.badge")}</span>

					<h2 className="creator-analytics-title">{t("analyticsSection.title")}</h2>

					<p className="creator-analytics-lead">{t("analyticsSection.lead")}</p>

					<button className="button button--size-xl button--type-secondary button--with-icon button--active-transform" type="button" onClick={() => setIsOnlineInfoModalOpen(true)} style={{ "--icon-size": "20px" }}>
						<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-circle-question-mark-icon lucide-circle-question-mark">
							<circle cx="12" cy="12" r="10"></circle>
							<path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
							<path d="M12 17h.01"></path>
						</svg>

						{t("analyticsSection.learnMore")}
					</button>
				</div>
				
				<div className="creator-analytics-card" aria-label={t("analyticsSection.chartLabel")}>
					<div className="creator-analytics-metrics">
						<div>
							<span>{t("analyticsSection.downloads")}</span>
							<strong>1711</strong>
						</div>

						<div>
							<span>{t("analyticsSection.activeServers")}</span>
							<strong>42</strong>
						</div>

						<div>
							<span>
								{t("analyticsSection.onlineNow")}

								<span className="project-analytics-info" onClick={() => setIsOnlineInfoModalOpen(true)} style={{ marginBottom: 0 }}>
									<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
										<circle cx="12" cy="12" r="10"/>
										<path d="M12 16v-4"/>
										<path d="M12 8h.01"/>
									</svg>
								</span>
							</span>
							<strong>67</strong>
						</div>
					</div>

					<div className="creator-analytics-chart project-analytics-chart">
						<ResponsiveContainer width="100%" height={340} minWidth={0}>
							<AreaChart data={analyticsPreviewData} margin={{ top: 8, right: 10, left: 0, bottom: 0 }}>
								<defs>
									<linearGradient id="homeAnalyticsViews" x1="0" y1="0" x2="0" y2="1">
										<stop offset="5%" stopColor="#00af5c" stopOpacity={0.24} />
										<stop offset="95%" stopColor="#00af5c" stopOpacity={0.02} />
									</linearGradient>
									<linearGradient id="homeAnalyticsDownloads" x1="0" y1="0" x2="0" y2="1">
										<stop offset="5%" stopColor="#ff4f5e" stopOpacity={0.18} />
										<stop offset="95%" stopColor="#ff4f5e" stopOpacity={0.02} />
									</linearGradient>
								</defs>

								<CartesianGrid stroke="var(--theme-color-text-primary)" strokeDasharray="4 4" strokeOpacity={0.1} vertical={false} />
								<XAxis
									dataKey="date"
									tickFormatter={(value) => formatAnalyticsDate(value, currentLocale)}
									interval="preserveStartEnd"
									minTickGap={26}
									tickLine={false}
									axisLine={false}
									tickMargin={8}
									style={{ fontSize: "12px" }}
								/>
								<YAxis allowDecimals={false} tickLine={false} axisLine={false} width={36} tickMargin={4} style={{ fontSize: "12px" }} />
								<Tooltip content={<HomeAnalyticsTooltip locale={currentLocale} t={t} />} />
								<Legend
									verticalAlign="bottom"
									iconType="circle"
									iconSize={12}
									formatter={(value) => <span className="project-analytics-legend__label">{value}</span>}
								/>
								<Area name={t("analyticsSection.players")} type="monotone" dataKey="players" stroke="#00af5c" strokeWidth={3} fill="url(#homeAnalyticsViews)" />
								<Area name={t("analyticsSection.servers")} type="monotone" dataKey="servers" stroke="#ff4f5e" strokeWidth={3} fill="url(#homeAnalyticsDownloads)" />
							</AreaChart>
						</ResponsiveContainer>
					</div>
				</div>
			</section>

			<AnalyticsOnlineInfoModal isOpen={isOnlineInfoModalOpen} onRequestClose={() => setIsOnlineInfoModalOpen(false)} />
		</>
	);
}