"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import FeaturedHero from "./FeaturedHero";
import DiscoverProjectRail from "./DiscoverProjectRail";
import LatestProjects from "./LatestProjects";
import PopularCategories from "./PopularCategories";

export default function DiscoverProjectsPage({ data }) {
	const t = useTranslations("DiscoverPage");
	const tCategoryLabels = useTranslations("CategoryLabels");
	const featured = data?.featured || [];
	const weeklyPopular = data?.weeklyPopular || [];
	const weeklyNewPopular = data?.weeklyNewPopular || [];
	const recentlyUpdated = data?.recentlyUpdated || [];
	const recentlyPublished = data?.latest || [];
	const popularCategories = data?.popularCategories || [];

	return (
		<div className="discover-page">
			<FeaturedHero projects={featured} t={t} />

			<DiscoverProjectRail title={t("weeklyPopular")} titleIcon={(
				<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-trending-up-icon lucide-trending-up">
					<path d="M16 7h6v6"/>
					<path d="m22 7-8.5 8.5-5-5L2 17"/>
				</svg>
			)} projects={weeklyPopular} t={t} tCategoryLabels={tCategoryLabels} useWeeklyDownloads />

			<DiscoverProjectRail title={t("weeklyNewPopular")} titleIcon={(
				<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-flame-icon lucide-flame">
					<path d="M12 3q1 4 4 6.5t3 5.5a1 1 0 0 1-14 0 5 5 0 0 1 1-3 1 1 0 0 0 5 0c0-2-1.5-3-1.5-5q0-2 2.5-4"/>
				</svg>
			)} projects={weeklyNewPopular} t={t} tCategoryLabels={tCategoryLabels} useWeeklyDownloads />

			<DiscoverProjectRail title={t("recentlyUpdated")} titleIcon={(
				<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-refresh-cw-icon lucide-refresh-cw">
					<path d="M3 12a9 9 0 0 1 15-6.7L21 8"/>
					<path d="M21 3v5h-5"/>
					<path d="M21 12a9 9 0 0 1-15 6.7L3 16"/>
					<path d="M8 16H3v5"/>
				</svg>
			)} projects={recentlyUpdated} t={t} tCategoryLabels={tCategoryLabels} />

			<PopularCategories categories={popularCategories} tCategoryLabels={tCategoryLabels} t={t} />

			<LatestProjects projects={recentlyPublished} t={t} />

			<section className="discover-more">
				<div>
					<h2>{t("communityTitle")}</h2>
					
					<p>{t("communityText")}</p>
				</div>

				<Link href="/jams" className="button button--size-m button--type-primary button--active-transform button--with-icon">
					<svg className="icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
						<path d="M10 14.66v1.626a2 2 0 0 1-.976 1.696A5 5 0 0 0 7 21.978"/>
						<path d="M14 14.66v1.626a2 2 0 0 0 .976 1.696A5 5 0 0 1 17 21.978"/>
						<path d="M18 9h1.5a1 1 0 0 0 0-5H18"/>
						<path d="M4 22h16"/>
						<path d="M6 9a6 6 0 0 0 12 0V3a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1z"/>
						<path d="M6 9H4.5a1 1 0 0 1 0-5H6"/>
					</svg>
					
					{t("communityCta")}
				</Link>
			</section>
		</div>
	);
}