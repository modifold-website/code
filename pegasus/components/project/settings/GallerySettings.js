"use client";

import React, { useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useTranslations } from "next-intl";
import GalleryUploadModal from "@/modal/GalleryUploadModal";
import GalleryEditModal from "@/modal/GalleryEditModal";
import GalleryTrailerModal from "@/modal/GalleryTrailerModal";

const GALLERY_STEPS = {
    FILES: "files",
    METADATA: "metadata",
};

const getYouTubeEmbedUrl = (videoId) => {
    if(!videoId) {
        return "";
    }

    return `https://www.youtube.com/embed/${videoId}`;
};

const getYouTubeWatchUrl = (videoId) => {
    if(!videoId) {
        return "";
    }

    return `https://www.youtube.com/watch?v=${videoId}`;
};

export default function GallerySettings({ project, authToken }) {
    const t = useTranslations("SettingsProjectPage");
    const tProject = useTranslations("ProjectPage");

    const images = Array.isArray(project?.gallery) ? project.gallery : [];
    const [galleryImages, setGalleryImages] = useState(images);
    const [trailerUrl, setTrailerUrl] = useState(project?.trailer_youtube_url || "");
    const [trailerVideoId, setTrailerVideoId] = useState(project?.trailer_youtube_video_id || "");
    const [trailerLoading, setTrailerLoading] = useState(false);
    const [trailerModalOpen, setTrailerModalOpen] = useState(false);

    const [uploadModalOpen, setUploadModalOpen] = useState(false);
    const [uploadLoading, setUploadLoading] = useState(false);
    const [uploadStep, setUploadStep] = useState(GALLERY_STEPS.FILES);
    const [uploadFile, setUploadFile] = useState(null);
    const [isUploadDragActive, setIsUploadDragActive] = useState(false);
    const uploadFileRef = useRef(null);

    const [uploadFormData, setUploadFormData] = useState({
        title: "",
        description: "",
        ordering: 0,
        featured: false,
    });

    const [editModalOpen, setEditModalOpen] = useState(false);
    const [selectedImage, setSelectedImage] = useState(null);
    const [editLoading, setEditLoading] = useState(false);
    const [editStep, setEditStep] = useState(GALLERY_STEPS.FILES);
    const [editSelectedFile, setEditSelectedFile] = useState(null);
    const [isEditDragActive, setIsEditDragActive] = useState(false);
    const editFileRef = useRef(null);

    const [editFormData, setEditFormData] = useState({
        title: "",
        description: "",
        ordering: 0,
        featured: false,
    });

    useEffect(() => {
        setGalleryImages(Array.isArray(project?.gallery) ? project.gallery : []);
        setTrailerUrl(project?.trailer_youtube_url || "");
        setTrailerVideoId(project?.trailer_youtube_video_id || "");
    }, [project?.gallery, project?.trailer_youtube_url, project?.trailer_youtube_video_id]);

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
        setGalleryImages(Array.isArray(nextProject?.gallery) ? nextProject.gallery : []);
        setTrailerUrl(nextProject?.trailer_youtube_url || "");
        setTrailerVideoId(nextProject?.trailer_youtube_video_id || "");
    };

    const handleTrailerSubmit = async (event) => {
        event.preventDefault();
        setTrailerLoading(true);

        try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE}/projects/${project.slug}/gallery/trailer`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${authToken}`,
                },
                body: JSON.stringify({ youtube_url: trailerUrl }),
            });

            if(response.ok) {
                const data = await response.json();
                setTrailerUrl(data?.trailer_youtube_url || "");
                setTrailerVideoId(data?.trailer_youtube_video_id || "");
                setTrailerModalOpen(false);
                toast.success(t("gallerySettings.trailer.success"));
            } else {
                toast.error(t("gallerySettings.trailer.error"));
            }
        } catch {
            toast.error(t("gallerySettings.trailer.error"));
        } finally {
            setTrailerLoading(false);
        }
    };

    const handleTrailerDelete = async () => {
        setTrailerLoading(true);

        try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE}/projects/${project.slug}/gallery/trailer`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${authToken}`,
                },
                body: JSON.stringify({ youtube_url: "" }),
            });

            if(response.ok) {
                setTrailerUrl("");
                setTrailerVideoId("");
                setTrailerModalOpen(false);
                toast.success(t("gallerySettings.trailer.deleted"));
            } else {
                toast.error(t("gallerySettings.trailer.error"));
            }
        } catch {
            toast.error(t("gallerySettings.trailer.error"));
        } finally {
            setTrailerLoading(false);
        }
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

    const openUploadModal = () => {
        setUploadModalOpen(true);
    };

    const openTrailerModal = () => {
        setTrailerUrl(trailerVideoId ? getYouTubeWatchUrl(trailerVideoId) : "");
        setTrailerModalOpen(true);
    };

    const closeTrailerModal = () => {
        if(trailerLoading) {
            return;
        }

        setTrailerModalOpen(false);
        setTrailerUrl(trailerVideoId ? getYouTubeWatchUrl(trailerVideoId) : "");
    };

    const resetUploadModal = () => {
        setUploadModalOpen(false);
        setUploadLoading(false);
        setUploadStep(GALLERY_STEPS.FILES);
        setUploadFile(null);
        setIsUploadDragActive(false);
        setUploadFormData({
            title: "",
            description: "",
            ordering: 0,
            featured: false,
        });

        if(uploadFileRef.current) {
            uploadFileRef.current.value = "";
        }
    };

    const openUploadFilePicker = () => {
        if(uploadLoading || !uploadFileRef.current) {
            return;
        }

        uploadFileRef.current.value = "";
        uploadFileRef.current.click();
    };

    const handleUploadFileSelected = (file) => {
        if(!file) {
            return;
        }

        setUploadFile(file);
        setUploadStep(GALLERY_STEPS.METADATA);
    };

    const handleUploadFileChange = (event) => {
        const file = event.target.files?.[0] || null;
        handleUploadFileSelected(file);
    };

    const handleUploadDragOver = (event) => {
        event.preventDefault();
        event.stopPropagation();
        setIsUploadDragActive(true);
    };

    const handleUploadDragLeave = (event) => {
        event.preventDefault();
        event.stopPropagation();
        if(event.currentTarget.contains(event.relatedTarget)) {
            return;
        }

        setIsUploadDragActive(false);
    };

    const handleUploadDrop = (event) => {
        event.preventDefault();
        event.stopPropagation();
        setIsUploadDragActive(false);

        const file = event.dataTransfer?.files?.[0] || null;
        if(!file) {
            return;
        }

        handleUploadFileSelected(file);

        if(uploadFileRef.current) {
            const dt = new DataTransfer();
            dt.items.add(file);
            uploadFileRef.current.files = dt.files;
        }
    };

    const handleUploadInputChange = (event) => {
        const { name, value } = event.target;
        setUploadFormData((prev) => ({ ...prev, [name]: name === "ordering" ? value : value }));
    };

    const toggleUploadFeatured = () => {
        setUploadFormData((prev) => ({ ...prev, featured: !prev.featured }));
    };

    const goToUploadFilesStep = () => {
        if(uploadLoading) {
            return;
        }

        setUploadStep(GALLERY_STEPS.FILES);
    };

    const goToUploadMetadataStep = () => {
        if(uploadLoading || !uploadFile) {
            return;
        }

        setUploadStep(GALLERY_STEPS.METADATA);
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        if(!uploadFile) {
            return;
        }

        setUploadLoading(true);

        const formDataToSend = new FormData();
        formDataToSend.append("image", uploadFile);
        formDataToSend.append("title", uploadFormData.title);
        formDataToSend.append("description", uploadFormData.description);
        formDataToSend.append("ordering", uploadFormData.ordering);
        formDataToSend.append("featured", uploadFormData.featured);

        try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE}/projects/${project.slug}/gallery`, {
                method: "POST",
                headers: { Authorization: `Bearer ${authToken}` },
                body: formDataToSend,
            });

            if(response.ok) {
                toast.success(t("gallerySettings.success"));
                resetUploadModal();
                await refreshGallery();
            } else {
                toast.error(t("gallerySettings.errors.upload"));
            }
        } catch {
            toast.error(t("gallerySettings.errors.upload"));
        } finally {
            setUploadLoading(false);
        }
    };

    const openEditModal = (image) => {
        setSelectedImage(image);
        setEditFormData({
            title: image?.title || "",
            description: image?.description || "",
            ordering: image?.ordering ?? 0,
            featured: Boolean(Number(image?.featured)),
        });
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

        setEditSelectedFile(file);
        setEditStep(GALLERY_STEPS.METADATA);
    };

    const handleEditFileChange = (event) => {
        const file = event.target.files?.[0] || null;
        handleEditFileSelected(file);
    };

    const handleEditDragOver = (event) => {
        event.preventDefault();
        event.stopPropagation();
        setIsEditDragActive(true);
    };

    const handleEditDragLeave = (event) => {
        event.preventDefault();
        event.stopPropagation();
        if(event.currentTarget.contains(event.relatedTarget)) {
            return;
        }

        setIsEditDragActive(false);
    };

    const handleEditDrop = (event) => {
        event.preventDefault();
        event.stopPropagation();
        setIsEditDragActive(false);

        const file = event.dataTransfer?.files?.[0] || null;
        if(!file) {
            return;
        }

        handleEditFileSelected(file);

        if(editFileRef.current) {
            const dt = new DataTransfer();
            dt.items.add(file);
            editFileRef.current.files = dt.files;
        }
    };

    const handleEditInputChange = (event) => {
        const { name, value } = event.target;
        setEditFormData((prev) => ({ ...prev, [name]: value }));
    };

    const toggleEditFeatured = () => {
        setEditFormData((prev) => ({ ...prev, featured: !prev.featured }));
    };

    const goToEditFilesStep = () => {
        if(editLoading) {
            return;
        }

        setEditStep(GALLERY_STEPS.FILES);
    };

    const goToEditMetadataStep = () => {
        if(editLoading) {
            return;
        }

        setEditStep(GALLERY_STEPS.METADATA);
    };

    const handleUpdate = async (event) => {
        event.preventDefault();
        if(!selectedImage) {
            return;
        }

        setEditLoading(true);

        const formDataToSend = new FormData();
        formDataToSend.append("title", editFormData.title);
        formDataToSend.append("description", editFormData.description);
        formDataToSend.append("ordering", editFormData.ordering);
        formDataToSend.append("featured", editFormData.featured);

        if(editSelectedFile) {
            formDataToSend.append("image", editSelectedFile);
        }

        try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE}/projects/${project.slug}/gallery/${selectedImage.id}`, {
                method: "PUT",
                headers: { Authorization: `Bearer ${authToken}` },
                body: formDataToSend,
            });

            if(response.ok) {
                toast.success(tProject("gallery.updateSuccess"));
                closeEditModal();
                await refreshGallery();
            } else {
                toast.error(tProject("gallery.updateError"));
            }
        } catch {
            toast.error(tProject("gallery.updateError"));
        } finally {
            setEditLoading(false);
        }
    };

    const handleDelete = async () => {
        if(!selectedImage) {
            return;
        }

        if(!confirm(tProject("gallery.deleteConfirm"))) {
            return;
        }

        setEditLoading(true);

        try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE}/projects/${project.slug}/gallery/${selectedImage.id}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${authToken}` },
            });

            if(response.ok) {
                toast.success(tProject("gallery.deleteSuccess"));
                closeEditModal();
                await refreshGallery();
            } else {
                toast.error(tProject("gallery.deleteError"));
            }
        } catch {
            toast.error(tProject("gallery.deleteError"));
        } finally {
            setEditLoading(false);
        }
    };

    const handleDeleteById = async (imageId) => {
        if(!confirm(tProject("gallery.deleteConfirm"))) {
            return;
        }

        try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE}/projects/${project.slug}/gallery/${imageId}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${authToken}` },
            });

            if(response.ok) {
                toast.success(tProject("gallery.deleteSuccess"));
                await refreshGallery();
            } else {
                toast.error(tProject("gallery.deleteError"));
            }
        } catch {
            toast.error(tProject("gallery.deleteError"));
        }
    };

    const formatDate = (dateValue) => {
        if(!dateValue) {
            return "";
        }

        try {
            return new Intl.DateTimeFormat(undefined, {
                year: "numeric",
                month: "long",
                day: "numeric",
            }).format(new Date(dateValue));
        } catch {
            return String(dateValue);
        }
    };

    const hasGalleryMedia = trailerVideoId || galleryImages.length > 0;

    return (
        <>
            <div style={{ width: "100%" }}>
                <div className="content content--padding gallery-media-toolbar">
                    <div className="gallery-media-toolbar__copy">
                        <h2>{t("gallerySettings.media.title")}</h2>
                        <p>{t("gallerySettings.media.description")}</p>
                    </div>

                    <div className="gallery-media-toolbar__actions">
                        <button type="button" className="button button--size-m button--type-minimal button--with-icon gallery-media-toolbar__button" style={{ "--icon-size": "17px" }} onClick={openTrailerModal}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-play-icon lucide-play"><path d="m6 3 14 9-14 9V3Z"/></svg>

                            {t("gallerySettings.trailer.add")}
                        </button>

                        <button type="button" className="button button--size-m button--type-primary button--with-icon" style={{ "--icon-size": "17px" }} onClick={openUploadModal}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-upload-icon lucide-upload"><path d="M12 3v12"/><path d="m17 8-5-5-5 5"/><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/></svg>

                            {t("gallerySettings.actions.add")}
                        </button>
                    </div>
                </div>

                {!hasGalleryMedia ? (
                    <div className="subsite-empty-feed">
                        <p className="subsite-empty-feed__title">{tProject("gallery.noImages")}</p>
                    </div>
                ) : (
                    <div className="gallery-settings-grid">
                        {trailerVideoId && (
                            <div className="gallery-settings-card gallery-settings-card--trailer-editor">
                                <div className="gallery-settings-card__preview gallery-settings-card__preview--video">
                                    <iframe
                                        src={getYouTubeEmbedUrl(trailerVideoId)}
                                        title={t("gallerySettings.trailer.previewTitle")}
                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                        allowFullScreen
                                    />
                                </div>

                                <div className="gallery-settings-card__body" style={{ paddingTop: "12px" }}>
                                    <div className="gallery-settings-card__info">
                                        <div className="gallery-settings-card__date" style={{ marginBottom: "12px" }}>
                                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="m6 3 14 9-14 9V3Z"></path>
                                            </svg>

                                            {tProject("gallery.trailer")}
                                        </div>

                                        <p>{t("gallerySettings.trailer.cardDescription")}</p>
                                    </div>

                                    <div className="gallery-settings-card__actions">
                                        <button type="button" className="button button--size-m button--type-minimal" onClick={openTrailerModal}>
                                            {tProject("gallery.editImage")}
                                        </button>

                                        <button type="button" className="button button--size-m button--type-minimal" onClick={handleTrailerDelete} disabled={trailerLoading}>
                                            {tProject("delete")}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {galleryImages.map((image) => (
                            <div key={image.id} className="gallery-settings-card">
                                <div className="gallery-settings-card__preview">
                                    <img src={image.url} alt={image.title || tProject("gallery.image")} className="gallery-settings-card__image" loading={Boolean(Number(image?.featured)) ? "eager" : "lazy"} />
                                </div>

                                <div className="gallery-settings-card__body">
                                    {(image.title || image.description) &&
                                        <div className="gallery-settings-card__info">
                                            {image.title && <h2>{image.title}</h2>}

                                            {image.description && <p>{image.description}</p>}
                                        </div>
                                    }

                                    <div className="gallery-settings-card__date">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-calendar-icon lucide-calendar"><path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/></svg>

                                        {formatDate(image.created_at)}
                                    </div>

                                    <div className="gallery-settings-card__actions">
                                        <button type="button" className="button button--size-m button--type-minimal" onClick={() => openEditModal(image)}>
                                            {tProject("gallery.editImage")}
                                        </button>

                                        <button type="button" className="button button--size-m button--type-minimal" onClick={() => handleDeleteById(image.id)}>
                                            {tProject("delete")}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <GalleryUploadModal
                isOpen={uploadModalOpen}
                onRequestClose={resetUploadModal}
                uploadLoading={uploadLoading}
                uploadStep={uploadStep}
                uploadSteps={GALLERY_STEPS}
                uploadFile={uploadFile}
                isUploadDragActive={isUploadDragActive}
                uploadFileRef={uploadFileRef}
                openUploadFilePicker={openUploadFilePicker}
                handleUploadDragOver={handleUploadDragOver}
                handleUploadDragLeave={handleUploadDragLeave}
                handleUploadDrop={handleUploadDrop}
                handleUploadFileChange={handleUploadFileChange}
                formatFileSize={formatFileSize}
                goToUploadFilesStep={goToUploadFilesStep}
                goToUploadMetadataStep={goToUploadMetadataStep}
                handleSubmit={handleSubmit}
                uploadFormData={uploadFormData}
                handleUploadInputChange={handleUploadInputChange}
                toggleUploadFeatured={toggleUploadFeatured}
                t={t}
                tProject={tProject}
            />

            <GalleryTrailerModal
                isOpen={trailerModalOpen}
                onRequestClose={closeTrailerModal}
                trailerLoading={trailerLoading}
                trailerUrl={trailerUrl}
                trailerVideoId={trailerVideoId}
                setTrailerUrl={setTrailerUrl}
                handleTrailerSubmit={handleTrailerSubmit}
                handleTrailerDelete={handleTrailerDelete}
                t={t}
                tProject={tProject}
            />

            {editModalOpen && selectedImage && (
                <GalleryEditModal
                    isOpen={editModalOpen}
                    onRequestClose={closeEditModal}
                    editLoading={editLoading}
                    editStep={editStep}
                    editSteps={GALLERY_STEPS}
                    editSelectedFile={editSelectedFile}
                    isEditDragActive={isEditDragActive}
                    editFileRef={editFileRef}
                    openEditFilePicker={openEditFilePicker}
                    handleEditDragOver={handleEditDragOver}
                    handleEditDragLeave={handleEditDragLeave}
                    handleEditDrop={handleEditDrop}
                    handleEditFileChange={handleEditFileChange}
                    formatFileSize={formatFileSize}
                    goToEditFilesStep={goToEditFilesStep}
                    goToEditMetadataStep={goToEditMetadataStep}
                    handleUpdate={handleUpdate}
                    handleDelete={handleDelete}
                    editFormData={editFormData}
                    handleEditInputChange={handleEditInputChange}
                    toggleEditFeatured={toggleEditFeatured}
                    t={t}
                    tProject={tProject}
                />
            )}
        </>
    );
}