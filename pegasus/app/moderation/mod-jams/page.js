import { serverApiFetch } from "@/utils/api/server";
import { cookies } from "next/headers";
import { forbidden, unstable_rethrow } from "next/navigation";
import ModJamModerationPage from "@/components/mod-jams/ModJamModerationPage";

const serverApiBase = process.env.API_BASE || process.env.NEXT_PUBLIC_API_BASE;

export const metadata = {
	title: "Mod jams moderation",
};

export default async function ModJamsModerationServerPage() {
	const cookieStore = await cookies();
	const authToken = cookieStore.get("authToken")?.value;

	if(!authToken) {
		forbidden();
	}

	let modJams = [];

	try {
		const response = await serverApiFetch(`${serverApiBase}/mod-jams/moderation`, {
			headers: { Authorization: `Bearer ${authToken}` },
			cache: "no-store",
		});

		if(response.status === 403) {
			forbidden();
		}

		if(response.ok) {
			const data = await response.json();
			modJams = data.mod_jams || [];
		}
	} catch (error) {
		unstable_rethrow(error);
		console.error("Failed to fetch mod jams moderation queue:", error);
	}

	return <ModJamModerationPage authToken={authToken} initialJams={modJams} />;
}