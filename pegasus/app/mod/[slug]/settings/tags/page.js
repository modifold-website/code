import { getLocale, getTranslations } from "next-intl/server";
import TagsSettings from "@/components/project/settings/TagsSettings";
import { getServerApiBase, serverApiFetch } from "@/utils/api/server";
import { getProjectForRequest } from "@/utils/projects/server";

const serverApiBase = getServerApiBase();

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
    let availableTags = [];

    try {
        const tagsResponse = await serverApiFetch(`${serverApiBase}/tags/${project.project_type}`, {
            next: { revalidate: 300 },
        });
        if(tagsResponse.ok) {
            const data = await tagsResponse.json();
            availableTags = Array.isArray(data?.tags) ? data.tags : [];
        }
    } catch (error) {
        console.error("Failed to fetch tags:", error);
    }

    return <TagsSettings project={project} authToken={authToken} availableTags={availableTags} />;
}