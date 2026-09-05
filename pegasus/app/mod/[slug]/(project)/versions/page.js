import VersionsPage from "@/components/pages/VersionsPage";
import { getProjectBasePath } from "@/utils/projectRoutes";
import { fetchGameVersions } from "@/utils/gameVersions";
import { getProjectForRequest } from "@/utils/projects/server";
import { getProjectMetadata } from "@/utils/projects/metadata";

export async function generateMetadata({ params }) {
    const { slug } = await params;
	const { project } = await getProjectForRequest(slug);
    const basePath = getProjectBasePath(project.project_type);

    return getProjectMetadata(project, `${basePath}/${project.slug}/versions`);
}

export default async function Page({ params }) {
    const { slug } = await params;
	const { project, authToken } = await getProjectForRequest(slug, 100);

    const gameVersions = await fetchGameVersions();

	return <VersionsPage project={project} authToken={authToken} gameVersions={gameVersions} />;
}