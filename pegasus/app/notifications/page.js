import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import NotificationsPage from "@/components/pages/NotificationsPage";

const serverApiBase = process.env.API_BASE || process.env.NEXT_PUBLIC_API_BASE;

export async function generateMetadata() {
    const resolvedLocale = await getLocale();
    const t = await getTranslations({ locale: resolvedLocale, namespace: "NotificationsPage" });

    return {
        title: `${t("title")} — Modifold`,
    };
}

export default async function Page() {
    const cookieStore = await cookies();
    const authToken = cookieStore.get("authToken")?.value;

    if(!authToken) {
        redirect("/403");
    }

    let initialNotifications = [];
    let initialPage = 1;
    let initialTotalPages = 1;
    let initialDataLoaded = false;

    try {
        const response = await fetch(`${serverApiBase}/notifications?page=1&limit=20`, {
            headers: {
                Accept: "application/json",
                Authorization: `Bearer ${authToken}`,
            },
            cache: "no-store",
        });

        if(response.status === 401 || response.status === 403) {
            redirect("/403");
        }

        if(response.ok) {
            const data = await response.json().catch(() => ({}));
            initialNotifications = Array.isArray(data?.notifications) ? data.notifications : [];
            initialPage = Number(data?.pagination?.page) || 1;
            initialTotalPages = Number(data?.pagination?.totalPages) || 1;
            initialDataLoaded = true;
        }
    } catch (error) {
        console.error("Error fetching notifications page data:", error);
    }

    return (
        <NotificationsPage
            authToken={authToken}
            initialNotifications={initialNotifications}
            initialPage={initialPage}
            initialTotalPages={initialTotalPages}
            initialDataLoaded={initialDataLoaded}
        />
    );
}