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
                <section className="not-found">
                    <h2 className="not-found__code">403</h2>

                    <div className="content content--padding">
                        <h2 className="not-found__title">{t("title")}</h2>

                        <p className="not-found__text">{t("message")}</p>
                    </div>
                </section>
            </div>
        </div>
    );
}