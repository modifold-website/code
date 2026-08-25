const YOUTUBE_VIDEO_ID_PATTERN = /^[a-zA-Z0-9_-]{11}$/;

export const isGalleryVideo = (media) => media?.media_type === "video";

export const getYouTubeVideoId = (value) => {
	if(typeof value !== "string") {
		return "";
	}

	const trimmedValue = value.trim();
	if(YOUTUBE_VIDEO_ID_PATTERN.test(trimmedValue)) {
		return trimmedValue;
	}

	let parsedUrl;
	try {
		parsedUrl = new URL(trimmedValue);
	} catch {
		return "";
	}

	const hostname = parsedUrl.hostname.replace(/^www\./i, "").toLowerCase();
	if(hostname === "youtu.be") {
		const videoId = parsedUrl.pathname.split("/").filter(Boolean)[0] || "";
		return YOUTUBE_VIDEO_ID_PATTERN.test(videoId) ? videoId : "";
	}

	if(["youtube.com", "m.youtube.com", "music.youtube.com"].includes(hostname)) {
		if(parsedUrl.pathname === "/watch") {
			const videoId = parsedUrl.searchParams.get("v") || "";
			return YOUTUBE_VIDEO_ID_PATTERN.test(videoId) ? videoId : "";
		}

		const pathParts = parsedUrl.pathname.split("/").filter(Boolean);
		if(["embed", "shorts", "live"].includes(pathParts[0])) {
			const videoId = pathParts[1] || "";
			return YOUTUBE_VIDEO_ID_PATTERN.test(videoId) ? videoId : "";
		}
	}

	return "";
};

export const getYouTubeEmbedUrl = (videoId, { autoplay = false } = {}) => {
	if(!videoId) {
		return "";
	}

	const query = autoplay ? "?autoplay=1&mute=1&playsinline=1&rel=0" : "";
	return `https://www.youtube.com/embed/${videoId}${query}`;
};

export const getYouTubeThumbnailUrl = (videoId) => videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : "";

export const getYouTubeWatchUrl = (videoId) => videoId ? `https://www.youtube.com/watch?v=${videoId}` : "";

export const normalizeGalleryMedia = (gallery) => (
	Array.isArray(gallery) ? gallery
		.filter((media) => isGalleryVideo(media) ? Boolean(media?.youtube_video_id) : Boolean(media?.url))
		.toSorted((first, second) => {
			const orderDifference = (Number(first?.ordering) || 0) - (Number(second?.ordering) || 0);
			return orderDifference || (Number(first?.id) || 0) - (Number(second?.id) || 0);
		}): []
);