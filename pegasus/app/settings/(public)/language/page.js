import { getLocale, getTranslations } from "next-intl/server";
import SettingsLanguagePage from "@/components/pages/SettingsLanguagePage";

export async function generateMetadata() {
    const resolvedLocale = await getLocale();
    const t = await getTranslations({ locale: resolvedLocale, namespace: "SettingsBlogPage" });

    return {
        title: t("metadata.title"),
    };
}

export default async function Page() {
    return <SettingsLanguagePage />;
}