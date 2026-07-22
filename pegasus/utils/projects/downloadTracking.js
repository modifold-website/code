const getDownloadTrackingEndpoint = ({ project, version }) => {
	const apiBase = process.env.NEXT_PUBLIC_API_BASE;
	const projectSlug = String(project?.slug || version?.project_slug || "").trim();
	const versionId = String(version?.id || version?.version_id || "").trim();

	if(!apiBase || !projectSlug || !versionId) {
		return null;
	}

	return `${apiBase.replace(/\/+$/, "")}/projects/${encodeURIComponent(projectSlug)}/versions/${encodeURIComponent(versionId)}/download`;
};

export function trackVersionDownload({ project, version }) {
	if(typeof window === "undefined") {
		return;
	}

	const endpoint = getDownloadTrackingEndpoint({ project, version });
	if(!endpoint) {
		return;
	}

	try {
		if(typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
			const body = new Blob([""], { type: "text/plain;charset=UTF-8" });
			if(navigator.sendBeacon(endpoint, body)) {
				return;
			}
		}

		fetch(endpoint, {
			method: "POST",
			keepalive: true,
			credentials: "omit",
			headers: {
				Accept: "application/json",
			},
		}).catch(() => undefined);
	} catch {
		// Download navigation must not depend on analytics availability
	}
}