import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import ModJamPageView from "@/components/mod-jams/ModJamPage";

const serverApiBase = process.env.API_BASE || process.env.NEXT_PUBLIC_API_BASE;

async function fetchModJam(slug, authToken) {
	const response = await fetch(`${serverApiBase}/mod-jams/${slug}`, {
		headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined,
		cache: "no-store",
	});

	if(!response.ok) {
		return null;
	}

	return response.json();
}

export async function generateMetadata({ params }) {
	const { slug } = await params;
	const cookieStore = await cookies();
	const authToken = cookieStore.get("authToken")?.value || null;
	const data = await fetchModJam(slug, authToken);

	if(!data?.mod_jam) {
		return { title: "Mod Jam — Modifold" };
	}

	return {
		title: `${data.mod_jam.title} — Mod Jam — Modifold`,
		description: data.mod_jam.summary,
	};
}

export default async function ModJamPage({ params }) {
	const { slug } = await params;
	const cookieStore = await cookies();
	const authToken = cookieStore.get("authToken")?.value || null;
	const data = await fetchModJam(slug, authToken);

	if(!data?.mod_jam) {
		notFound();
	}

	return <ModJamPageView jam={data.mod_jam} submissions={data.submissions || []} jury={data.jury || []} nominations={data.nominations || []} permissions={data.permissions || {}} authToken={authToken} />;
}