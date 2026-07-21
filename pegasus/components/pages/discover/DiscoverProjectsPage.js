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
	const hasContent = data?.featured?.length || data?.weeklyPopular?.length || data?.categorySections?.length || data?.latest?.length;

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

			<DiscoverProjectRail title={t("weeklyPopular")} projects={data?.weeklyPopular || []} t={t} tCategoryLabels={tCategoryLabels} viewAllHref={`${browseHref}?sort=downloads`} useWeeklyDownloads />

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