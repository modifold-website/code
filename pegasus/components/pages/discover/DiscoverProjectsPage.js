"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import FeaturedHero from "./FeaturedHero";
import DiscoverProjectRail from "./DiscoverProjectRail";
import LatestProjects from "./LatestProjects";
import PopularCategories from "./PopularCategories";
import CategoryIcon from "@/utils/CategoryIcon";
import { getCategoryLabel } from "@/utils/categoryLabels";
import { getBrowseHref } from "./discoverHelpers";

export default function DiscoverProjectsPage({ data, projectType }) {
	const t = useTranslations("DiscoverPage");
	const tCategoryLabels = useTranslations("CategoryLabels");
	const browseHref = getBrowseHref(projectType);
	const hasContent = data?.featured?.length || data?.weeklyPopular?.length || data?.weeklyNewPopular?.length || data?.categorySections?.length || data?.latest?.length;

	if(!hasContent) {
		return (
			<div className="discover-page">
				<div className="subsite-empty-feed">
					<img src="/images/kweebec.png" style={{ width: "200px" }} alt="" />
					
					<p className="subsite-empty-feed__title">{t("empty")}</p>
				</div>
			</div>
		);
	}

	return (
		<div className="discover-page">
			<FeaturedHero projects={data?.featured || []} t={t} />

			<DiscoverProjectRail title={t("weeklyPopular")} titleIcon={(
				<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-trending-up-icon lucide-trending-up">
					<path d="M16 7h6v6"/>
					<path d="m22 7-8.5 8.5-5-5L2 17"/>
				</svg>
			)} projects={data?.weeklyPopular || []} t={t} tCategoryLabels={tCategoryLabels} viewAllHref={`${browseHref}?sort=downloads`} />

			<DiscoverProjectRail title={t("weeklyNewPopular")} titleIcon={(
				<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-flame-icon lucide-flame">
					<path d="M12 3q1 4 4 6.5t3 5.5a1 1 0 0 1-14 0 5 5 0 0 1 1-3 1 1 0 0 0 5 0c0-2-1.5-3-1.5-5q0-2 2.5-4"/>
				</svg>
			)} projects={data?.weeklyNewPopular || []} t={t} tCategoryLabels={tCategoryLabels} viewAllHref={`${browseHref}?sort=recent`} useWeeklyDownloads />

			{(data?.categorySections || []).map((section) => (
				<DiscoverProjectRail key={section.tag} title={getCategoryLabel(tCategoryLabels, section.tag)} titleIcon={<CategoryIcon category={section.tag} />} projects={section.projects || []} t={t} tCategoryLabels={tCategoryLabels} viewAllHref={`${browseHref}?c=${encodeURIComponent(section.tag)}`} />
			))}

			<PopularCategories categories={data?.popularCategories || []} tCategoryLabels={tCategoryLabels} t={t} browseHref={browseHref} />
			
			<LatestProjects projects={data?.latest || []} t={t} viewAllHref={`${browseHref}?sort=recent`} />

			<section className="discover-more">
				<img className="discover-more__leaf discover-more__leaf--right" src="/images/leaf.webp" alt="" aria-hidden="true" loading="lazy" />
				<img className="discover-more__leaf discover-more__leaf--left" src="/images/leaf.webp" alt="" aria-hidden="true" loading="lazy" />

				<div>
					<h2>{t("moreTitle")}</h2>
					
					<p>{t("moreText")}</p>
				</div>

				<Link href={browseHref} className="button button--size-m button--type-primary button--active-transform button--with-icon">
					<svg className="icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
						<path d="M7 7h10v10"/>
						<path d="M7 17 17 7"/>
					</svg>
					
					{t("moreCta")}
				</Link>
			</section>
		</div>
	);
}