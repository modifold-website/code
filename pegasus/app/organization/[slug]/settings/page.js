import { cookies } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import OrganizationOverviewSettingsPage from "@/components/organizations/settings/OrganizationOverviewSettingsPage";

const serverApiBase = process.env.API_BASE || process.env.NEXT_PUBLIC_API_BASE;

export async function generateMetadata({ params }) {
    const { slug } = await params;
    const locale = await getLocale();
    const t = await getTranslations({ locale, namespace: "Organizations" });

    try {
        const response = await fetch(`${serverApiBase}/organizations/${slug}`, {
            headers: { Accept: "application/json" },
            next: { revalidate: 60, tags: [`organization:${slug}`] },
        });

        if(!response.ok) {
            return { title: `${t("settings.navOverview")} — ${t("dashboard.title")} — Modifold` };
        }

        const data = await response.json();
        const organizationName = data?.organization?.name || t("dashboard.title");

        return {
            title: `${organizationName} — ${t("settings.navOverview")} — Modifold`,
        };
    } catch {
        return { title: `${t("settings.navOverview")} — ${t("dashboard.title")} — Modifold` };
    }
}

export default async function OrganizationSettingsRoute({ params }) {
    const { slug } = await params;
    const cookieStore = await cookies();
    const authToken = cookieStore.get("authToken")?.value;

    if(!authToken) {
        redirect("/403");
    }

    const response = await fetch(`${serverApiBase}/organizations/${slug}/settings`, {
        headers: {
            Authorization: `Bearer ${authToken}`,
            Accept: "application/json",
        },
        cache: "no-store",
    });

    if(response.status === 401 || response.status === 403) {
        redirect("/403");
    }

    if(!response.ok) {
        notFound();
    }

    const data = await response.json();
    return <OrganizationOverviewSettingsPage authToken={authToken} {...data} />;
}