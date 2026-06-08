"use client";

import Modal from "react-modal";

if(typeof window !== "undefined") {
    Modal.setAppElement("body");
}

export default function GalleryEditModal({ isOpen, onRequestClose, editLoading, editStep, editSteps, editSelectedFile, isEditDragActive, editFileRef, openEditFilePicker, handleEditDragOver, handleEditDragLeave, handleEditDrop, handleEditFileChange, formatFileSize, goToEditFilesStep, goToEditMetadataStep, handleUpdate, handleDelete, editFormData, handleEditInputChange, toggleEditFeatured, t, tProject }) {
    const isFilesStep = editStep === editSteps.FILES;
    const isMetadataStep = editStep === editSteps.METADATA;

    const dropzoneClassName = `version-upload-dropzone ${isEditDragActive || editSelectedFile ? "version-upload-dropzone--active" : ""}`.trim();

    const handlePickerKeyDown = (event) => {
        if(event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openEditFilePicker();
        }
    };

    return (
        <Modal closeTimeoutMS={150} isOpen={isOpen} onRequestClose={onRequestClose} className="modal active" overlayClassName="modal-overlay">
            <div className="modal-window version-upload-modal">
                <div className="modal-window__header">
                    <div className="version-upload-steps" aria-label="Gallery edit steps">
                        <button type="button" className={`version-upload-steps__item version-upload-steps__item--button ${isFilesStep ? "is-active" : "is-complete"}`} onClick={goToEditFilesStep} disabled={editLoading} aria-current={isFilesStep ? "step" : undefined}>
                            {t("gallerySettings.modal.steps.files")}
                        </button>

                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" className="version-upload-steps__separator" aria-hidden="true">
                            <path d="m9 18 6-6-6-6"></path>
                        </svg>

                        <button type="button" className={`version-upload-steps__item version-upload-steps__item--button ${isMetadataStep ? "is-active" : ""}`} onClick={goToEditMetadataStep} disabled={editLoading} aria-current={isMetadataStep ? "step" : undefined}>
                            {t("gallerySettings.modal.steps.metadata")}
                        </button>
                    </div>

                    <button className="icon-button modal-window__close" type="button" onClick={onRequestClose} disabled={editLoading}>
                        <svg className="icon icon--cross" height="24" width="24">
                            <path fillRule="evenodd" clipRule="evenodd" d="M5.293 5.293a1 1 0 0 1 1.414 0L12 10.586l5.293-5.293a1 1 0 0 1 1.414 1.414L13.414 12l5.293 5.293a1 1 0 0 1-1.414 1.414L12 13.414l-5.293 5.293a1 1 0 0 1-1.414-1.414L10.586 12 5.293 6.707a1 1 0 0 1 0-1.414Z" />
                        </svg>
                    </button>
                </div>

                <div className="version-upload-progress" aria-hidden="true">
                    <div className={`version-upload-progress__bar is-two-steps ${isMetadataStep ? "is-final" : ""}`}></div>
                </div>

                <div className="modal-window__content">
                    <form onSubmit={handleUpdate}>
                        <input
                            ref={editFileRef}
                            type="file"
                            accept="image/*"
                            className="version-upload-dropzone__input"
                            onChange={handleEditFileChange}
                            disabled={editLoading}
                        />

                        {isFilesStep ? (
                            <>
                                <div className={dropzoneClassName} role="button" tabIndex={0} onClick={openEditFilePicker} onKeyDown={handlePickerKeyDown} onDragOver={handleEditDragOver} onDragLeave={handleEditDragLeave} onDrop={handleEditDrop} aria-label={tProject("gallery.image")}>
                                    <div className="version-upload-dropzone__icon" aria-hidden="true">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                                            <rect width="18" height="18" x="3" y="3" rx="2" ry="2"></rect>
                                            <circle cx="9" cy="9" r="2"></circle>
                                            <path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"></path>
                                        </svg>
                                    </div>

                                    <div className="version-upload-dropzone__text">
                                        {editSelectedFile ? (
                                            <>
                                                <strong>{editSelectedFile.name}</strong>
                                                <span>{formatFileSize(editSelectedFile.size)}</span>
                                            </>
                                        ) : (
                                            <>
                                                <strong>{t("gallerySettings.modal.dropzone.replaceTitle")}</strong>
                                                <span>{t("gallerySettings.modal.dropzone.replaceHint")}</span>
                                            </>
                                        )}
                                    </div>
                                </div>

                                <div className="version-upload-actions">
                                    <button type="button" className="button button--size-m button--type-primary" onClick={goToEditMetadataStep} disabled={editLoading}>
                                        {t("gallerySettings.modal.actions.continue")}
                                    </button>
                                </div>
                            </>
                        ) : (
                            <>
                                <p className="blog-settings__field-title" style={{ marginTop: "0" }}>{tProject("gallery.title")}</p>
                                <div className="field field--default">
                                    <label className="field__wrapper">
                                        <input type="text" name="title" value={editFormData.title} className="text-input" disabled={editLoading} onChange={handleEditInputChange} />
                                    </label>
                                </div>

                                <p className="blog-settings__field-title">{tProject("gallery.description")}</p>
                                <div className="field field--default textarea">
                                    <label className="field__wrapper">
                                        <textarea name="description" value={editFormData.description} className="autosize textarea__input" style={{ height: "110px" }} disabled={editLoading} onChange={handleEditInputChange} />
                                    </label>
                                </div>

                                <p className="blog-settings__field-title">{tProject("gallery.orderIndex")}</p>
                                <div className="field field--default">
                                    <label className="field__wrapper">
                                        <input type="number" name="ordering" value={editFormData.ordering} className="text-input" disabled={editLoading} onChange={handleEditInputChange} />
                                    </label>
                                </div>

                                <p className="blog-settings__field-title">{tProject("gallery.featured")}</p>

                                <button type="button" className="button button--size-m button--type-minimal" aria-pressed={editFormData.featured} onClick={toggleEditFeatured} disabled={editLoading}>
                                    {editFormData.featured ? t("gallerySettings.states.enabled") : t("gallerySettings.states.disabled")}
                                </button>

                                <p className="gallery-modal-help">{t("gallerySettings.featuredHint")}</p>

                                <div className="version-upload-actions">
                                    <button type="button" className="button button--size-m button--type-minimal button--with-icon" onClick={goToEditFilesStep} disabled={editLoading}>
                                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                                            <path d="m12 19-7-7 7-7M19 12H5"></path>
                                        </svg>

                                        {t("gallerySettings.modal.actions.back")}
                                    </button>

                                    <button type="button" className="button button--size-m button--type-negative" onClick={handleDelete} disabled={editLoading}>
                                        {tProject("delete")}
                                    </button>

                                    <button type="submit" className="button button--size-m button--type-primary" disabled={editLoading}>
                                        {editLoading ? tProject("updating") : tProject("update")}
                                    </button>
                                </div>
                            </>
                        )}
                    </form>
                </div>
            </div>
        </Modal>
    );
}