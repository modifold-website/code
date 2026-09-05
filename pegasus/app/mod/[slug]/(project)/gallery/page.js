import GalleryPage from "@/components/pages/GalleryPage";
import { getProjectBasePath } from "@/utils/projectRoutes";
import { getProjectForRequest } from "@/utils/projects/server";

export async function generateMetadata({ params }) {
    const { slug } = await params;
	const { project } = await getProjectForRequest(slug);
    const basePath = getProjectBasePath(project.project_type);
    return {
        title: `${project.title} — Modifold`,
        description: project.summary,
        openGraph: {
            title: project.title,
            description: project.summary,
            images: [project.icon_url],
            url: `https://modifold.com${basePath}/${project.slug}/gallery`,
        },
    };
}

export default async function Page({ params }) {
    const { slug } = await params;
	const { project, authToken } = await getProjectForRequest(slug);

	return <GalleryPage project={project} authToken={authToken} />;
}