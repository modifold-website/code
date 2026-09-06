import { serverApiFetch } from "@/utils/api/server";
const serverApiBase = process.env.API_BASE || process.env.NEXT_PUBLIC_API_BASE;

import { cookies } from "next/headers";
import { redirect, forbidden, unstable_rethrow } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import UsersModerationPage from "@/components/pages/UsersModerationPage";

export async function generateMetadata() {
    const resolvedLocale = await getLocale();
    const t = await getTranslations({ locale: resolvedLocale, namespace: "UsersModerationPage" });

    return {
        title: t("metadata.title"),
    };
}

async function fetchUsers(authToken) {
    try {
        const query = new URLSearchParams({ page: "1", limit: "15" });
        const response = await serverApiFetch(`${serverApiBase}/moderation/users?${query}`, {
            headers: { Authorization: `Bearer ${authToken}` },
            cache: "no-store",
        });
		if(!response.ok) {
			throw new Error(`Moderation users API returned ${response.status}`);
		}
		const data = await response.json();

        return {
            users: data.users,
            totalPages: data.totalPages,
        };
    } catch (err) {
        console.error("Error fetching users for moderation:", err);
        return { users: [], totalPages: 1 };
    }
}

export default async function UsersModerationServer() {
    const cookieStore = await cookies();
    const authToken = cookieStore.get("authToken")?.value;

    if(!authToken) {
        forbidden();
    }

    try {
        const response = await serverApiFetch(`${serverApiBase}/auth/user`, {
            headers: { Authorization: `Bearer ${authToken}` },
            cache: "no-store",
        });

        if(!response.ok) {
            redirect("/");
        }

        const data = await response.json().catch(() => ({}));
        const role = data?.user?.isRole;

        if(role !== "admin" && role !== "moderator") {
            forbidden();
        }
    } catch (error) {
		unstable_rethrow(error);
        console.error("Error checking moderation access:", error);
        redirect("/");
    }

    const { users, totalPages } = await fetchUsers(authToken);

    return <UsersModerationPage authToken={authToken} initialUsers={users} initialTotalPages={totalPages} />;
}