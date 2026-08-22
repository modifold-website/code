import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import ProjectCollaboratorsSettings from "@/components/project/settings/ProjectCollaboratorsSettings";

const serverApiBase = process.env.API_BASE || process.env.NEXT_PUBLIC_API_BASE;

export async function generateMetadata({ params }) {
	const { slug } = await params;
	const locale = await getLocale();
	const t = await getTranslations({ locale, namespace: "ProjectCollaborators" });

	return { title: `${t("title")} — ${slug} — Modifold` };
}

export default async function ProjectCollaboratorsRoute({ params }) {
	const { slug } = await params;
	const cookieStore = await cookies();
	const authToken = cookieStore.get("authToken")?.value;

	if(!authToken) {
		redirect("/403");
	}

	const response = await fetch(`${serverApiBase}/projects/${slug}/collaborators`, {
		headers: {
			Accept: "application/json",
			Authorization: `Bearer ${authToken}`,
		},
		cache: "no-store",
	});

	if(response.status === 401 || response.status === 403) {
		redirect("/403");
	}
	
	if(response.status === 404) {
		notFound();
	}

	if(!response.ok) {
		throw new Error(`Could not load project collaborators: API returned ${response.status}`);
	}

	const data = await response.json();
	return (
		<ProjectCollaboratorsSettings
			authToken={authToken}
			project={data.project}
			owner={data.owner || null}
			initialCollaborators={Array.isArray(data.collaborators) ? data.collaborators : []}
			availablePermissions={Array.isArray(data.available_permissions) ? data.available_permissions : []}
			defaultPermissions={Array.isArray(data.default_permissions) ? data.default_permissions : []}
			organizationOptions={Array.isArray(data.organization_options) ? data.organization_options : []}
			twoFactorEnabled={Boolean(data.security?.two_factor_enabled)}
		/>
	);
}