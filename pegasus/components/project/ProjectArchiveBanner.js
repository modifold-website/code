"use client";

import { useTranslations } from "next-intl";
import DisclosureIcon from "@/utils/DisclosureIcon";

export default function ProjectArchiveBanner({ project }) {
	const t = useTranslations("ProjectDisclosures.archive");

	if(!project?.archive?.is_archived) {
		return null;
	}

	const description = project.archive.explanation?.trim() || t("bannerDescription", { title: project.title });

	return (
		<div className="archive-banner project-archive-banner" role="status">
			<DisclosureIcon type="archive" />

			<div>
				<strong>{t("bannerTitle", { title: project.title })}</strong>
				
				<p>{description}</p>
			</div>
		</div>
	);
}