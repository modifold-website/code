import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import ModJamNominationsSettings from "@/components/mod-jams/settings/ModJamNominationsSettings";

const serverApiBase = process.env.API_BASE || process.env.NEXT_PUBLIC_API_BASE;

async function getJam(slug, authToken) {
	const response = await fetch(`${serverApiBase}/mod-jams/${slug}`, {
		headers: { Authorization: `Bearer ${authToken}` },
		cache: "no-store",
	});

	return response.ok ? response.json() : null;
}

export async function generateMetadata({ params }) {
	const { slug } = await params;
	const resolvedLocale = await getLocale();
	const t = await getTranslations({ locale: resolvedLocale, namespace: "SettingsProjectPage" });
	const cookieStore = await cookies();
	const authToken = cookieStore.get("authToken")?.value;
	const data = await getJam(slug, authToken);

	if(!data?.mod_jam) {
		return { title: "Mod Jam — Modifold" };
	}

	return { title: t("metadata.title", { title: data.mod_jam.title }) };
}

export default async function ModJamNominationsSettingsPage({ params }) {
	const { slug } = await params;
	const cookieStore = await cookies();
	const authToken = cookieStore.get("authToken")?.value;
	const data = await getJam(slug, authToken);

	if(!data?.mod_jam) {
		notFound();
	}

	return <ModJamNominationsSettings authToken={authToken} jam={data.mod_jam} initialNominations={data.nominations || []} />;
}