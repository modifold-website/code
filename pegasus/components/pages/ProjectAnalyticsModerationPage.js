"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import Checkbox from "@/components/ui/Checkbox";
import DatePopover from "@/components/ui/DatePopover";
import ProjectAnalyticsChart from "@/components/moderation/ProjectAnalyticsChart";
import ProjectAnalyticsVersions from "@/components/moderation/ProjectAnalyticsVersions";
import { useProjectAnalytics } from "@/utils/moderation/projectAnalyticsHooks";
import { displayDate, displayNumber } from "@/utils/moderation/projectAnalytics";
import { getProjectPath } from "@/utils/projectRoutes";
import "@/styles/ModerationProjectAnalytics.css";

function Countries({ report, locale, t }) {
	const regionNames = useMemo(() => new Intl.DisplayNames([locale], { type: "region" }), [locale]);

	return (
		<section className="content content--padding">
			<h3>{t("countries")}</h3>

			{!report.breakdownAvailable ? (
				<p>{t("unavailable")}</p>
			) : !report.countries.length ? (
				<p>{t("empty")}</p>
			) : (
				<div className="moderation-project-analytics__list" role="region" aria-label={t("countries")} tabIndex={0}>
					<ul>
						{report.countries.map((country) => (
							<li key={country.country_code || "unknown"} className="moderation-downloads__row">
								<span className="moderation-downloads__country">
									{country.country_code && (
										<img
											className="moderation-downloads__flag"
											src={`https://flagcdn.com/${country.country_code}.svg`}
											alt=""
											width="38"
											height="25"
											loading="lazy"
										/>
									)}

									<span>
										{country.country_code ? regionNames.of(country.country_code.toUpperCase()) : t("unknownCountry")}
									</span>
								</span>

								<span className="moderation-downloads__count">
									{displayNumber(country.count, locale)}
								</span>
							</li>
						))}
					</ul>
				</div>
			)}
		</section>
	);
}

function ReportSkeleton({ t }) {
	return (
		<div className="moderation-project-analytics__skeleton" aria-busy="true" aria-label={t("loading")}>
			<div className="analytics-grid" aria-hidden="true">
				{["downloads", "views", "newVersions", "updated"].map((key) => (
					<div key={key} className="content content--padding moderation-statistics__metric">
						<span>
							<span className="skeleton skeleton-bar moderation-statistics__skeleton-text">{t(key)}</span>
						</span>

						<p className="moderation-statistics__value skeleton skeleton-bar moderation-statistics__skeleton-value">
							00
						</p>
					</div>
				))}
			</div>

			<div className="moderation-statistics__charts" aria-hidden="true">
				{["downloads", "views"].map((key) => (
					<div key={key} className="content content--padding moderation-chart-card">
						<h3>
							<span className="skeleton skeleton-bar moderation-statistics__skeleton-text">{t(key)}</span>
						</h3>

						<div className="skeleton skeleton-bar moderation-statistics__chart-skeleton" />
					</div>
				))}
			</div>

			<div className="moderation-statistics__charts" aria-hidden="true">
				<div className="content content--padding">
					<h3>
						<span className="skeleton skeleton-bar moderation-statistics__skeleton-text">
							{t("countries")}
						</span>
					</h3>

					{[0, 1, 2].map((index) => (
						<div key={index} className="moderation-downloads__row">
							<span className="skeleton skeleton-bar moderation-downloads__skeleton-name" />
							<span className="skeleton skeleton-bar moderation-downloads__skeleton-count" />
						</div>
					))}
				</div>

				<div className="content content--padding">
					<h3>
						<span className="skeleton skeleton-bar moderation-statistics__skeleton-text">
							{t("versions")}
						</span>
					</h3>

					<table className="moderation-project-analytics__versions">
						<thead>
							<tr>
								{["version", "uploaded", "downloads"].map((key) => (
									<th key={key} scope="col">
										<span className="skeleton skeleton-bar moderation-statistics__skeleton-text">
											{t(key)}
										</span>
									</th>
								))}
							</tr>
						</thead>

						<tbody>
							{[0, 1, 2].map((index) => (
								<tr key={index}>
									{[0, 1, 2].map((column) => (
										<td key={column}>
											<span className="skeleton skeleton-bar moderation-statistics__skeleton-text">
												00
											</span>
										</td>
									))}
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</div>
		</div>
	);
}

export default function ProjectAnalyticsModerationPage({ authToken, initialRange }) {
	const t = useTranslations("ModerationProjectAnalytics");
	const filtersT = useTranslations("DashboardAnalyticsPage");
	const locale = useLocale();
	const params = useSearchParams();
	const project = params.get("project") || "";
	const appliedFrom = params.get("from") || initialRange.from;
	const appliedTo = params.get("to") || initialRange.to;
	const [dates, setDates] = useState({ from: appliedFrom, to: appliedTo });
	const [compare, setCompare] = useState(false);
	const [dateError, setDateError] = useState(false);
	const query = useProjectAnalytics({ authToken, project, from: appliedFrom, to: appliedTo });
	const report = query.data;
	const projectPath = getProjectPath(report?.project);
	const dateLabels = {
		placeholder: filtersT("filters.selectDate"),
		clear: filtersT("filters.clearDate"),
		today: filtersT("filters.today"),
		previousMonth: filtersT("filters.previousMonth"),
		nextMonth: filtersT("filters.nextMonth"),
	};
	const hasChanges = dates.from !== appliedFrom || dates.to !== appliedTo;
	const updateUrl = (from, to) => {
		const next = new URLSearchParams(params.toString());
		for(const key of ["period", "version", "from", "to"]) {
			next.delete(key);
		}

		if(from) next.set("from", from);
		if(to) next.set("to", to);
		window.history.replaceState(null, "", `${window.location.pathname}?${next}`);
	};
	const applyDates = (event) => {
		event.preventDefault();
		const days = (Date.parse(dates.to) - Date.parse(dates.from)) / 86400000 + 1;
		if(!dates.from || !dates.to || !Number.isFinite(days) || days < 1 || days > 366) {
			setDateError(true);
			return;
		}

		setDateError(false);
		updateUrl(dates.from, dates.to);
	};
	const changeDate = (key, value) => {
		setDateError(false);
		setDates((current) => ({ ...current, [key]: value }));
	};
	const reset = () => {
		setDates(initialRange);
		setCompare(false);
		setDateError(false);
		updateUrl("", "");
	};
	const errorStatus = query.error?.response?.status;
	const stats = report ? [
		{ key: "downloads", value: displayNumber(report.totals.download, locale) },
		{ key: "views", value: displayNumber(report.totals.view, locale) },
		{ key: "newVersions", value: displayNumber(report.newVersions, locale) },
		{ key: "updated", value: displayDate(report.project.updated_at, locale, true) },
	] : [];

	return (
		<section className="moderation-project-analytics">
			{projectPath ? (
				<Link className="moderation-project-analytics__back" href={projectPath}>
					<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
						<path d="m12 19-7-7 7-7M5 12h14" />
					</svg>

					{t("backToProject")}
				</Link>
			) : project && query.isPending ? (
				<span className="moderation-project-analytics__back" aria-hidden="true">
					<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
						<path d="m12 19-7-7 7-7M5 12h14" />
					</svg>

					{t("backToProject")}
				</span>
			) : null}

			<div className="dashboard-analytics-filter-card__header">
				<h1>{t("title")}</h1>
				
				<div className="dashboard-analytics-filter-card__actions">
					<button type="button" className="button button--size-m button--type-secondary" onClick={reset} disabled={query.isFetching}>
						{filtersT("filters.reset")}
					</button>

					<button type="button" className="button button--size-m button--type-secondary button--with-icon" onClick={() => query.refetch()} disabled={!project || query.isFetching}>
						<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
							<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
							<path d="M21 3v5h-5M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16M8 16H3v5" />
						</svg>

						{filtersT("filters.refresh")}
					</button>
				</div>
			</div>

			{project && query.isPending ? (
				<div className="content content--padding moderation-project-analytics__project" aria-hidden="true">
					<span className="skeleton skeleton-square moderation-project-analytics__icon-skeleton" />
					
					<div className="moderation-project-analytics__identity-skeleton">
						<h3>
							<span className="skeleton skeleton-bar moderation-statistics__skeleton-text">&nbsp;</span>
						</h3>

						<div className="moderation-project-analytics__metadata">
							<span className="skeleton skeleton-bar moderation-statistics__skeleton-text">&nbsp;</span>
						</div>
					</div>
				</div>
			) : report ? (
				<div className="content content--padding moderation-project-analytics__project">
					<img src={report.project.icon_url || "/images/no-project-icon.svg"} alt="" width="48" height="48" />
					
					<div>
						<h3>
							<Link href={getProjectPath(report.project)}>{report.project.title}</Link>
						</h3>

						<div className="moderation-project-analytics__metadata">
							{report.project.owner_slug ? (
								<Link href={`/user/${report.project.owner_slug}`}>{report.project.owner_name}</Link>
							) : null}

							<span>{t(`states.${report.project.status}`)}</span>
							
							<span>{t(`states.${report.project.visibility || "private"}`)}</span>
						</div>
					</div>
				</div>
			) : null}

			<form className="dashboard-analytics-filter-controls" onSubmit={applyDates}>
				<div className="dashboard-analytics-filter-row">
					<div className="dashboard-analytics-filter-row__label">
						<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
							<path d="M8 2v4M16 2v4" />
							<rect x="3" y="4" width="18" height="18" rx="2" />
							<path d="M3 10h18" />
						</svg>

						<span>{filtersT("filters.dateRange")}:</span>
					</div>

					<div className="version-filters dashboard-analytics-filters">
						<DatePopover
							id="project-info-from"
							label={filtersT("filters.from")}
							value={dates.from}
							onChange={(value) => changeDate("from", value)}
							locale={locale}
							labels={dateLabels}
						/>

						<DatePopover
							id="project-info-to"
							label={filtersT("filters.to")}
							value={dates.to}
							onChange={(value) => changeDate("to", value)}
							locale={locale}
							labels={dateLabels}
						/>

						<button type="submit" className="button button--size-m button--type-primary dashboard-analytics-apply" disabled={!project || !hasChanges || query.isFetching}>
							{filtersT("filters.apply")}
						</button>
					</div>
				</div>

				<Checkbox checked={compare} onChange={setCompare}>
					{t("compare")}
				</Checkbox>

				{dateError && <p role="alert">{t("invalidDates")}</p>}
			</form>

			{!project ? (
				<p>{t("selectProject")}</p>
			) : query.isPending ? (
				<ReportSkeleton t={t} />
			) : query.isError ? (
				<div className="content content--padding" role="alert">
					<p>
						{t(errorStatus === 400 ? "invalidDates" : errorStatus === 401 || errorStatus === 403 ? "forbidden" : errorStatus === 404 ? "projectMissing" : "loadError")}
					</p>

					<button type="button" className="button button--size-m button--type-minimal" onClick={() => query.refetch()}>
						{t("retry")}
					</button>
				</div>
			) : report ? (
				<>
					<div className="analytics-grid">
						{stats.map((stat) => (
							<div key={stat.key} className="content content--padding moderation-statistics__metric">
								<span>{t(stat.key)}</span>
								
								<p className="moderation-statistics__value">{stat.value}</p>
							</div>
						))}
					</div>

					<div className="moderation-statistics__charts">
						<ProjectAnalyticsChart
							report={report}
							metric="download"
							compare={compare}
							locale={locale}
							t={t}
						/>

						<ProjectAnalyticsChart report={report} metric="view" compare={compare} locale={locale} t={t} />
					</div>

					<div className="moderation-statistics__charts">
						<Countries report={report} locale={locale} t={t} />

						<ProjectAnalyticsVersions report={report} locale={locale} t={t} />
					</div>
				</>
			) : null}
		</section>
	);
}