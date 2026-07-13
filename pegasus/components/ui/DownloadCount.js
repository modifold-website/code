"use client";

import { useLocale, useTranslations } from "next-intl";
import Tooltip from "@/components/ui/Tooltip";
import { formatDownloads, normalizeDownloadCount } from "@/utils/formatDownloads";

export default function DownloadCount({ value, as: Component = "span", className = "", delay = 300, tooltip = true, locale }) {
	const currentLocale = useLocale();
	const activeLocale = locale || currentLocale;
	const t = useTranslations("Common");
	const normalizedValue = normalizeDownloadCount(value);
	const count = <Component className={className || undefined}>{formatDownloads(normalizedValue, activeLocale)}</Component>;

	if(!tooltip) {
		return count;
	}

	return (
		<Tooltip content={t("downloadsTooltip", { count: normalizedValue })} delay={delay}>
			{count}
		</Tooltip>
	);
}