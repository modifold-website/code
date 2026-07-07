import { getLocale, getTranslations } from "next-intl/server";
import NewsPage from "@/components/pages/NewsPage";
import { getNewsIndex } from "@/utils/news/server";

export async function generateMetadata() {
    const resolvedLocale = await getLocale();
    const t = await getTranslations({ locale: resolvedLocale, namespace: "NewsPage" });

    return {
        title: `${t("title")} — Modifold`,
    };
}

export default async function Page() {
    const resolvedLocale = await getLocale();
    const { featuredArticle, otherArticles } = await getNewsIndex(resolvedLocale);

    return <NewsPage featuredArticle={featuredArticle} otherArticles={otherArticles} locale={resolvedLocale} />;
}