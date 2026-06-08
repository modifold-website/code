const PROJECT_TYPE_PATHS = {
    mod: "/mod",
    modpack: "/modpack",
};

export const getProjectBasePath = (projectType) => PROJECT_TYPE_PATHS[projectType] || PROJECT_TYPE_PATHS.mod;

export const getProjectPathByType = ({ slug, projectType, suffix = "" }) => {
    if(!slug) {
        return "";
    }

    const basePath = getProjectBasePath(projectType);
    return `${basePath}/${slug}${suffix}`;
};

export const getProjectPath = (project, suffix = "") => {
    if(!project?.slug) {
        return "";
    }

    return getProjectPathByType({
        slug: project.slug,
        projectType: project.project_type || project.projectType || project.type,
        suffix,
    });
};