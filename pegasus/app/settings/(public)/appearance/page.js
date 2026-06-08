import { getLocale, getTranslations } from "next-intl/server";
import SettingsAppearancePage from "@/components/pages/SettingsAppearancePage";

export async function generateMetadata() {
    const resolvedLocale = await getLocale();
    const t = await getTranslations({ locale: resolvedLocale, namespace: "SettingsBlogPage" });

    return {
        title: t("metadata.title"),
    };
}

export default async function Page() {
    return <SettingsAppearancePage />;
}