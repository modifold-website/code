"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { getProjectPath } from "@/utils/projectRoutes";

function DownloadTooltip({ active, payload, formatDate, locale, t }) {
	if(!active || !payload?.length) {
		return null;
	}

	const point = payload[0].payload;

	return (
		<div className="project-analytics-tooltip">
			<p>{formatDate(point.date, locale)}</p>
			
			<span>{t("downloads.tooltip", { count: Number(point.count) || 0 })}</span>
		</div>
	);
}

function DownloadBreakdown({ title, items, loading, t, renderItem, withIcons = false }) {
	const listRef = useRef(null);
	const updateFade = useCallback(() => {
		const list = listRef.current;
		if(!list) {
			return;
		}

		const top = String(list.scrollTop > 1);
		const bottom = String(list.scrollTop + list.clientHeight < list.scrollHeight - 1);
		if(list.dataset.fadeTop !== top) {
			list.dataset.fadeTop = top;
		}

		if(list.dataset.fadeBottom !== bottom) {
			list.dataset.fadeBottom = bottom;
		}
	}, []);

	useEffect(() => {
		const list = listRef.current;
		list.scrollTop = 0;
		updateFade();
		const observer = new ResizeObserver(updateFade);
		observer.observe(list);
		if(list.firstElementChild) {
			observer.observe(list.firstElementChild);
		}

		list.addEventListener("scroll", updateFade, { passive: true });

		return () => {
			observer.disconnect();
			list.removeEventListener("scroll", updateFade);
		};
	}, [items, loading, updateFade]);

	return (
		<div className="content content--padding moderation-chart-card moderation-downloads__breakdown">
			<h3>
				<span className={loading ? "skeleton skeleton-bar moderation-statistics__skeleton-text" : undefined} aria-hidden={loading || undefined}>
					{title}
				</span>
			</h3>

			<div
				ref={listRef}
				className="moderation-downloads__list"
				role="region"
				aria-label={title}
				tabIndex={items?.length && !loading ? 0 : undefined}
				onFocusCapture={(event) => {
					if(event.target !== event.currentTarget) {
						event.target.closest(".moderation-downloads__row")?.scrollIntoView({ block: "nearest", inline: "nearest" });
					}
				}}
			>
				{loading ? (
					<div aria-hidden="true">
						{Array.from({ length: 4 }, (_, index) => (
							<div key={index} className="moderation-downloads__row">
								{withIcons && <span className="skeleton skeleton-bar moderation-downloads__icon" />}
								
								<span className="skeleton skeleton-bar moderation-downloads__skeleton-name" />
								
								<span className="skeleton skeleton-bar moderation-downloads__skeleton-count" />
							</div>
						))}
					</div>
				) : !items ? (
					<p className="moderation-statistics__hint">{t("statistics.unavailable")}</p>
				) : !items.length ? (
					<p className="moderation-statistics__hint">{t("statistics.empty")}</p>
				) : (
					<ul role="list">
						{items.map(renderItem)}
					</ul>
				)}
			</div>
		</div>
	);
}

export default function ModerationDownloadsChart({ analytics, loading, locale, t, formatDate }) {
	const regionNames = useMemo(() => (
		typeof Intl.DisplayNames === "function" ? new Intl.DisplayNames([locale], { type: "region" }) : null
	), [locale]);
	const numberFormatter = useMemo(() => new Intl.NumberFormat(locale), [locale]);
	const series = Array.isArray(analytics?.projectDownloads) ? analytics.projectDownloads : [];
	const countries = Array.isArray(analytics?.downloadCountries) ? analytics.downloadCountries : null;
	const projects = Array.isArray(analytics?.downloadProjects) ? analytics.downloadProjects : null;

	const getCountryName = (countryCode) => {
		const code = String(countryCode || "").toUpperCase();
		if(!/^[A-Z]{2}$/.test(code) || code === "XX" || code === "ZZ") {
			return t("downloads.unknownCountry");
		}

		return regionNames?.of(code) || code;
	};

	return (
		<section className="moderation-downloads">
			<div className="content content--padding moderation-chart-card moderation-downloads__chart">
				<h3>
					<span className={loading ? "skeleton skeleton-bar moderation-statistics__skeleton-text" : undefined} aria-hidden={loading || undefined}>
						{t("statistics.downloads")}
					</span>
				</h3>

				{loading ? (
					<div className="skeleton skeleton-bar moderation-statistics__chart-skeleton moderation-downloads__chart-skeleton" aria-hidden="true" />
				) : !analytics?.downloadsAvailable ? (
					<p className="moderation-statistics__hint">{t("statistics.unavailable")}</p>
				) : !series.length ? (
					<p className="moderation-statistics__hint">{t("statistics.empty")}</p>
				) : (
					<div className="moderation-downloads__plot">
						<ResponsiveContainer width="100%" height="100%">
							<AreaChart data={series} accessibilityLayer>
								<defs>
									<linearGradient id="moderationDownloads" x1="0" y1="0" x2="0" y2="1">
										<stop offset="5%" stopColor="var(--theme-color-brand-primary)" stopOpacity={0.24} />
										<stop offset="95%" stopColor="var(--theme-color-brand-primary)" stopOpacity={0.02} />
									</linearGradient>
								</defs>
								<CartesianGrid stroke="var(--theme-color-text-primary)" strokeDasharray="4 4" strokeOpacity={0.1} vertical={false} />
								<XAxis
									dataKey="date"
									tickFormatter={(date) => formatDate(date, locale)}
									interval="preserveStartEnd"
									minTickGap={32}
									tickLine={false}
									axisLine={false}
									tickMargin={8}
									stroke="var(--theme-color-text-secondary)"
									fontSize={12}
								/>
								<YAxis allowDecimals={false} domain={[0, "auto"]} tickLine={false} axisLine={false} width={48} tickFormatter={(value) => numberFormatter.format(value)} stroke="var(--theme-color-text-secondary)" fontSize={12} />
								<Tooltip content={<DownloadTooltip formatDate={formatDate} locale={locale} t={t} />} />
								<Area name={t("statistics.downloads")} type="linear" dataKey="count" stroke="var(--theme-color-brand-primary)" strokeWidth={3} fill="url(#moderationDownloads)" isAnimationActive={false} />
							</AreaChart>
						</ResponsiveContainer>
					</div>
				)}
			</div>

			<div className="moderation-downloads__breakdowns">
				<DownloadBreakdown
					title={t("downloads.countries")}
					items={countries}
					loading={loading}
					t={t}
					renderItem={(country) => {
						const code = String(country.country_code || "").toLowerCase();
						const hasFlag = /^[a-z]{2}$/.test(code) && code !== "xx" && code !== "zz";

						return (
							<li key={country.country_code} className="moderation-downloads__row">
								<span className="moderation-downloads__country">
									{hasFlag && <img className="moderation-downloads__flag" src={`https://flagcdn.com/${code}.svg`} alt="" width="38" height="25" loading="lazy" />}
									
									<span className="moderation-downloads__name">{getCountryName(country.country_code)}</span>
								</span>

								<span className="moderation-downloads__count">{numberFormatter.format(country.count)}</span>
							</li>
						);
					}}
				/>

				<DownloadBreakdown
					title={t("downloads.projects")}
					items={projects}
					loading={loading}
					t={t}
					withIcons
					renderItem={(project) => (
						<li key={project.slug} className="moderation-downloads__row">
							{project.slug ? (
								<Link href={getProjectPath(project)} prefetch={false} className="moderation-downloads__project">
									<img className="moderation-downloads__icon" src={project.icon_url || "/images/no-project-icon.svg"} alt="" width="32" height="32" loading="lazy" />
									<span className="moderation-downloads__name">{project.title || project.slug}</span>
								</Link>
							) : (
								<span className="moderation-downloads__project">
									<img className="moderation-downloads__icon" src="/images/no-project-icon.svg" alt="" width="32" height="32" />
									<span className="moderation-downloads__name">{project.title || t("downloads.unknownProject")}</span>
								</span>
							)}

							<span className="moderation-downloads__count">{numberFormatter.format(project.count)}</span>
						</li>
					)}
				/>
			</div>
		</section>
	);
}