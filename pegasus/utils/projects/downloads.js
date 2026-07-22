export function getVersionPrimaryFile(version) {
	if(!version || typeof version !== "object") {
		return null;
	}

	const directFile = version.primary_file || version.primaryFile || version.file;
	if(directFile?.url || directFile?.file_url) {
		return directFile;
	}

	if(Array.isArray(version.files)) {
		return version.files.find((file) => file?.primary) || version.files[0] || null;
	}

	return version.file_url ? { url: version.file_url, size: version.file_size, primary: true } : null;
}

export function getVersionDownloadUrl(version) {
	const primaryFile = getVersionPrimaryFile(version);
	const candidates = [
		primaryFile?.url,
		primaryFile?.file_url,
		version?.download_url,
		version?.downloadUrl,
		version?.file_url,
		version?.fileUrl,
	];

	return candidates.find((url) => typeof url === "string" && url.trim()) || null;
}