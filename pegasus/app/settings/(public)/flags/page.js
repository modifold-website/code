import { getLocale, getTranslations } from "next-intl/server";
import SettingsFlagsPage from "@/components/pages/SettingsFlagsPage";

export async function generateMetadata() {
	const resolvedLocale = await getLocale();
	const t = await getTranslations({ locale: resolvedLocale, namespace: "SettingsBlogPage" });

	return {
		title: t("flags.metadata.title"),
	};
}

export default async function Page() {
	return <SettingsFlagsPage />;
}