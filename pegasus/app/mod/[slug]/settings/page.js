import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import ProjectSettings from "@/components/project/settings/ProjectSettings";
import { getProjectBasePath } from "@/utils/projectRoutes";
import { getProjectSettingsForRequest } from "@/utils/projects/server";

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
        redirect("/403");
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

    return (
        <ProjectSettings
            project={project}
        />
    );
}