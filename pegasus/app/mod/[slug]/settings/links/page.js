import { getLocale, getTranslations } from "next-intl/server";
import LinksSettings from "@/components/project/settings/LinksSettings";
import { getProjectForRequest } from "@/utils/projects/server";

export async function generateMetadata({ params }) {
    const { slug } = await params;
    const resolvedLocale = await getLocale();
    const tSettings = await getTranslations({ locale: resolvedLocale, namespace: "SettingsProjectPage" });
	const { project } = await getProjectForRequest(slug);
    return { title: tSettings("metadata.title", { title: project.title }) };
}

export default async function Page({ params }) {
    const { slug } = await params;
    const { project, authToken } = await getProjectForRequest(slug);

    return <LinksSettings project={project} authToken={authToken} />;
}