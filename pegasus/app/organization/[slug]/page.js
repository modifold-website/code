import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { getLocale, getTranslations } from "next-intl/server";
import OrganizationPage from "@/components/organizations/OrganizationPage";

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
            return { title: `${t("dashboard.title")} — Modifold` };
        }

        const data = await response.json();
        const organizationName = data?.organization?.name || t("dashboard.title");

        return {
            title: `${organizationName} — Modifold`,
        };
    } catch {
        return { title: `${t("dashboard.title")} — Modifold` };
    }
}

export default async function OrganizationRoute({ params }) {
    const { slug } = await params;
    const cookieStore = await cookies();
    const authToken = cookieStore.get("authToken")?.value;

    const response = await fetch(`${serverApiBase}/organizations/${slug}`, {
        headers: {
            Accept: "application/json",
            Authorization: authToken ? `Bearer ${authToken}` : undefined,
        },
        cache: "no-store",
    });

    if(!response.ok) {
        notFound();
    }

    const data = await response.json();
    return <OrganizationPage {...data} />;
}