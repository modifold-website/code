"use client";

import Modal from "react-modal";
import VersionDependenciesEditor from "./VersionDependenciesEditor";
import GameVersionPopoverList from "@/components/GameVersionPopoverList";

if(typeof window !== "undefined") {
    Modal.setAppElement("body");
}

export default function VersionUploadModal({ isOpen, onRequestClose, uploadLoading, uploadStep, uploadSteps, uploadFile, isUploadDragActive, uploadFileRef, versionFileAccept, openUploadFilePicker, handleUploadDragOver, handleUploadDragLeave, handleUploadDrop, handleUploadFileChange, formatFileSize, goToUploadCompatibilityStep, goToUploadFilesStep, goToUploadMetadataStepBack, handleSubmit, formData, handleInputChange, releaseChannels, handleSelectReleaseChannel, gameVersionsRef, toggleGameVersionsPopover, isGameVersionsPopoverOpen, gameVersions, handleToggleGameVersion, gameVersionsLabel, loadersRef, toggleLoadersPopover, isLoadersPopoverOpen, loaders, handleToggleLoader, loadersLabel, dependencyTypes, uploadDependencyDraft, handleUploadDependencyDraftChange, handleAddUploadDependency, handleRemoveUploadDependency, t, tProject }) {
    const isFilesStep = uploadStep === uploadSteps.FILES;
    const isMetadataStep = uploadStep === uploadSteps.METADATA;
    const isCompatibilityStep = uploadStep === uploadSteps.COMPATIBILITY;

    const dropzoneClassName = `version-upload-dropzone ${isUploadDragActive || uploadFile ? "version-upload-dropzone--active" : ""} ${uploadFile ? "version-upload-dropzone--selected" : ""}`.trim();

    const handlePickerKeyDown = (event) => {
        if(event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openUploadFilePicker();
        }
    };

    return (
        <Modal closeTimeoutMS={150} isOpen={isOpen} onRequestClose={onRequestClose} className="modal active" overlayClassName="modal-overlay">
            <div className="modal-window version-upload-modal">
                <div className="modal-window__header">
                    <div className="version-upload-steps" aria-label="Upload steps">
                        <button type="button" className={`version-upload-steps__item version-upload-steps__item--button ${isFilesStep ? "is-active" : "is-complete"}`} onClick={goToUploadFilesStep} disabled={uploadLoading} aria-current={isFilesStep ? "step" : undefined}>
                            {t("versions.modal.steps.files")}
                        </button>

                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" className="version-upload-steps__separator" aria-hidden="true">
                            <path d="m9 18 6-6-6-6"></path>
                        </svg>

                        <button type="button" className={`version-upload-steps__item version-upload-steps__item--button ${isMetadataStep ? "is-active" : isCompatibilityStep ? "is-complete" : ""}`} onClick={goToUploadMetadataStepBack} disabled={uploadLoading || !uploadFile} aria-current={isMetadataStep ? "step" : undefined}>
                            {t("versions.modal.steps.metadata")}
                        </button>

                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" className="version-upload-steps__separator" aria-hidden="true">
                            <path d="m9 18 6-6-6-6"></path>
                        </svg>

                        <button type="button" className={`version-upload-steps__item version-upload-steps__item--button ${isCompatibilityStep ? "is-active" : ""}`} onClick={goToUploadCompatibilityStep} disabled={uploadLoading || !uploadFile} aria-current={isCompatibilityStep ? "step" : undefined}>
                            {t("versions.modal.steps.compatibility")}
                        </button>
                    </div>

                    <button className="icon-button modal-window__close" type="button" onClick={onRequestClose} disabled={uploadLoading}>
                        <svg className="icon icon--cross" height="24" width="24">
                            <path fillRule="evenodd" clipRule="evenodd" d="M5.293 5.293a1 1 0 0 1 1.414 0L12 10.586l5.293-5.293a1 1 0 0 1 1.414 1.414L13.414 12l5.293 5.293a1 1 0 0 1-1.414 1.414L12 13.414l-5.293 5.293a1 1 0 0 1-1.414-1.414L10.586 12 5.293 6.707a1 1 0 0 1 0-1.414Z" />
                        </svg>
                    </button>
                </div>

                <div className="version-upload-progress" aria-hidden="true">
                    <div className={`version-upload-progress__bar ${isMetadataStep ? "is-metadata" : ""} ${isCompatibilityStep ? "is-compatibility" : ""}`}></div>
                </div>

                <div className="modal-window__content">
                    <form onSubmit={handleSubmit}>
                        <input
                            ref={uploadFileRef}
                            type="file"
                            name="file"
                            accept={versionFileAccept}
                            className="version-upload-dropzone__input"
                            onChange={handleUploadFileChange}
                            disabled={uploadLoading}
                        />

                        {isFilesStep ? (
                            <>
                                <div className={dropzoneClassName} role="button" tabIndex={0} onClick={openUploadFilePicker} onKeyDown={handlePickerKeyDown} onDragOver={handleUploadDragOver} onDragLeave={handleUploadDragLeave} onDrop={handleUploadDrop} aria-label={tProject("file")}>
                                    <div className="version-upload-dropzone__icon" aria-hidden="true">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                                            <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2ZM12 10v6"></path>
                                            <path d="m9 13 3-3 3 3"></path>
                                        </svg>
                                    </div>

                                    <div className="version-upload-dropzone__text">
                                        {uploadFile ? (
                                            <>
                                                <strong>{uploadFile.name}</strong>
                                                <span>{formatFileSize(uploadFile.size)}</span>
                                            </>
                                        ) : (
                                            <>
                                                <strong>{t("versions.modal.dropzone.uploadTitle")}</strong>
                                                <span>{t("versions.modal.dropzone.uploadHint")}</span>
                                            </>
                                        )}
                                    </div>
                                </div>

                                {uploadFile && (
                                    <div className="version-upload-actions">
                                        <button type="button" className="button button--size-m button--type-primary" onClick={goToUploadMetadataStepBack} disabled={uploadLoading}>
                                            {t("versions.modal.actions.continue")}
                                        </button>
                                    </div>
                                )}
                            </>
                        ) : isMetadataStep ? (
                            <>
                                <p className="blog-settings__field-title" style={{ marginTop: "0" }}>{t("versions.fields.versionNumber")}</p>
                                <div className="field field--default">
                                    <label className="field__wrapper">
                                        <input
                                            type="text"
                                            name="version_number"
                                            value={formData.version_number}
                                            onChange={handleInputChange}
                                            placeholder={t("versions.placeholders.versionNumber")}
                                            className="text-input"
                                            required
                                            disabled={uploadLoading}
                                        />
                                    </label>
                                </div>

                                <p className="blog-settings__field-title">{t("versions.fields.changelog")}</p>
                                <div className="field field--default textarea">
                                    <label className="field__wrapper">
                                        <textarea
                                            name="changelog"
                                            value={formData.changelog}
                                            onChange={handleInputChange}
                                            placeholder={t("versions.placeholders.changelog")}
                                            className="autosize textarea__input"
                                            style={{ height: "200px" }}
                                            disabled={uploadLoading}
                                        />
                                    </label>
                                </div>

                                <p className="blog-settings__field-title">{t("versions.fields.releaseChannel")}</p>
                                <div className="version-release-channel-picker" role="group" aria-label={t("versions.fields.releaseChannel")}>
                                    {releaseChannels.map((channel) => {
                                        const isActive = formData.release_channel === channel;

                                        return (
                                            <button key={channel} type="button" className={`version-release-channel-picker__option ${isActive ? "is-active" : ""}`} onClick={() => handleSelectReleaseChannel(channel)} disabled={uploadLoading} aria-pressed={isActive}>
                                                <svg className="version-release-channel-picker__check" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                                    <path d="M20 6 9 17l-5-5" />
                                                </svg>
                                                
                                                {t(`versions.releaseChannels.${channel}`)}
                                            </button>
                                        );
                                    })}
                                </div>

                                <div className="version-upload-actions">
                                    <button type="button" className="button button--size-m button--type-minimal button--with-icon" onClick={goToUploadFilesStep} disabled={uploadLoading}>
                                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                                            <path d="m12 19-7-7 7-7M19 12H5"></path>
                                        </svg>
                                        
                                        {t("versions.modal.actions.back")}
                                    </button>

                                    <button type="button" className="button button--size-m button--type-primary" onClick={goToUploadCompatibilityStep} disabled={uploadLoading || !uploadFile}>
                                        {t("versions.modal.actions.continue")}
                                    </button>
                                </div>
                            </>
                        ) : isCompatibilityStep ? (
                            <>
                                <p className="blog-settings__field-title" style={{ marginTop: "0" }}>{t("versions.fields.gameVersions")}</p>
                                <div className="field field--default" ref={gameVersionsRef}>
                                    <label className="field__wrapper" onClick={!uploadLoading ? toggleGameVersionsPopover : undefined} style={{ cursor: "pointer" }}>
                                        <div className="field__wrapper-body">
                                            <div className="select">
                                                <div className="select__selected">{gameVersionsLabel}</div>
                                            </div>
                                        </div>
                                    </label>

                                    {isGameVersionsPopoverOpen && !uploadLoading && (
                                        <div className="popover">
                                            <div className="context-list" data-scrollable style={{ maxHeight: "200px", overflowY: "auto" }}>
                                                <GameVersionPopoverList
                                                    gameVersions={gameVersions}
                                                    selectedVersions={formData.game_versions}
                                                    onToggleVersion={handleToggleGameVersion}
                                                    releaseLabel={t("versions.gameVersionGroups.releases")}
                                                    preReleaseLabel={t("versions.gameVersionGroups.preReleases")}
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <p className="blog-settings__field-title">{t("versions.fields.loaders")}</p>
                                <div className="field field--default" ref={loadersRef}>
                                    <label className="field__wrapper" onClick={!uploadLoading ? toggleLoadersPopover : undefined}>
                                        <div className="field__wrapper-body">
                                            <div className="select">
                                                <div className="select__selected">{loadersLabel}</div>
                                            </div>
                                        </div>
                                    </label>

                                    {isLoadersPopoverOpen && !uploadLoading && (
                                        <div className="popover">
                                            <div className="context-list" data-scrollable style={{ maxHeight: "200px", overflowY: "auto" }}>
                                                {loaders.map((loader) => (
                                                    <div
                                                        key={loader}
                                                        className={`context-list-option ${formData.loaders.includes(loader) ? "context-list-option--selected" : ""}`}
                                                        style={{ "--press-duration": "140ms" }}
                                                        onClick={() => {
                                                            handleToggleLoader(loader);
                                                            toggleLoadersPopover();
                                                        }}
                                                    >
                                                        <div className="context-list-option__label">{loader}</div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div style={{ marginTop: "0" }}>
                                    <VersionDependenciesEditor
                                        dependencies={formData.dependencies}
                                        dependencyDraft={uploadDependencyDraft}
                                        dependencyTypes={dependencyTypes}
                                        onDraftChange={handleUploadDependencyDraftChange}
                                        onAddDependency={handleAddUploadDependency}
                                        onRemoveDependency={handleRemoveUploadDependency}
                                        disabled={uploadLoading}
                                    />
                                </div>

                                <div className="version-upload-actions">
                                    <button type="button" className="button button--size-m button--type-minimal button--with-icon" onClick={goToUploadMetadataStepBack} disabled={uploadLoading}>
                                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                                            <path d="m12 19-7-7 7-7M19 12H5"></path>
                                        </svg>

                                        {t("versions.modal.actions.back")}
                                    </button>

                                    <button type="submit" className="button button--size-m button--type-primary" disabled={uploadLoading || !uploadFile}>
                                        {uploadLoading ? t("versions.modal.actions.uploading") : t("versions.actions.upload")}
                                    </button>
                                </div>
                            </>
                        ) : null}
                    </form>
                </div>
            </div>
        </Modal>
    );
}