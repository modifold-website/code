"use client";

import React, { useState, useEffect } from "react";
import Modal from "react-modal";
import { toast } from "react-toastify";
import { useAuth } from "../providers/AuthProvider";
import { useTranslations, useLocale } from "next-intl";
import ImageLightbox, { useImageLightbox } from "../ui/ImageLightbox";
import ProjectSidebar from "../project/ProjectSidebar";

Modal.setAppElement("body");

export default function GalleryPage({ project, authToken }) {
    const t = useTranslations("ProjectPage");
    const tSettings = useTranslations("SettingsProjectPage");
    const locale = useLocale();
    const { user } = useAuth();
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [selectedImage, setSelectedImage] = useState(null);
    const [galleryImages, setGalleryImages] = useState(Array.isArray(project?.gallery) ? project.gallery : []);
    const [editLoading, setEditLoading] = useState(false);
    const [editFormData, setEditFormData] = useState({
        title: "",
        description: "",
        ordering: 0,
        featured: false,
    });

    const { lightboxOpen, lightboxImage, closeLightbox, getLightboxTriggerProps } = useImageLightbox();

    const openEditModal = (image) => {
        setSelectedImage(image);
        setEditFormData({
            title: image?.title || "",
            description: image?.description || "",
            ordering: image?.ordering ?? 0,
            featured: false,
        });
        setEditModalOpen(true);
    };

    const closeEditModal = () => {
        setEditModalOpen(false);
        setSelectedImage(null);
        setEditLoading(false);
    };

    useEffect(() => {
        setGalleryImages(Array.isArray(project?.gallery) ? project.gallery : []);
    }, [project?.gallery]);

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
    };

    const handleUpdate = async (e) => {
        e.preventDefault();
        if(!selectedImage) {
            return;
        }

        setEditLoading(true);

        const formDataToSend = new FormData();
        formDataToSend.append("title", editFormData.title);
        formDataToSend.append("description", editFormData.description);
        formDataToSend.append("ordering", editFormData.ordering);
        formDataToSend.append("featured", editFormData.featured);

        try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE}/projects/${project.slug}/gallery/${selectedImage.id}`, {
                method: "PUT",
                headers: { Authorization: `Bearer ${authToken}` },
                body: formDataToSend,
            });

            if(response.ok) {
                toast.success(t("gallery.updateSuccess"));
                closeEditModal();
                await refreshGallery();
            } else {
                toast.error(t("gallery.updateError"));
            }
        } catch {
            toast.error(t("gallery.updateError"));
        } finally {
            setEditLoading(false);
        }
    };

    const handleDelete = async (galleryId) => {
        if(confirm(t("gallery.deleteConfirm"))) {
            try {
                const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE}/projects/${project.slug}/gallery/${galleryId}`, {
                    method: "DELETE",
                    headers: { Authorization: `Bearer ${authToken}` },
                });

                if(response.ok) {
                    toast.success(t("gallery.deleteSuccess"));
                    if(editModalOpen) {
                        closeEditModal();
                    }

                    await refreshGallery();
                } else {
                    toast.error(t("gallery.deleteError"));
                }
            } catch {
                toast.error(t("gallery.deleteError"));
            }
        }
    };

    const handleDeleteById = async (galleryId) => {
        await handleDelete(galleryId);
    };

    const formatDate = (dateValue) => {
        if(!dateValue) {
            return "";
        }

        try {
            return new Intl.DateTimeFormat(locale || undefined, {
                year: "numeric",
                month: "long",
                day: "numeric",
            }).format(new Date(dateValue));
        } catch {
            return String(dateValue);
        }
    };

    return (
        <>
            <div className="project__general">
                <div>
                    {galleryImages.length === 0 ? (
                        <p style={{ color: "var(--theme-color-text-secondary)" }}>{t("gallery.noImages")}</p>
                    ) : (
                        <div className="gallery-settings-grid">
                            {galleryImages.map((image) => (
                                <div key={image.id} className="gallery-settings-card">
                                    <div className="gallery-settings-card__preview" aria-label={t("gallery.viewImage", { title: image.title || t("gallery.image") })} {...getLightboxTriggerProps(image)}>
                                        <img src={image.url} alt={image.title || t("gallery.image")} style={{ cursor: "pointer" }} className="gallery-settings-card__image" loading={Boolean(Number(image?.featured)) ? "eager" : "lazy"} />
                                    </div>

                                    <div className="gallery-settings-card__body">
                                        {(image.title || image.description) &&
                                            <div className="gallery-settings-card__info">
                                                {image.title && <h2>{image.title}</h2>}

                                                {image.description && <p>{image.description}</p>}
                                            </div>
                                        }

                                        <div className="gallery-settings-card__date">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M8 2v4" />
                                                <path d="M16 2v4" />
                                                <rect width="18" height="18" x="3" y="4" rx="2" />
                                                <path d="M3 10h18" />
                                            </svg>

                                            {formatDate(image.created_at)}
                                        </div>

                                        {user && project.user_id === user.id && (
                                            <div className="gallery-settings-card__actions">
                                                <button type="button" className="button button--size-m button--type-minimal" onClick={() => openEditModal(image)}>{t("gallery.editImage")}</button>
                                                <button type="button" className="button button--size-m button--type-minimal" onClick={() => handleDeleteById(image.id)}>{t("delete")}</button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    <ImageLightbox isOpen={lightboxOpen} image={lightboxImage} onClose={closeLightbox} dialogLabel={t("gallery.lightboxLabel")} closeLabel={t("close")} openInNewTabLabel={t("gallery.openInNewTab")} fallbackAlt={t("gallery.image")} />

                    {editModalOpen && selectedImage && (
                        <Modal closeTimeoutMS={150} isOpen={editModalOpen} onRequestClose={closeEditModal} className="modal active" overlayClassName="modal-overlay">
                            <div className="modal-window">
                                <div className="modal-window__header">
                                    <span>{t("gallery.editImage")}</span>
                                    
                                    <button className="icon-button modal-window__close" type="button" onClick={closeEditModal} disabled={editLoading}>
                                        <svg className="icon icon--cross" height="24" width="24">
                                            <path fillRule="evenodd" clipRule="evenodd" d="M5.293 5.293a1 1 0 0 1 1.414 0L12 10.586l5.293-5.293a1 1 0 0 1 1.414 1.414L13.414 12l5.293 5.293a1 1 0 0 1-1.414 1.414L12 13.414l-5.293 5.293a1 1 0 0 1-1.414-1.414L10.586 12 5.293 6.707a1 1 0 0 1 0-1.414Z"></path>
                                        </svg>
                                    </button>
                                </div>

                                <div className="modal-window__content">
                                    <form onSubmit={handleUpdate} className="gallery-modal-form">
                                        <div className="gallery-modal-preview">
                                            <img src={selectedImage.url} alt={editFormData.title || t("gallery.image")} />
                                        </div>

                                        <p className="blog-settings__field-title">{t("gallery.title")}</p>
                                        <div className="field field--default blog-settings__input">
                                            <label className="field__wrapper">
                                                <input type="text" name="title" value={editFormData.title} className="text-input" disabled={editLoading} onChange={(e) => setEditFormData((prev) => ({ ...prev, title: e.target.value }))} />
                                            </label>
                                        </div>

                                        <p className="blog-settings__field-title">{t("gallery.description")}</p>
                                        <div className="field field--default textarea blog-settings__input">
                                            <label className="field__wrapper">
                                                <textarea name="description" value={editFormData.description} className="autosize textarea__input" style={{ height: "100px" }} disabled={editLoading} onChange={(e) => setEditFormData((prev) => ({ ...prev, description: e.target.value }))} />
                                            </label>
                                        </div>

                                        <p className="blog-settings__field-title">{t("gallery.orderIndex")}</p>
                                        <div className="field field--default blog-settings__input">
                                            <label className="field__wrapper">
                                                <input type="number" name="ordering" value={editFormData.ordering} className="text-input" disabled={editLoading} onChange={(e) => setEditFormData((prev) => ({ ...prev, ordering: e.target.value }))} />
                                            </label>
                                        </div>

                                        <p className="blog-settings__field-title">{t("gallery.featured")}</p>
                                        
                                        <button type="button" className="button button--size-m button--type-minimal" aria-pressed={editFormData.featured} onClick={() => setEditFormData((prev) => ({ ...prev, featured: !prev.featured }))} disabled={editLoading}>
                                            {editFormData.featured ? tSettings("gallerySettings.states.enabled") : tSettings("gallerySettings.states.disabled")}
                                        </button>

                                        <p className="gallery-modal-help">{tSettings("gallerySettings.featuredHint")}</p>

                                        <div className="gallery-modal-actions">
                                            <button type="button" className="button button--size-m button--type-minimal" onClick={() => handleDelete(selectedImage.id)} disabled={editLoading}>{t("delete")}</button>
                                            <button type="submit" className="button button--size-m button--type-primary" disabled={editLoading}>{t("update")}</button>
                                        </div>
                                    </form>
                                </div>
                            </div>
                        </Modal>
                    )}
                </div>

                <ProjectSidebar project={project} showLinks={true} showLicense={true} />
            </div>
        </>
    );
}