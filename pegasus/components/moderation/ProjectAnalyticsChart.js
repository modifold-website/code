"use client";

import { useId } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { displayDate, displayNumber } from "@/utils/moderation/projectAnalytics";

function ChartTooltip({ active, payload, locale, title, compare, t }) {
	if(!active || !payload?.length) {
		return null;
	}

	const point = payload[0].payload;

	return (
		<div className="project-analytics-tooltip">
			<p>{displayDate(point.date, locale)}</p>
			
			<span>
				{title}: {displayNumber(point.count, locale)}
			</span>

			{compare && (
				<span>
					{t("previous")}: {displayNumber(point.previous, locale)}
				</span>
			)}
		</div>
	);
}

export default function ProjectAnalyticsChart({ report, metric, compare, locale, t }) {
	const id = useId().replaceAll(":", "");
	const title = t(metric === "download" ? "downloads" : "views");
	const points = report.series.map((point, index) => ({
		date: point.date,
		count: point[metric],
		previous: report.previousSeries[index]?.[metric] ?? null,
	}));

	return (
		<section className="content content--padding moderation-chart-card">
			<h3>{title}</h3>

			{!report.available ? (
				<p>{t("unavailable")}</p>
			) : (
				<ResponsiveContainer width="100%" height={300}>
					<AreaChart data={points} accessibilityLayer>
						<defs>
							<linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
								<stop offset="5%" stopColor="var(--theme-color-brand-primary)" stopOpacity={0.8} />
								<stop offset="95%" stopColor="var(--theme-color-brand-primary)" stopOpacity={0} />
							</linearGradient>
						</defs>
						<CartesianGrid
							stroke="var(--theme-color-text-primary)"
							strokeDasharray="5 5"
							strokeOpacity={0.1}
						/>
						<XAxis
							dataKey="date"
							tickFormatter={(value) =>
								new Date(`${value}T00:00:00Z`).toLocaleDateString(locale, {
									day: "numeric",
									month: "short",
									timeZone: "UTC",
								})
							}
							stroke="var(--theme-color-text-primary)"
							strokeOpacity={0.1}
							fontSize={12}
						/>
						<YAxis
							dataKey="count"
							allowDecimals={false}
							width={36}
							tickFormatter={(value) => displayNumber(value, locale)}
							stroke="var(--theme-color-text-primary)"
							strokeOpacity={0.1}
							fontSize={12}
						/>
						<Tooltip content={<ChartTooltip locale={locale} title={title} compare={compare} t={t} />} />
						{compare && (
							<Area
								name={t("previous")}
								type="monotone"
								dataKey="previous"
								stroke="var(--theme-color-text-secondary)"
								strokeDasharray="5 5"
								strokeWidth={2}
								fill="none"
								isAnimationActive={false}
							/>
						)}
						<Area
							name={title}
							type="monotone"
							dataKey="count"
							stroke="var(--theme-color-brand-primary)"
							strokeWidth={3}
							fillOpacity={1}
							fill={`url(#${id})`}
							isAnimationActive={false}
						/>
					</AreaChart>
				</ResponsiveContainer>
			)}
		</section>
	);
}