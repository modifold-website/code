import { cookies } from "next/headers";
import ProjectMasthead from "@/components/project/ProjectMasthead";
import ProjectTabs from "@/components/project/ProjectTabs";
import ProjectArchiveBanner from "@/components/project/ProjectArchiveBanner";
import { getProjectBySlug } from "@/utils/projects/server";

export default async function Layout({ children, params }) {
    const { slug } = await params;
    const cookieStore = await cookies();
    const authToken = cookieStore.get("authToken")?.value;
    const project = await getProjectBySlug(slug, authToken || "");
    const projectColorValue = Number(project?.color);
    const projectColorHex = Number.isFinite(projectColorValue) ? `#${Math.max(0, Math.min(0xFFFFFF, Math.round(projectColorValue))).toString(16).padStart(6, "0").toUpperCase()}` : null;

    return (
        <>
            {projectColorHex && (
                <div className="fixed-background-teleport-color" style={{ "--_color": projectColorHex }} />
            )}

            <div className="layout">
                <div className="project-page">
                    <ProjectMasthead project={project} authToken={authToken} />

					<ProjectArchiveBanner project={project} />

                    <ProjectTabs project={project} />

                    {children}
                </div>
            </div>
        </>
    );
}