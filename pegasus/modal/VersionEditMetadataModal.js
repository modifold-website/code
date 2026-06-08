"use client";

import Modal from "react-modal";
import GameVersionPopoverList from "@/components/GameVersionPopoverList";

if(typeof window !== "undefined") {
    Modal.setAppElement("body");
}

export default function VersionEditMetadataModal({ isOpen, onRequestClose, editLoading, onSubmit, t, tProject, editFormData, editGameVersionsRef, toggleEditGameVersionsPopover, isEditGameVersionsPopoverOpen, gameVersions, handleEditToggleGameVersion, editGameVersionsLabel, editLoadersRef, toggleEditLoadersPopover, isEditLoadersPopoverOpen, loaders, handleEditToggleLoader, editLoadersLabel }) {
    return (
        <Modal closeTimeoutMS={150} isOpen={isOpen} onRequestClose={onRequestClose} className="modal active" overlayClassName="modal-overlay">
            <div className="modal-window version-upload-modal">
                <div className="modal-window__header">
                    <p className="modal-window__title">{t("versions.modal.editMetadataTitle")}</p>

                    <button className="icon-button modal-window__close" type="button" onClick={onRequestClose} disabled={editLoading}>
                        <svg className="icon icon--cross" height="24" width="24">
                            <path fillRule="evenodd" clipRule="evenodd" d="M5.293 5.293a1 1 0 0 1 1.414 0L12 10.586l5.293-5.293a1 1 0 0 1 1.414 1.414L13.414 12l5.293 5.293a1 1 0 0 1-1.414 1.414L12 13.414l-5.293 5.293a1 1 0 0 1-1.414-1.414L10.586 12 5.293 6.707a1 1 0 0 1 0-1.414Z" />
                        </svg>
                    </button>
                </div>

                <div className="modal-window__content">
                    <form onSubmit={onSubmit}>
                        <p className="blog-settings__field-title">{t("versions.fields.gameVersions")}</p>
                        <div className="field field--default" ref={editGameVersionsRef}>
                            <label className="field__wrapper" onClick={!editLoading ? toggleEditGameVersionsPopover : undefined}>
                                <div className="field__wrapper-body">
                                    <div className="select">
                                        <div className="select__selected">{editGameVersionsLabel}</div>
                                    </div>
                                </div>
                            </label>

                            {isEditGameVersionsPopoverOpen && !editLoading && (
                                <div className="popover">
                                    <div className="context-list" data-scrollable style={{ maxHeight: "200px", overflowY: "auto" }}>
                                        <GameVersionPopoverList
                                            gameVersions={gameVersions}
                                            selectedVersions={editFormData.game_versions}
                                            onToggleVersion={handleEditToggleGameVersion}
                                            releaseLabel={t("versions.gameVersionGroups.releases")}
                                            preReleaseLabel={t("versions.gameVersionGroups.preReleases")}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        <p className="blog-settings__field-title">{t("versions.fields.loaders")}</p>
                        <div className="field field--default" ref={editLoadersRef}>
                            <label className="field__wrapper" onClick={!editLoading ? toggleEditLoadersPopover : undefined}>
                                <div className="field__wrapper-body">
                                    <div className="select">
                                        <div className="select__selected">{editLoadersLabel}</div>
                                    </div>
                                </div>
                            </label>

                            {isEditLoadersPopoverOpen && !editLoading && (
                                <div className="popover">
                                    <div className="context-list" data-scrollable style={{ maxHeight: "200px", overflowY: "auto" }}>
                                        {loaders.map((loader) => (
                                            <div key={loader} className={`context-list-option ${editFormData.loaders.includes(loader) ? "context-list-option--selected" : ""}`} style={{ "--press-duration": "140ms" }} onClick={() => handleEditToggleLoader(loader)}>
                                                <div className="context-list-option__label">{loader}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="version-upload-actions">
                            <button type="submit" className="button button--size-m button--type-primary" disabled={editLoading}>
                                {editLoading ? tProject("updating") : tProject("update")}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </Modal>
    );
}