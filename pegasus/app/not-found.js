import { getLocale, getTranslations } from "next-intl/server";

export async function generateMetadata() {
    return {
        title: "404 — Modifold",
    };
}

export default async function NotFound() {
    const resolvedLocale = await getLocale();
    const t = await getTranslations({ locale: resolvedLocale, namespace: "NotFound" });

    return (
        <div className="layout">
            <div className="view">
                <section className="not-found">
                    <h2 className="not-found__code">4<img src="https://media.tenor.com/h1jmVbHLV6QAAAAM/vincent.gif" style={{ width: "96px", height: "96px", borderRadius: "1000px" }} />4</h2>

                    <div className="content content--padding">
                        <h2 className="not-found__title">{t("title")}</h2>

                        <p className="not-found__text">{t("message")}</p>
                    </div>
                </section>
            </div>
        </div>
    );
}