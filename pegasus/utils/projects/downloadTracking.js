export const getVersionDownloadEndpoint = ({ project, version }) => {
	const apiBase = process.env.NEXT_PUBLIC_API_BASE;
	const projectSlug = String(project?.slug || version?.project_slug || "").trim();
	const versionId = String(version?.id || version?.version_id || "").trim();

	if(!apiBase || !projectSlug || !versionId) {
		return null;
	}

	return `${apiBase.replace(/\/+$/, "")}/projects/${encodeURIComponent(projectSlug)}/versions/${encodeURIComponent(versionId)}/download`;
};