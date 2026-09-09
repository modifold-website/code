import { redirect, forbidden } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import ProjectSettings from "@/components/project/settings/ProjectSettings";
import { getServerApiBase, serverApiFetch } from "@/utils/api/server";
import { getProjectBasePath, isBuildContentProjectType } from "@/utils/projectRoutes";
import { getProjectSettingsForRequest } from "@/utils/projects/server";

const serverApiBase = getServerApiBase();

const hasModifoldAnalytics = async (slug) => {
	try {
		const response = await serverApiFetch(`${serverApiBase}/analytics/${slug}/chart/daily-joins?days=7`, {
			headers: { Accept: "application/json" },
			next: { revalidate: 60 },
		});

		if(!response.ok) {
			return false;
		}

		const payload = await response.json();
		return Array.isArray(payload?.points) && payload.points.length > 0;
	} catch {
		return false;
	}
};

export async function generateMetadata({ params }) {
    const { slug } = await params;
    const resolvedLocale = await getLocale();
    const tSettings = await getTranslations({ locale: resolvedLocale, namespace: "SettingsProjectPage" });
	const { project } = await getProjectSettingsForRequest(slug);
	if(!project) {
		return { title: tSettings("metadata.title", { title: slug }) };
	}

    return { title: tSettings("metadata.title", { title: project.title }) };
}

export default async function Page({ params }) {
    const { slug } = await params;
    const { project: settingsData, status } = await getProjectSettingsForRequest(slug);

    if(status === 401) {
        redirect("/");
    }

    if(status === 403) {
        forbidden();
    }

	if(!settingsData?.permissions?.can_edit_details) {
		const baseProjectPath = `${getProjectBasePath(settingsData?.project_type)}/${settingsData?.slug || slug}`;
		if(settingsData?.permissions?.can_manage_collaborators) {
			redirect(`${baseProjectPath}/settings/collaborators`);
		}
		if(settingsData?.permissions?.can_manage_versions) {
			redirect(`${baseProjectPath}/settings/versions`);
		}
		if(settingsData?.permissions?.can_edit_gallery) {
			redirect(`${baseProjectPath}/settings/gallery`);
		}
		if(settingsData?.permissions?.can_edit_body) {
			redirect(`${baseProjectPath}/settings/description`);
		}
	}
    
	const project = {
        ...settingsData,
        organization: settingsData?.organization || null,
    };
	const analyticsConnected = !isBuildContentProjectType(project.project_type) && await hasModifoldAnalytics(project.slug);

    return (
        <ProjectSettings
            project={project}
			analyticsConnected={analyticsConnected}
        />
    );
}