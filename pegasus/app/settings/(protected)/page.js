import { getLocale, getTranslations } from "next-intl/server";
import SettingsBlogPage from "@/components/pages/SettingsBlogPage";

export async function generateMetadata() {
    const resolvedLocale = await getLocale();
    const t = await getTranslations({ locale: resolvedLocale, namespace: "SettingsBlogPage" });

    return {
        title: t("metadata.title"),
    };
}

export default async function Page() {
    return <SettingsBlogPage />;
}