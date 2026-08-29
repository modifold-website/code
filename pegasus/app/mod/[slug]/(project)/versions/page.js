import { cookies } from "next/headers";
import VersionsPage from "@/components/pages/VersionsPage";
import { getProjectBasePath } from "@/utils/projectRoutes";
import { fetchGameVersions } from "@/utils/gameVersions";
import { getProjectBySlug, getProjectMembersBySlug } from "@/utils/projects/server";
import { getProjectMetadata } from "@/utils/projects/metadata";

export async function generateMetadata({ params }) {
    const { slug } = await params;
    const project = await getProjectBySlug(slug);
    const basePath = getProjectBasePath(project.project_type);

    return getProjectMetadata(project, `${basePath}/${project.slug}/versions`);
}

export default async function Page({ params }) {
    const { slug } = await params;
    const cookieStore = await cookies();
    const authToken = cookieStore.get("authToken")?.value;

    const project = await getProjectBySlug(slug, authToken || "");
    const members = await getProjectMembersBySlug(slug, authToken || "");

    const gameVersions = await fetchGameVersions();

    return <VersionsPage project={{ ...project, members }} authToken={authToken} gameVersions={gameVersions} />;
}