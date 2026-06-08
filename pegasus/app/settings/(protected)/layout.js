import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import UserSettingsSidebar from "@/components/ui/UserSettingsSidebar";
import { isDeveloperModeEnabledFromCookieValue } from "@/utils/featureFlags";

const serverApiBase = process.env.API_BASE || process.env.NEXT_PUBLIC_API_BASE;

export default async function Layout({ children }) {
	const cookieStore = await cookies();
	const authToken = cookieStore.get("authToken")?.value;
	const featureFlagsCookie = cookieStore.get("featureFlags")?.value;
	const isFeatureFlagsVisible = isDeveloperModeEnabledFromCookieValue(featureFlagsCookie);

    if(!authToken) {
        redirect("/403");
    }

    const resolvedLocale = await getLocale();
    const t = await getTranslations({ locale: resolvedLocale, namespace: "SettingsBlogPage" });
    const tSidebar = await getTranslations({ locale: resolvedLocale, namespace: "SettingsBlogPage.sidebar" });

    let initialUser = null;

    try {
        const response = await fetch(`${serverApiBase}/auth/user`, {
            headers: {
                Authorization: `Bearer ${authToken}`,
                Accept: "application/json",
            },
            cache: "no-store",
        });

        if(response.status === 401 || response.status === 403) {
            redirect("/403");
        }

        if(response.ok) {
            const data = await response.json().catch(() => ({}));
            if(data?.success && data?.user) {
                initialUser = data.user;
            }
        }
    } catch (error) {
        console.error("Failed to preload user settings:", error);
    }

    if(!initialUser) {
        redirect("/403");
    }

    return (
        <div className="layout">
            <div className="page-content settings-page">
                <UserSettingsSidebar
                    user={initialUser}
                    profileIconAlt={t("sidebar.profileIconAlt")}
                    mode="settings"
					labels={{
						profile: tSidebar("profile"),
						appearance: tSidebar("appearance"),
						language: tSidebar("language"),
						accountSecurity: tSidebar("accountSecurity"),
						apiTokens: tSidebar("apiTokens"),
						verification: tSidebar("verification"),
						featureFlags: tSidebar("featureFlags"),
					}}
					isFeatureFlagsVisible={isFeatureFlagsVisible}
				/>

                {children}
            </div>
        </div>
    );
}