"use client";

import ModJamMarkdownSettings from "@/components/mod-jams/settings/ModJamMarkdownSettings";
import { useTranslations } from "next-intl";

export default function ModJamRulesSettings({ authToken, jam }) {
	const t = useTranslations("ModJamsPage");

	return (
		<ModJamMarkdownSettings
			authToken={authToken}
			jam={jam}
			field="rules"
			title={t("settings.rules.title")}
			hint={t("settings.rules.hint")}
			placeholder={t("settings.rules.placeholder")}
			successMessage={t("settings.rules.saved")}
			saveErrorMessage={t("settings.rules.saveError")}
			formatting="basic"
		/>
	);
}