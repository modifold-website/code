const serverApiBase = process.env.API_BASE || process.env.NEXT_PUBLIC_API_BASE;

﻿import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import UsersModerationPage from "@/components/pages/UsersModerationPage";
import axios from "axios";

export async function generateMetadata() {
    const resolvedLocale = await getLocale();
    const t = await getTranslations({ locale: resolvedLocale, namespace: "UsersModerationPage" });

    return {
        title: t("metadata.title"),
    };
}

async function fetchUsers(authToken) {
    try {
        const response = await axios.get(`${serverApiBase}/moderation/users`, {
            headers: { Authorization: `Bearer ${authToken}` },
            params: { page: 1, limit: 15 },
        });

        return {
            users: response.data.users,
            totalPages: response.data.totalPages,
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
        redirect("/403");
    }

    try {
        const response = await fetch(`${serverApiBase}/auth/user`, {
            headers: { Authorization: `Bearer ${authToken}` },
            cache: "no-store",
        });

        if(!response.ok) {
            redirect("/");
        }

        const data = await response.json().catch(() => ({}));
        const role = data?.user?.isRole;

        if(role !== "admin" && role !== "moderator") {
            redirect("/403");
        }
    } catch (error) {
        console.error("Error checking moderation access:", error);
        redirect("/");
    }

    const { users, totalPages } = await fetchUsers(authToken);

    return <UsersModerationPage authToken={authToken} initialUsers={users} initialTotalPages={totalPages} />;
}