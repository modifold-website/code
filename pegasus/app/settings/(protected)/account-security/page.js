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
	let initialProviders = null;

    try {
		const requestOptions = {
			headers: {
				Authorization: `Bearer ${authToken}`,
				Accept: "application/json",
			},
			cache: "no-store",
		};
		const [twoFactorResponse, passwordResponse, providersResponse] = await Promise.all([
			fetch(`${serverApiBase}/auth/2fa/status`, requestOptions),
			fetch(`${serverApiBase}/auth/password/status`, requestOptions),
			fetch(`${serverApiBase}/auth/providers`, requestOptions),
		]);
		const [twoFactorData, passwordData, providersData] = await Promise.all([
			twoFactorResponse.json().catch(() => ({})),
			passwordResponse.json().catch(() => ({})),
			providersResponse.json().catch(() => ({})),
		]);

		if(twoFactorResponse.ok) {
			initialTwoFactor = { enabled: Boolean(twoFactorData?.enabled) };
		}

		if(passwordResponse.ok) {
			initialPassword = { enabled: Boolean(passwordData?.enabled) };
		}

		if(providersResponse.ok) {
			initialProviders = providersData;
		}
    } catch (error) {
        console.error("Failed to preload user settings:", error);
    }

	return <SettingsAccountSecurityPage initialTwoFactor={initialTwoFactor} initialPassword={initialPassword} initialProviders={initialProviders} authToken={authToken} />;
}