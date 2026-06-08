import { getLocale, getTranslations } from "next-intl/server";

export async function generateMetadata() {
    const resolvedLocale = await getLocale();
    const t = await getTranslations({ locale: resolvedLocale, namespace: "AccessDenied" });

    return {
        title: t("metadata.title"),
    };
}

export default async function Page() {
    const resolvedLocale = await getLocale();
    const t = await getTranslations({ locale: resolvedLocale, namespace: "AccessDenied" });

    return (
        <div className="layout">
            <div className="view">
                <div className="not-found-page__dummy">{t("message")}</div>
            </div>
        </div>
    );
}