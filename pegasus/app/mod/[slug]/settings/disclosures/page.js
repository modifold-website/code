import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import DisclosuresSettings from "@/components/project/settings/DisclosuresSettings";

const serverApiBase = process.env.API_BASE || process.env.NEXT_PUBLIC_API_BASE;

export async function generateMetadata({ params }) {
	const { slug } = await params;
	const resolvedLocale = await getLocale();
	const t = await getTranslations({ locale: resolvedLocale, namespace: "ProjectDisclosures" });
	const response = await fetch(`${serverApiBase}/projects/${slug}`, {
		headers: { Accept: "application/json" },
	});

	if(!response.ok) {
		return { title: t("metadata.notFound") };
	}

	const project = await response.json();
	return { title: t("metadata.title", { title: project.title }) };
}

export default async function Page({ params }) {
	const { slug } = await params;
	const cookieStore = await cookies();
	const authToken = cookieStore.get("authToken")?.value;
	if(!authToken) {
		redirect("/");
	}

	const response = await fetch(`${serverApiBase}/projects/${slug}/settings`, {
		headers: {
			Accept: "application/json",
			Authorization: `Bearer ${authToken}`,
		},
		cache: "no-store",
	});

	if(!response.ok) {
		return null;
	}

	const project = await response.json();
	return <DisclosuresSettings project={project} authToken={authToken} />;
}