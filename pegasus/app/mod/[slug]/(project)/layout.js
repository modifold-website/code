import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import ProjectMasthead from "@/components/project/ProjectMasthead";
import ProjectTabs from "@/components/project/ProjectTabs";

const serverApiBase = process.env.API_BASE || process.env.NEXT_PUBLIC_API_BASE;

export default async function Layout({ children, params }) {
    const { slug } = await params;
    const cookieStore = await cookies();
    const authToken = cookieStore.get("authToken")?.value;

    const projectFetchOptions = authToken ? {
        headers: {
            Accept: "application/json",
            Authorization: `Bearer ${authToken}`,
        },
        cache: "no-store",
    } : {
        headers: { Accept: "application/json" },
        next: { revalidate: 60, tags: [`project:${slug}`] },
    };

    let projectRes;
    try {
        projectRes = await fetch(`${serverApiBase}/projects/${slug}`, projectFetchOptions);
    } catch {
        notFound();
    }

    if(!projectRes.ok) {
        notFound();
    }

    const project = await projectRes.json();
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

                    <ProjectTabs project={project} />

                    {children}
                </div>
            </div>
        </>
    );
}