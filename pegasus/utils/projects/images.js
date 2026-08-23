const MAX_PROJECT_DESCRIPTION_IMAGE_BYTES = 10 * 1024 * 1024;

const IMAGE_EXTENSION_BY_MIME_TYPE = {
	"image/gif": "gif",
	"image/jpeg": "jpg",
	"image/png": "png",
	"image/webp": "webp",
};

const IMAGE_EXTENSION_ALIASES = {
	jpeg: "jpg",
	jpg: "jpg",
	png: "png",
	gif: "gif",
	webp: "webp",
};

export const getProjectDescriptionImageValidationError = (file) => {
	if(!(file instanceof File)) {
		return "invalidType";
	}

	const fileExtension = file.name.split(".").pop()?.toLowerCase() || "";
	const hasSupportedMimeType = Boolean(IMAGE_EXTENSION_BY_MIME_TYPE[file.type]);
	const hasSupportedExtension = Boolean(IMAGE_EXTENSION_ALIASES[fileExtension]);

	if(!hasSupportedMimeType && !hasSupportedExtension) {
		return "invalidType";
	}

	if(file.size > MAX_PROJECT_DESCRIPTION_IMAGE_BYTES) {
		return "fileTooLarge";
	}

	return null;
};

const getImageExtension = (file) => {
	const mimeTypeExtension = IMAGE_EXTENSION_BY_MIME_TYPE[file.type];
	if(mimeTypeExtension) {
		return mimeTypeExtension;
	}

	const fileExtension = file.name.split(".").pop()?.toLowerCase() || "";
	return IMAGE_EXTENSION_ALIASES[fileExtension] || "";
};

export const uploadProjectDescriptionImage = async ({ projectId, file, authToken, signal }) => {
	const extension = getImageExtension(file);
	const query = new URLSearchParams({
		project_id: String(projectId),
		context: "project",
		ext: extension,
	});
	const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE}/v2/image?${query}`, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${authToken}`,
			"Content-Type": "application/octet-stream",
		},
		body: file,
		signal,
	});

	let payload = null;
	try {
		payload = await response.json();
	} catch {}

	if(!response.ok || !payload?.url) {
		throw new Error(payload?.message || "Image upload failed");
	}

	return payload;
};