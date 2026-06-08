const serverApiBase = process.env.API_BASE || process.env.NEXT_PUBLIC_API_BASE;

﻿import { cookies } from "next/headers";
import { getLocale, getTranslations } from "next-intl/server";
import SettingsAPIPage from "@/components/pages/SettingsAPIPage";

export async function generateMetadata() {
    const resolvedLocale = await getLocale();
    const t = await getTranslations({ locale: resolvedLocale, namespace: "SettingsAPIPage" });

    return {
        title: t("metadata.title"),
    };
}

export default async function Page() {
    const cookieStore = await cookies();
    const authToken = cookieStore.get("authToken")?.value;

    let initialTokens = null;

    try {
        const tokensResponse = await fetch(`${serverApiBase}/api-tokens`, {
            headers: {
                Authorization: `Bearer ${authToken}`,
                Accept: "application/json",
            },
            cache: "no-store",
        });

        if(tokensResponse.ok) {
            const data = await tokensResponse.json().catch(() => ({}));
            initialTokens = data?.tokens || [];
        }
    } catch (error) {
        console.error("Failed to preload API tokens:", error);
    }

    return <SettingsAPIPage initialTokens={initialTokens} authToken={authToken} />;
}