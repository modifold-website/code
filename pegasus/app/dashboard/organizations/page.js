import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import OrganizationsDashboardPage from "@/components/organizations/OrganizationsDashboardPage";

const serverApiBase = process.env.API_BASE || process.env.NEXT_PUBLIC_API_BASE;

export async function generateMetadata() {
    const resolvedLocale = await getLocale();
    const t = await getTranslations({ locale: resolvedLocale, namespace: "Organizations" });

    return {
        title: `${t("dashboard.title")} — Modifold`,
    };
}

export default async function OrganizationsDashboardRoute() {
    const cookieStore = await cookies();
    const authToken = cookieStore.get("authToken")?.value;

    if(!authToken) {
        redirect("/403");
    }

    let organizations = [];
    try {
        const response = await fetch(`${serverApiBase}/organizations/dashboard/organizations`, {
            headers: {
                Authorization: `Bearer ${authToken}`,
                Accept: "application/json",
            },
            cache: "no-store",
        });
        
        if(response.ok) {
            const data = await response.json();
            organizations = Array.isArray(data?.organizations) ? data.organizations : [];
        }
    } catch {}

    return <OrganizationsDashboardPage authToken={authToken} initialOrganizations={organizations} />;
}