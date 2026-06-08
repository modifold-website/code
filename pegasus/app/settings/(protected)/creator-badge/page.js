import { cookies } from "next/headers";
import { getLocale, getTranslations } from "next-intl/server";
import SettingsVerificationPage from "@/components/pages/SettingsVerificationPage";

const serverApiBase = process.env.API_BASE || process.env.NEXT_PUBLIC_API_BASE;

export async function generateMetadata() {
    const resolvedLocale = await getLocale();
    const t = await getTranslations({ locale: resolvedLocale, namespace: "SettingsVerificationPage" });

    return {
        title: t("metadata.title"),
    };
}

export default async function Page() {
    const cookieStore = await cookies();
    const authToken = cookieStore.get("authToken")?.value;

    let initialVerification = null;

    try {
        const verificationResponse = await fetch(`${serverApiBase}/verification/me`, {
            headers: {
                Authorization: `Bearer ${authToken}`,
                Accept: "application/json",
            },
            cache: "no-store",
        });

        if(verificationResponse.ok) {
            const data = await verificationResponse.json().catch(() => ({}));
            initialVerification = {
                isVerified: data?.isVerified === 1,
                eligibility: data?.eligibility || null,
            };
        }
    } catch (error) {
        console.error("Failed to preload verification settings:", error);
    }

    return <SettingsVerificationPage initialVerification={initialVerification} />;
}