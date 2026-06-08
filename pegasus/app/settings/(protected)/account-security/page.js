import { cookies } from "next/headers";
import { getLocale, getTranslations } from "next-intl/server";
import SettingsAccountSecurityPage from "@/components/pages/SettingsAccountSecurityPage";

const serverApiBase = process.env.API_BASE || process.env.NEXT_PUBLIC_API_BASE;

export async function generateMetadata() {
    const resolvedLocale = await getLocale();
    const t = await getTranslations({ locale: resolvedLocale, namespace: "SettingsBlogPage" });

    return {
        title: t("metadata.title"),
    };
}

export default async function Page() {
    const cookieStore = await cookies();
    const authToken = cookieStore.get("authToken")?.value;

    let initialTwoFactor = null;
    let initialPassword = null;

    try {
        const twoFactorResponse = await fetch(`${serverApiBase}/auth/2fa/status`, {
            headers: {
                Authorization: `Bearer ${authToken}`,
                Accept: "application/json",
            },
            cache: "no-store",
        });

        if(twoFactorResponse.ok) {
            const data = await twoFactorResponse.json().catch(() => ({}));
            initialTwoFactor = { enabled: Boolean(data?.enabled) };
        }

        const passwordResponse = await fetch(`${serverApiBase}/auth/password/status`, {
            headers: {
                Authorization: `Bearer ${authToken}`,
                Accept: "application/json",
            },
            cache: "no-store",
        });

        if(passwordResponse.ok) {
            const data = await passwordResponse.json().catch(() => ({}));
            initialPassword = { enabled: Boolean(data?.enabled) };
        }
    } catch (error) {
        console.error("Failed to preload user settings:", error);
    }

    return <SettingsAccountSecurityPage initialTwoFactor={initialTwoFactor} initialPassword={initialPassword} authToken={authToken} />;
}