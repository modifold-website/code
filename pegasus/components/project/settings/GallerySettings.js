"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useLocale, useTranslations } from "next-intl";
import GalleryEditModal from "@/modal/GalleryEditModal";
import GalleryMediaModal from "@/modal/GalleryMediaModal";
import GalleryVideoModal from "@/modal/GalleryVideoModal";
import ConfirmModal from "@/modal/ConfirmModal";
import { getYouTubeThumbnailUrl, getYouTubeWatchUrl, isGalleryVideo, normalizeGalleryMedia } from "@/utils/gallery/media";

const GALLERY_STEPS = {
	FILES: "files",
	METADATA: "metadata",
};

const EMPTY_VIDEO_FORM = {
	id: null,
	youtubeUrl: "",
	title: "",
	description: "",
};

const MAX_GALLERY_IMAGE_SIZE = 100 * 1024 * 1024;
const GALLERY_IMAGE_EXTENSION_PATTERN = /\.(gif|jpe?g|png|webp)$/i;
const GALLERY_IMAGE_MIME_TYPES = new Set(["image/gif", "image/jpeg", "image/png", "image/webp"]);

const isGalleryImageFile = (file) => {
	const mimeType = (file?.type || "").toLowerCase();
	return GALLERY_IMAGE_MIME_TYPES.has(mimeType) || ((!mimeType || mimeType === "application/octet-stream") && GALLERY_IMAGE_EXTENSION_PATTERN.test(file?.name || ""));
};

const getUploadFileSignature = (file) => `${file.name}:${file.size}:${file.lastModified}`;
const withNormalizedOrdering = (media) => media.map((item, index) => ({ ...item, ordering: index }));

export default function GallerySettings({ project, authToken }) {
	const t = useTranslations("SettingsProjectPage");
	const tProject = useTranslations("ProjectPage");
	const locale = useLocale();
	const [galleryMedia, setGalleryMedia] = useState(() => normalizeGalleryMedia(project?.gallery));
	const [reorderLoading, setReorderLoading] = useState(false);
	const [reorderStatus, setReorderStatus] = useState("");
	const [draggedMediaId, setDraggedMediaId] = useState(null);
	const [dropTarget, setDropTarget] = useState(null);
	const [mediaModalOpen, setMediaModalOpen] = useState(false);
	const [mediaType, setMediaType] = useState("image");

	const [videoModalOpen, setVideoModalOpen] = useState(false);
	const [videoLoading, setVideoLoading] = useState(false);
	const [videoForm, setVideoForm] = useState(EMPTY_VIDEO_FORM);

	const [uploadLoading, setUploadLoading] = useState(false);
	const [uploadStep, setUploadStep] = useState(GALLERY_STEPS.FILES);
	const [uploadItems, setUploadItems] = useState([]);
	const [uploadIndex, setUploadIndex] = useState(0);
	const [isUploadDragActive, setIsUploadDragActive] = useState(false);
	const uploadFileRef = useRef(null);
	const uploadItemIdRef = useRef(0);
	const uploadPreviewUrlsRef = useRef(new Set());

	const [editModalOpen, setEditModalOpen] = useState(false);
	const [selectedImage, setSelectedImage] = useState(null);
	const [pendingDeleteItem, setPendingDeleteItem] = useState(null);
	const [editLoading, setEditLoading] = useState(false);
	const [editStep, setEditStep] = useState(GALLERY_STEPS.FILES);
	const [editSelectedFile, setEditSelectedFile] = useState(null);
	const [isEditDragActive, setIsEditDragActive] = useState(false);
	const editFileRef = useRef(null);
	const [editFormData, setEditFormData] = useState({ title: "", description: "", featured: false });

	useEffect(() => {
		setGalleryMedia(normalizeGalleryMedia(project?.gallery));
	}, [project?.gallery]);

	useEffect(() => () => {
		uploadPreviewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
		uploadPreviewUrlsRef.current.clear();
	}, []);

	const refreshGallery = async () => {
		const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE}/projects/${project.slug}`, {
			headers: {
				Accept: "application/json",
				Authorization: authToken ? `Bearer ${authToken}` : undefined,
			},
		});

		if(!response.ok) {
			throw new Error("Failed to refresh gallery");
		}

		const nextProject = await response.json();
		setGalleryMedia(normalizeGalleryMedia(nextProject?.gallery));
	};

	const formatFileSize = (size) => {
		if(!Number.isFinite(size) || size <= 0) {
			return "0 B";
		}

		const units = ["B", "KB", "MB", "GB"];
		const unitIndex = Math.min(Math.floor(Math.log(size) / Math.log(1024)), units.length - 1);
		const value = size / (1024 ** unitIndex);
		return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
	};

	const formatDate = (dateValue) => {
		if(!dateValue) {
			return "";
		}

		try {
			const date = new Date(dateValue);
			const options = { month: "long", day: "numeric" };
			if(date.getFullYear() !== new Date().getFullYear()) {
				options.year = "numeric";
			}

			return new Intl.DateTimeFormat(locale || undefined, options).format(date);
		} catch {
			return String(dateValue);
		}
	};

	const saveGalleryOrder = async (nextMedia, previousMedia) => {
		setGalleryMedia(nextMedia);
		setReorderLoading(true);
		setReorderStatus(t("gallerySettings.sort.saving"));

		try {
			const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE}/projects/${project.slug}/gallery/order`, {
				method: "PUT",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${authToken}`,
				},
				body: JSON.stringify({ ordered_ids: nextMedia.map((item) => item.id) }),
			});

			if(!response.ok) {
				throw new Error("Failed to save gallery order");
			}

			setReorderStatus(t("gallerySettings.sort.saved"));
		} catch {
			setGalleryMedia(previousMedia);
			setReorderStatus(t("gallerySettings.sort.error"));
			toast.error(t("gallerySettings.sort.error"));
		} finally {
			setReorderLoading(false);
		}
	};

	const moveGalleryItem = (mediaId, nextIndex) => {
		if(reorderLoading) {
			return;
		}

		const previousMedia = galleryMedia;
		const currentIndex = previousMedia.findIndex((item) => item.id === mediaId);
		const boundedNextIndex = Math.max(0, Math.min(nextIndex, previousMedia.length - 1));
		if(currentIndex < 0 || currentIndex === boundedNextIndex) {
			return;
		}

		const nextMedia = [...previousMedia];
		const [movedItem] = nextMedia.splice(currentIndex, 1);
		nextMedia.splice(boundedNextIndex, 0, movedItem);
		void saveGalleryOrder(withNormalizedOrdering(nextMedia), previousMedia);
	};

	const handleDragStart = (event, mediaId) => {
		if(reorderLoading || event.target.closest("button, a, input, textarea, select")) {
			event.preventDefault();
			return;
		}

		event.dataTransfer.effectAllowed = "move";
		event.dataTransfer.setData("text/plain", String(mediaId));
		setDraggedMediaId(mediaId);
		setReorderStatus(t("gallerySettings.sort.dragging"));
	};

	const handleDragOver = (event, mediaId) => {
		if(!draggedMediaId || draggedMediaId === mediaId) {
			return;
		}

		event.preventDefault();
		event.dataTransfer.dropEffect = "move";
		const bounds = event.currentTarget.getBoundingClientRect();
		const gridBounds = event.currentTarget.parentElement?.getBoundingClientRect();
		const isMultiColumn = gridBounds && gridBounds.width > bounds.width * 1.5;
		const position = isMultiColumn
			? event.clientX < bounds.left + bounds.width / 2 ? "before" : "after"
			: event.clientY < bounds.top + bounds.height / 2 ? "before" : "after";
		setDropTarget((currentTarget) => currentTarget?.id === mediaId && currentTarget?.position === position ? currentTarget : { id: mediaId, position });
	};

	const handleDrop = (event, targetId) => {
		event.preventDefault();
		const sourceId = draggedMediaId || Number(event.dataTransfer.getData("text/plain"));
		const sourceIndex = galleryMedia.findIndex((item) => item.id === sourceId);
		const targetIndex = galleryMedia.findIndex((item) => item.id === targetId);
		const position = dropTarget?.id === targetId ? dropTarget.position : "before";

		setDraggedMediaId(null);
		setDropTarget(null);

		if(sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) {
			setReorderStatus("");
			return;
		}

		let insertionIndex = targetIndex + (position === "after" ? 1 : 0);
		if(sourceIndex < insertionIndex) {
			insertionIndex -= 1;
		}

		moveGalleryItem(sourceId, insertionIndex);
	};

	const handleDragEnd = () => {
		setDraggedMediaId(null);
		setDropTarget(null);
		if(!reorderLoading) {
			setReorderStatus("");
		}
	};

	const openVideoModal = (video = null) => {
		setVideoForm(video ? {
			id: video.id,
			youtubeUrl: video.youtube_url || getYouTubeWatchUrl(video.youtube_video_id),
			title: video.title || "",
			description: video.description || "",
		} : { ...EMPTY_VIDEO_FORM });
		setVideoModalOpen(true);
	};

	const closeVideoModal = () => {
		if(!videoLoading) {
			setVideoModalOpen(false);
			setVideoForm({ ...EMPTY_VIDEO_FORM });
		}
	};

	const handleVideoSubmit = async (event) => {
		event.preventDefault();
		if(videoLoading) {
			return;
		}

		setVideoLoading(true);
		const isEditing = Boolean(videoForm.id);

		try {
			const endpoint = isEditing
				? `${process.env.NEXT_PUBLIC_API_BASE}/projects/${project.slug}/gallery/videos/${videoForm.id}`
				: `${process.env.NEXT_PUBLIC_API_BASE}/projects/${project.slug}/gallery/videos`;
			const response = await fetch(endpoint, {
				method: isEditing ? "PUT" : "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${authToken}`,
				},
				body: JSON.stringify({ youtube_url: videoForm.youtubeUrl, title: videoForm.title, description: videoForm.description }),
			});

			if(!response.ok) {
				throw new Error("Failed to save gallery video");
			}

			toast.success(t(isEditing ? "gallerySettings.video.updated" : "gallerySettings.video.added"));
			if(isEditing) {
				setVideoModalOpen(false);
				setVideoForm({ ...EMPTY_VIDEO_FORM });
			} else {
				resetMediaModal();
			}
			await refreshGallery();
		} catch {
			toast.error(t("gallerySettings.video.error"));
		} finally {
			setVideoLoading(false);
		}
	};

	const releaseUploadItems = (items) => {
		items.forEach((item) => {
			URL.revokeObjectURL(item.previewUrl);
			uploadPreviewUrlsRef.current.delete(item.previewUrl);
		});
	};

	const resetMediaModal = () => {
		releaseUploadItems(uploadItems);
		setMediaModalOpen(false);
		setMediaType("image");
		setVideoForm({ ...EMPTY_VIDEO_FORM });
		setUploadLoading(false);
		setUploadStep(GALLERY_STEPS.FILES);
		setUploadItems([]);
		setUploadIndex(0);
		setIsUploadDragActive(false);

		if(uploadFileRef.current) {
			uploadFileRef.current.value = "";
		}
	};

	const closeMediaModal = () => {
		if(!uploadLoading && !videoLoading) {
			resetMediaModal();
		}
	};

	const openUploadFilePicker = () => {
		if(uploadLoading || !uploadFileRef.current) {
			return;
		}

		uploadFileRef.current.value = "";
		uploadFileRef.current.click();
	};

	const addUploadFiles = (fileList) => {
		const files = Array.from(fileList || []);
		if(files.length === 0) {
			return;
		}

		const imageFiles = files.filter(isGalleryImageFile);
		if(imageFiles.length !== files.length) {
			toast.error(t("gallerySettings.errors.invalidFiles"));
		}

		const filesWithinLimit = imageFiles.filter((file) => file.size <= MAX_GALLERY_IMAGE_SIZE);
		if(filesWithinLimit.length !== imageFiles.length) {
			toast.error(t("gallerySettings.errors.fileTooLarge"));
		}

		const existingSignatures = new Set(uploadItems.map((item) => getUploadFileSignature(item.file)));
		const uniqueFiles = filesWithinLimit.filter((file) => {
			const signature = getUploadFileSignature(file);
			if(existingSignatures.has(signature)) {
				return false;
			}

			existingSignatures.add(signature);
			return true;
		});

		const nextItems = uniqueFiles.map((file) => {
			const previewUrl = URL.createObjectURL(file);
			uploadPreviewUrlsRef.current.add(previewUrl);
			uploadItemIdRef.current += 1;

			return {
				id: `${getUploadFileSignature(file)}:${uploadItemIdRef.current}`,
				file,
				previewUrl,
				title: "",
				description: "",
				featured: false,
			};
		});

		if(nextItems.length > 0) {
			setUploadItems((currentItems) => [...currentItems, ...nextItems]);
		}
	};

	const handleUploadFileChange = (event) => {
		addUploadFiles(event.target.files);
		event.target.value = "";
	};

	const handleUploadDragOver = (event) => {
		event.preventDefault();
		event.stopPropagation();
		setIsUploadDragActive(true);
	};

	const handleUploadDragLeave = (event) => {
		event.preventDefault();
		event.stopPropagation();
		if(!event.currentTarget.contains(event.relatedTarget)) {
			setIsUploadDragActive(false);
		}
	};

	const handleUploadDrop = (event) => {
		event.preventDefault();
		event.stopPropagation();
		setIsUploadDragActive(false);
		addUploadFiles(event.dataTransfer?.files);
	};

	const removeUploadItem = (itemId) => {
		if(uploadLoading) {
			return;
		}

		const itemToRemove = uploadItems.find((item) => item.id === itemId);
		if(itemToRemove) {
			releaseUploadItems([itemToRemove]);
		}

		const nextItems = uploadItems.filter((item) => item.id !== itemId);
		setUploadItems(nextItems);
		setUploadIndex((currentIndex) => Math.max(0, Math.min(currentIndex, nextItems.length - 1)));

		if(nextItems.length === 0) {
			setUploadStep(GALLERY_STEPS.FILES);
		}
	};

	const handleUploadInputChange = (event) => {
		const { name, value } = event.target;
		setUploadItems((currentItems) => currentItems.map((item, index) => index === uploadIndex ? { ...item, [name]: value } : item));
	};

	const toggleUploadFeatured = () => {
		setUploadItems((currentItems) => {
			const shouldFeature = !currentItems[uploadIndex]?.featured;
			return currentItems.map((item, index) => ({ ...item, featured: index === uploadIndex ? shouldFeature : false }));
		});
	};

	const uploadGalleryItem = async (item) => {
		const formData = new FormData();
		formData.append("image", item.file);
		formData.append("title", item.title);
		formData.append("description", item.description);
		formData.append("featured", item.featured);

		const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE}/projects/${project.slug}/gallery`, {
			method: "POST",
			headers: { Authorization: `Bearer ${authToken}` },
			body: formData,
		});

		return response.ok;
	};

	const handleSubmit = async (event) => {
		event.preventDefault();
		if(uploadItems.length === 0 || uploadLoading) {
			return;
		}

		setUploadLoading(true);
		const failedItems = [];

		for(const item of uploadItems) {
			try {
				if(!await uploadGalleryItem(item)) {
					failedItems.push(item);
				}
			} catch {
				failedItems.push(item);
			}
		}

		const failedIds = new Set(failedItems.map((item) => item.id));
		const uploadedItems = uploadItems.filter((item) => !failedIds.has(item.id));

		if(failedItems.length === 0) {
			toast.success(t("gallerySettings.successMultiple", { count: uploadItems.length }));
			resetMediaModal();
		} else {
			releaseUploadItems(uploadedItems);
			setUploadItems(failedItems);
			setUploadIndex(0);
			setUploadLoading(false);
			toast.error(t("gallerySettings.errors.uploadMultiple", { count: failedItems.length }));
		}

		if(uploadedItems.length > 0) {
			try {
				await refreshGallery();
			} catch {
				toast.error(t("gallerySettings.errors.refresh"));
			}
		}
	};

	const openEditModal = (image) => {
		setSelectedImage(image);
		setEditFormData({ title: image?.title || "", description: image?.description || "", featured: Boolean(Number(image?.featured)) });
		setEditSelectedFile(null);
		setIsEditDragActive(false);
		setEditStep(GALLERY_STEPS.FILES);
		setEditModalOpen(true);
	};

	const closeEditModal = () => {
		setEditModalOpen(false);
		setSelectedImage(null);
		setEditLoading(false);
		setEditStep(GALLERY_STEPS.FILES);
		setEditSelectedFile(null);
		setIsEditDragActive(false);
		if(editFileRef.current) {
			editFileRef.current.value = "";
		}
	};

	const openEditFilePicker = () => {
		if(editLoading || !editFileRef.current) {
			return;
		}

		editFileRef.current.value = "";
		editFileRef.current.click();
	};

	const handleEditFileSelected = (file) => {
		if(!file) {
			return;
		}

		if(!isGalleryImageFile(file)) {
			toast.error(t("gallerySettings.errors.invalidFiles"));
			return;
		}

		if(file.size > MAX_GALLERY_IMAGE_SIZE) {
			toast.error(t("gallerySettings.errors.fileTooLarge"));
			return;
		}

		setEditSelectedFile(file);
		setEditStep(GALLERY_STEPS.METADATA);
	};

	const handleEditFileChange = (event) => handleEditFileSelected(event.target.files?.[0] || null);
	const handleEditDragOver = (event) => {
		event.preventDefault();
		event.stopPropagation();
		setIsEditDragActive(true);
	};
	const handleEditDragLeave = (event) => {
		event.preventDefault();
		event.stopPropagation();
		if(!event.currentTarget.contains(event.relatedTarget)) {
			setIsEditDragActive(false);
		}
	};
	const handleEditDrop = (event) => {
		event.preventDefault();
		event.stopPropagation();
		setIsEditDragActive(false);
		handleEditFileSelected(event.dataTransfer?.files?.[0] || null);
	};
	const handleEditInputChange = (event) => {
		const { name, value } = event.target;
		setEditFormData((currentForm) => ({ ...currentForm, [name]: value }));
	};
	const toggleEditFeatured = () => setEditFormData((currentForm) => ({ ...currentForm, featured: !currentForm.featured }));

	const handleUpdate = async (event) => {
		event.preventDefault();
		if(!selectedImage) {
			return;
		}

		setEditLoading(true);
		const formData = new FormData();
		formData.append("title", editFormData.title);
		formData.append("description", editFormData.description);
		formData.append("featured", editFormData.featured);

		if(editSelectedFile) {
			formData.append("image", editSelectedFile);
		}

		try {
			const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE}/projects/${project.slug}/gallery/${selectedImage.id}`, {
				method: "PUT",
				headers: { Authorization: `Bearer ${authToken}` },
				body: formData,
			});

			if(!response.ok) {
				throw new Error("Failed to update gallery image");
			}

			toast.success(tProject("gallery.updateSuccess"));
			closeEditModal();
			await refreshGallery();
		} catch {
			toast.error(tProject("gallery.updateError"));
		} finally {
			setEditLoading(false);
		}
	};

	const handleDelete = async () => {
		if(!pendingDeleteItem) {
			return;
		}

		setEditLoading(true);
		try {
			const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE}/projects/${project.slug}/gallery/${pendingDeleteItem.id}`, {
				method: "DELETE",
				headers: { Authorization: `Bearer ${authToken}` },
			});

			if(!response.ok) {
				throw new Error("Failed to delete gallery item");
			}

			toast.success(t(pendingDeleteItem.type === "video" ? "gallerySettings.video.deleted" : "gallerySettings.imageDeleted"));
			setPendingDeleteItem(null);
			if(editModalOpen) {
				closeEditModal();
			}
			await refreshGallery();
		} catch {
			toast.error(t(pendingDeleteItem.type === "video" ? "gallerySettings.video.deleteError" : "gallerySettings.errors.delete"));
		} finally {
			setEditLoading(false);
		}
	};

	return (
		<>
			<div className="gallery-settings">
				<div className="content content--padding gallery-media-toolbar">
					<div className="gallery-media-toolbar__copy">
						<h2>{t("gallerySettings.media.title")}</h2>
						<p>{t("gallerySettings.media.description")}</p>
					</div>

					<div className="gallery-media-toolbar__actions">
						<button type="button" className="button button--size-m button--type-primary button--with-icon" onClick={() => {
							setMediaType("image");
							setMediaModalOpen(true);
						}}>
							<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
								<path d="M12 5v14" />
								<path d="M5 12h14" />
							</svg>

							{t("gallerySettings.actions.addMedia")}
						</button>
					</div>
				</div>

				{galleryMedia.length === 0 ? (
					<div className="subsite-empty-feed">
						<p className="subsite-empty-feed__title">{t("gallerySettings.empty.title")}</p>
					</div>
				) : (
					<>
						<p className="sr-only" aria-live="polite">{reorderStatus}</p>

						<div className="gallery-settings-grid" role="list">
							{galleryMedia.map((media, index) => {
								const isVideo = isGalleryVideo(media);
								const isDragging = draggedMediaId === media.id;
								const dropPosition = dropTarget?.id === media.id ? dropTarget.position : "";
								const itemTitle = media.title || t(isVideo ? "gallerySettings.video.untitled" : "gallerySettings.imageUntitled", { position: index + 1 });

								return (
									<article key={media.id} className={`gallery-settings-card gallery-settings-card--draggable ${isDragging ? "is-dragging" : ""} ${dropPosition ? `is-drop-${dropPosition}` : ""}`} draggable={!reorderLoading} role="listitem" onDragStart={(event) => handleDragStart(event, media.id)} onDragOver={(event) => handleDragOver(event, media.id)} onDrop={(event) => handleDrop(event, media.id)} onDragEnd={handleDragEnd} aria-label={t("gallerySettings.sort.drag", { title: itemTitle })}>
										<div className={`gallery-settings-card__preview ${isVideo ? "gallery-settings-card__preview--video" : ""}`}>
											<img src={isVideo ? getYouTubeThumbnailUrl(media.youtube_video_id) : media.url} alt={itemTitle} className="gallery-settings-card__image" loading={index < 3 ? "eager" : "lazy"} draggable={false} />

											{isVideo ? (
												<span className="gallery-settings-card__play" aria-hidden="true">
													<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-play-icon lucide-play">
														<path d="M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z"/>
													</svg>
												</span>
											) : null}
										</div>

										<div className="gallery-settings-card__body">
											{media.title || media.description ? (
												<div className="gallery-settings-card__info">
													{media.title ? <h2>{media.title}</h2> : null}

													{media.description ? <p>{media.description}</p> : null}
												</div>
											) : null}

											{media.created_at ? (
												<time className="gallery-settings-card__date" dateTime={media.created_at}>
													<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
														<path d="M8 2v4" />
														<path d="M16 2v4" />
														<rect width="18" height="18" x="3" y="4" rx="2" />
														<path d="M3 10h18" />
													</svg>

													{formatDate(media.created_at)}
												</time>
											) : null}

											<div className="gallery-settings-card__actions">
												<button type="button" className="button button--size-m button--type-minimal" onClick={() => isVideo ? openVideoModal(media) : openEditModal(media)}>
													{isVideo ? t("gallerySettings.actions.edit") : tProject("gallery.editImage")}
												</button>
												
												<button type="button" className="button button--size-m button--type-minimal" onClick={() => setPendingDeleteItem({ id: media.id, type: isVideo ? "video" : "image" })}>
													{tProject("delete")}
												</button>
											</div>
										</div>
									</article>
								);
							})}
						</div>
					</>
				)}
			</div>

			<GalleryMediaModal isOpen={mediaModalOpen} onRequestClose={closeMediaModal} mediaType={mediaType} onMediaTypeChange={setMediaType} uploadLoading={uploadLoading} uploadStep={uploadStep} uploadSteps={GALLERY_STEPS} uploadItems={uploadItems} uploadIndex={uploadIndex} isUploadDragActive={isUploadDragActive} uploadFileRef={uploadFileRef} openUploadFilePicker={openUploadFilePicker} handleUploadDragOver={handleUploadDragOver} handleUploadDragLeave={handleUploadDragLeave} handleUploadDrop={handleUploadDrop} handleUploadFileChange={handleUploadFileChange} formatFileSize={formatFileSize} removeUploadItem={removeUploadItem} goToUploadFilesStep={() => !uploadLoading && setUploadStep(GALLERY_STEPS.FILES)} goToUploadMetadataStep={() => uploadItems.length > 0 && !uploadLoading && setUploadStep(GALLERY_STEPS.METADATA)} goToUploadItem={(index) => !uploadLoading && setUploadIndex(index)} handleSubmit={handleSubmit} handleUploadInputChange={handleUploadInputChange} toggleUploadFeatured={toggleUploadFeatured} videoLoading={videoLoading} videoForm={videoForm} setVideoForm={setVideoForm} onVideoSubmit={handleVideoSubmit} t={t} tProject={tProject} />

			<GalleryVideoModal isOpen={videoModalOpen} onRequestClose={closeVideoModal} isLoading={videoLoading} videoForm={videoForm} setVideoForm={setVideoForm} onSubmit={handleVideoSubmit} t={t} tProject={tProject} />

			{editModalOpen && selectedImage ? (
				<GalleryEditModal isOpen={editModalOpen} onRequestClose={closeEditModal} editLoading={editLoading} editStep={editStep} editSteps={GALLERY_STEPS} editSelectedFile={editSelectedFile} isEditDragActive={isEditDragActive} editFileRef={editFileRef} openEditFilePicker={openEditFilePicker} handleEditDragOver={handleEditDragOver} handleEditDragLeave={handleEditDragLeave} handleEditDrop={handleEditDrop} handleEditFileChange={handleEditFileChange} formatFileSize={formatFileSize} goToEditFilesStep={() => !editLoading && setEditStep(GALLERY_STEPS.FILES)} goToEditMetadataStep={() => !editLoading && setEditStep(GALLERY_STEPS.METADATA)} handleUpdate={handleUpdate} handleDelete={() => setPendingDeleteItem({ id: selectedImage.id, type: "image" })} editFormData={editFormData} handleEditInputChange={handleEditInputChange} toggleEditFeatured={toggleEditFeatured} t={t} tProject={tProject} />
			) : null}

			<ConfirmModal isOpen={Boolean(pendingDeleteItem)} title={t(pendingDeleteItem?.type === "video" ? "gallerySettings.video.deleteConfirm" : "gallerySettings.imageDeleteConfirm")} confirmLabel={tProject("delete")} cancelLabel={tProject("cancel")} isLoading={editLoading} onConfirm={handleDelete} onRequestClose={() => !editLoading && setPendingDeleteItem(null)} />
		</>
	);
}