import { getLocale, getTranslations } from "next-intl/server";
import VersionsSettings from "@/components/project/settings/VersionsSettings";
import { fetchGameVersionItems } from "@/utils/gameVersions/server";
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

    const gameVersions = await fetchGameVersionItems();

    return <VersionsSettings project={project} authToken={authToken} gameVersions={gameVersions} />;
}