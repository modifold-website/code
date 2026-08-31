"use client";

import Link from "next/link";
import CategoryIcon from "@/utils/CategoryIcon";
import { getCategoryLabel } from "@/utils/categoryLabels";
import { getBrowseHref } from "./discoverHelpers";

export default function PopularCategories({ categories, tCategoryLabels, t, browseHref = "/mods" }) {
	if(!categories?.length) {
		return null;
	}

	return (
		<section className="discover-section">
			<div className="discover-section__header">
				<h2>{t("popularCategories")}</h2>
			</div>

			<div className="discover-category-grid">
				{categories.map((category) => {
					const categoryBrowseHref = category.project_type ? getBrowseHref(category.project_type) : browseHref;
					return (
						<Link key={`${categoryBrowseHref}:${category.name}`} href={`${categoryBrowseHref}?c=${encodeURIComponent(category.name)}`} className="discover-category-pill">
							<span className="discover-category-pill__icon" aria-hidden="true">
								<CategoryIcon category={category.name} />
							</span>

							{getCategoryLabel(tCategoryLabels, category.name)}
						</Link>
					);
				})}
			</div>
		</section>
	);
}