"use client";

import Modal from "react-modal";

if(typeof window !== "undefined") {
	Modal.setAppElement("body");
}

export default function ConfirmModal({ isOpen, title, description, messageTitle, confirmLabel, cancelLabel, isLoading = false, onConfirm, onRequestClose, confirmButtonClassName = "button--type-danger" }) {
	const hasMessage = Boolean(messageTitle);

	return (
		<Modal closeTimeoutMS={150} isOpen={isOpen} onRequestClose={onRequestClose} className={`modal active confirm-modal${hasMessage ? " confirm-modal--message" : ""}`} overlayClassName={`modal-overlay${hasMessage ? " modal-overlay--danger" : ""}`} contentLabel={title}>
			<div className="modal-window">
				<div className="modal-window__header">
					<h2 className="modal-window__title">{title}</h2>

					<button className="icon-button modal-window__close" type="button" onClick={onRequestClose} aria-label={cancelLabel} disabled={isLoading}>
						<svg className="icon icon--cross" height="24" width="24">
							<path fillRule="evenodd" clipRule="evenodd" d="M5.293 5.293a1 1 0 0 1 1.414 0L12 10.586l5.293-5.293a1 1 0 0 1 1.414 1.414L13.414 12l5.293 5.293a1 1 0 0 1-1.414 1.414L12 13.414l-5.293 5.293a1 1 0 0 1-1.414-1.414L10.586 12 5.293 6.707a1 1 0 0 1 0-1.414Z" />
						</svg>
					</button>
				</div>

				<div className="modal-window__content confirm-modal__content">
					{hasMessage ? (
						<div className="confirm-modal__message confirm-modal__message--danger" role="alert">
							<svg className="confirm-modal__message-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
								<circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
								<path d="m9 9 6 6m0-6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
							</svg>

							<div className="confirm-modal__message-copy">
								<h3>{messageTitle}</h3>
								{description ? <p>{description}</p> : null}
							</div>
						</div>
					) : description ? (
						<p className="confirm-modal__description">{description}</p>
					) : null}

					<div className="confirm-modal__actions">
						<button type="button" className={`button button--size-m button--type-minimal${hasMessage ? " button--with-icon" : ""}`} onClick={onRequestClose} disabled={isLoading}>
							{hasMessage ? (
								<svg className="icon" height="20" width="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
									<path d="m7 7 10 10m0-10L7 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
								</svg>
							) : null}

							{cancelLabel}
						</button>

						<button type="button" className={`button button--size-m ${confirmButtonClassName}${hasMessage ? " button--with-icon" : ""}`} onClick={onConfirm} disabled={isLoading}>
							{hasMessage ? (
								<svg className="icon" height="20" width="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
									<path d="M5 12h14m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
								</svg>
							) : null}

							{confirmLabel}
						</button>
					</div>
				</div>
			</div>
		</Modal>
	);
}