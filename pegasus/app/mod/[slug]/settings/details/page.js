import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import DisclosuresSettings from "@/components/project/settings/DisclosuresSettings";
import { getProjectSettingsForRequest } from "@/utils/projects/server";

export async function generateMetadata({ params }) {
	const { slug } = await params;
	const resolvedLocale = await getLocale();
	const t = await getTranslations({ locale: resolvedLocale, namespace: "ProjectDisclosures" });
	const { project } = await getProjectSettingsForRequest(slug);
	if(!project) {
		return { title: t("metadata.title", { title: slug }) };
	}
	return { title: t("metadata.title", { title: project.title }) };
}

export default async function Page({ params }) {
	const { slug } = await params;
	const { project, authToken, status } = await getProjectSettingsForRequest(slug);
	if(status === 401) {
		redirect("/");
	}

	if(status === 403) {
		redirect("/403");
	}

	return <DisclosuresSettings project={project} authToken={authToken} />;
}