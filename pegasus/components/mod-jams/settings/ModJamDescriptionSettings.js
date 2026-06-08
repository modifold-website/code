"use client";

import ModJamMarkdownSettings from "@/components/mod-jams/settings/ModJamMarkdownSettings";
import { useTranslations } from "next-intl";

export default function ModJamDescriptionSettings({ authToken, jam }) {
	const t = useTranslations("ModJamsPage");

	return (
		<ModJamMarkdownSettings
			authToken={authToken}
			jam={jam}
			field="description"
			title={t("settings.description.title")}
			hint={t("settings.description.hint")}
			placeholder={t("settings.description.placeholder")}
			successMessage={t("settings.description.saved")}
			saveErrorMessage={t("settings.description.saveError")}
		/>
	);
}