"use client";

import Modal from "react-modal";

if(typeof window !== "undefined") {
    Modal.setAppElement("body");
}

export default function ConfirmModal({ isOpen, title, description, confirmLabel, cancelLabel, isLoading = false, onConfirm, onRequestClose, confirmButtonClassName = "button--type-danger" }) {
    return (
        <Modal closeTimeoutMS={150} isOpen={isOpen} onRequestClose={onRequestClose} className="modal active" overlayClassName="modal-overlay">
            <div className="modal-window">
                <div className="modal-window__header">
                    <h2 className="modal-window__title">{title}</h2>

                    <button className="icon-button modal-window__close" type="button" onClick={onRequestClose} aria-label={cancelLabel} disabled={isLoading}>
                        <svg className="icon icon--cross" height="24" width="24">
                            <path fillRule="evenodd" clipRule="evenodd" d="M5.293 5.293a1 1 0 0 1 1.414 0L12 10.586l5.293-5.293a1 1 0 0 1 1.414 1.414L13.414 12l5.293 5.293a1 1 0 0 1-1.414 1.414L12 13.414l-5.293 5.293a1 1 0 0 1-1.414-1.414L10.586 12 5.293 6.707a1 1 0 0 1 0-1.414Z" />
                        </svg>
                    </button>
                </div>

                <div className="modal-window__content">
                    {description ? (
                        <p style={{ marginBottom: "16px" }}>{description}</p>
                    ) : null}

                    <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                        <button type="button" className="button button--size-m button--type-minimal" onClick={onRequestClose} disabled={isLoading}>
                            {cancelLabel}
                        </button>

                        <button type="button" className={`button button--size-m ${confirmButtonClassName}`} onClick={onConfirm} disabled={isLoading}>
                            {confirmLabel}
                        </button>
                    </div>
                </div>
            </div>
        </Modal>
    );
}