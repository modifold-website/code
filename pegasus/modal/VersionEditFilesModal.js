"use client";

import { useEffect, useRef, useState } from "react";
import Modal from "react-modal";
import { toast } from "react-toastify";

if(typeof window !== "undefined") {
    Modal.setAppElement("body");
}

export default function VersionEditFilesModal({ isOpen, onRequestClose, editLoading, onSubmit, t, tProject, versionFileAccept, maxFileSize, fileTooLargeMessage, currentFileName, formatFileSize }) {
    const [selectedFile, setSelectedFile] = useState(null);
    const [isDragActive, setIsDragActive] = useState(false);
    const fileRef = useRef(null);

    useEffect(() => {
        if(!isOpen) {
            setSelectedFile(null);
            setIsDragActive(false);
            if(fileRef.current) {
                fileRef.current.value = "";
            }
        }
    }, [isOpen]);

    const openFilePicker = () => {
        if(editLoading || !fileRef.current) {
            return;
        }

        fileRef.current.value = "";
        fileRef.current.click();
    };

    const handleFileChange = (event) => {
        const nextFile = event.target.files?.[0] || null;
        if(nextFile && maxFileSize && nextFile.size > maxFileSize) {
            toast.error(fileTooLargeMessage || t("versions.errors.fileTooLarge"));
            if(fileRef.current) {
                fileRef.current.value = "";
            }
            setSelectedFile(null);
            return;
        }

        setSelectedFile(nextFile);
    };

    const handleDragOver = (event) => {
        event.preventDefault();
        event.stopPropagation();
        setIsDragActive(true);
    };

    const handleDragLeave = (event) => {
        event.preventDefault();
        event.stopPropagation();
        if(event.currentTarget.contains(event.relatedTarget)) {
            return;
        }

        setIsDragActive(false);
    };

    const handleDrop = (event) => {
        event.preventDefault();
        event.stopPropagation();
        setIsDragActive(false);

        const nextFile = event.dataTransfer?.files?.[0] || null;
        if(!nextFile) {
            return;
        }

        if(maxFileSize && nextFile.size > maxFileSize) {
            toast.error(fileTooLargeMessage || t("versions.errors.fileTooLarge"));
            return;
        }

        setSelectedFile(nextFile);

        const dt = new DataTransfer();
        dt.items.add(nextFile);

        if(fileRef.current) {
            fileRef.current.files = dt.files;
        }
    };

    const handlePickerKeyDown = (event) => {
        if(event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openFilePicker();
        }
    };

    const dropzoneClassName = `version-upload-dropzone ${isDragActive || selectedFile ? "version-upload-dropzone--active" : ""}`;

    const submitWithSelectedFile = (event) => {
        if(!selectedFile) {
            event.preventDefault();
            return;
        }

        onSubmit(event, { file: selectedFile });
    };

    return (
        <Modal closeTimeoutMS={150} isOpen={isOpen} onRequestClose={onRequestClose} className="modal active" overlayClassName="modal-overlay">
            <div className="modal-window version-upload-modal">
                <div className="modal-window__header">
                    <p className="modal-window__title">{t("versions.modal.editFilesTitle")}</p>

                    <button className="icon-button modal-window__close" type="button" onClick={onRequestClose} disabled={editLoading}>
                        <svg className="icon icon--cross" height="24" width="24">
                            <path fillRule="evenodd" clipRule="evenodd" d="M5.293 5.293a1 1 0 0 1 1.414 0L12 10.586l5.293-5.293a1 1 0 0 1 1.414 1.414L13.414 12l5.293 5.293a1 1 0 0 1-1.414 1.414L12 13.414l-5.293 5.293a1 1 0 0 1-1.414-1.414L10.586 12 5.293 6.707a1 1 0 0 1 0-1.414Z" />
                        </svg>
                    </button>
                </div>

                <div className="modal-window__content">
                    <form onSubmit={submitWithSelectedFile}>
                        <input
                            ref={fileRef}
                            type="file"
                            name="file"
                            accept={versionFileAccept}
                            className="version-upload-dropzone__input"
                            onChange={handleFileChange}
                            disabled={editLoading}
                        />

                        <p className="blog-settings__field-title" style={{ marginTop: "0" }}>{tProject("file")}</p>
                        <div className="version-edit-file-card">
                            <div className="svg-green">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
                                    <path d="M20 6 9 17l-5-5"></path>
                                </svg>
                            </div>
                            
                            <span>{currentFileName || tProject("versions.notSpecified")}</span>
                        </div>

                        <p className="blog-settings__field-title">{t("versions.modal.dropzone.replaceTitle")}</p>
                        <div className={dropzoneClassName} role="button" tabIndex={0} onClick={openFilePicker} onKeyDown={handlePickerKeyDown} onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop} aria-label={tProject("file")}>
                            <div className="version-upload-dropzone__icon" aria-hidden="true">
                                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
                                    <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"></path>
                                    <path d="M12 10v6"></path>
                                    <path d="m9 13 3-3 3 3"></path>
                                </svg>
                            </div>

                            <div className="version-upload-dropzone__text">
                                {selectedFile ? (
                                    <>
                                        <strong>{selectedFile.name}</strong>
                                        <span>{formatFileSize(selectedFile.size)}</span>
                                    </>
                                ) : (
                                    <>
                                        <strong>{t("versions.modal.dropzone.replaceTitle")}</strong>
                                        <span>{t("versions.modal.dropzone.replaceHint")}</span>
                                    </>
                                )}
                            </div>
                        </div>

                        <div className="version-upload-actions">
                            <button type="submit" className="button button--size-m button--type-primary" disabled={editLoading || !selectedFile}>
                                {editLoading ? tProject("updating") : tProject("update")}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </Modal>
    );
}