"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import Modal from "react-modal";
import UserName from "@/components/ui/UserName";

function UserSummary({ user, outcome }) {
	return (
		<div className="ownership-transfer-modal__person">
			<img src={user?.avatar || "https://cdn.modifold.com/static/no-project-icon.svg"} alt="" />

			<div>
				<span className="ownership-transfer-modal__person-name"><UserName user={user || {}} /></span>
				<span className="ownership-transfer-modal__person-handle">@{user?.slug || user?.username}</span>
			</div>

			<small>{outcome}</small>
		</div>
	);
}

export default function OwnershipTransferModal({ isOpen, resourceTitle, translationNamespace, owner, newOwner, twoFactorEnabled = false, isLoading = false, errorMessage = "", onClearError, onConfirm, onRequestClose }) {
	const t = useTranslations(translationNamespace);
	const appElement = typeof document !== "undefined" ? document.getElementById("app") : undefined;
	const [step, setStep] = useState(1);
	const [confirmation, setConfirmation] = useState("");
	const [twoFactorCode, setTwoFactorCode] = useState("");
	const contentRef = useRef(null);
	const confirmationInputRef = useRef(null);
	const confirmationHandle = String(newOwner?.slug || newOwner?.username || "");
	const canSubmit = confirmation === confirmationHandle && (!twoFactorEnabled || /^\d{6}$/.test(twoFactorCode));

	useEffect(() => {
		if(isOpen) {
			setStep(1);
			setConfirmation("");
			setTwoFactorCode("");
		}
	}, [newOwner?.user_id, isOpen]);

	useEffect(() => {
		if(isOpen && step === 2) confirmationInputRef.current?.focus({ preventScroll: true });
	}, [isOpen, step]);

	const close = () => {
		if(!isLoading) onRequestClose();
	};

	const submit = (event) => {
		event.preventDefault();
		if(!canSubmit || isLoading) return;
		onConfirm({
			confirmation,
			twoFactorCode: twoFactorEnabled ? twoFactorCode : "",
		});
	};

	const changeConfirmation = (event) => {
		setConfirmation(event.target.value);
		if(errorMessage) onClearError?.();
	};

	const changeTwoFactorCode = (event) => {
		setTwoFactorCode(event.target.value.replace(/\D/g, "").slice(0, 6));
		if(errorMessage) onClearError?.();
	};

	const changeStep = (nextStep) => {
		contentRef.current?.scrollTo({ top: 0 });
		setStep(nextStep);
	};

	return (
		<Modal appElement={appElement} closeTimeoutMS={150} isOpen={isOpen} onRequestClose={close} shouldCloseOnOverlayClick={!isLoading} shouldCloseOnEsc={!isLoading} className="modal active ownership-transfer-modal" overlayClassName="modal-overlay modal-overlay--danger" contentLabel={t("title")}>
			<div className="modal-window">
				<div className="modal-window__header ownership-transfer-modal__header">
					<h2 className="modal-window__title">{t("title")}</h2>

					<button className="icon-button modal-window__close" type="button" onClick={close} aria-label={t("close")} disabled={isLoading}>
						<svg className="icon icon--cross" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
							<path d="M18 6 6 18" />
							<path d="m6 6 12 12" />
						</svg>
					</button>
				</div>

				<div ref={contentRef} className="modal-window__content ownership-transfer-modal__content">
					<div className="ownership-transfer-modal__pages" data-page={step}>
						<section className="ownership-transfer-modal__page" data-page-id="1" aria-hidden={step !== 1} inert={step !== 1}>
							<p className="ownership-transfer-modal__intro">{t("reviewDescription", { project: resourceTitle, organization: resourceTitle })}</p>

							<div className="ownership-transfer-modal__people">
								<UserSummary user={newOwner} outcome={t("becomesOwner")} />

								<UserSummary user={owner} outcome={t("becomesMaintainer")} />
							</div>

							<div className="confirm-modal__message confirm-modal__message--danger" role="alert">
								<svg className="confirm-modal__message-icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
									<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
									<path d="M12 8v4" />
									<path d="M12 16h.01" />
								</svg>

								<div className="confirm-modal__message-copy">
									<h3>{t("noticeTitle")}</h3>

									<p>{t("noticeDescription")}</p>
								</div>
							</div>

							<div className="confirm-modal__actions">
								<button type="button" className="button button--size-m button--type-minimal" onClick={close}>
									{t("cancel")}
								</button>

								<button type="button" className="button button--size-m button--type-primary ownership-transfer-modal__continue" onClick={() => changeStep(2)}>
									{t("continue")}

									<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
										<path d="M5 12h14" />
										<path d="m13 6 6 6-6 6" />
									</svg>
								</button>
							</div>
						</section>

						<form className="ownership-transfer-modal__page" data-page-id="2" aria-hidden={step !== 2} inert={step !== 2} onSubmit={submit}>
							<p className="confirm-modal__description">{t("verifyDescription")}</p>

							<div className="ownership-transfer-modal__field">
								<label className="blog-settings__field-title" htmlFor="ownership-transfer-confirmation">{t("confirmationLabel", { handle: confirmationHandle })}</label>

								<div className="field field--default">
									<label className="field__wrapper">
										<input ref={confirmationInputRef} id="ownership-transfer-confirmation" className="text-input" type="text" autoComplete="off" spellCheck="false" value={confirmation} onChange={changeConfirmation} placeholder={confirmationHandle} />
									</label>
								</div>

								<p>{t("confirmationHint")}</p>
							</div>

							{twoFactorEnabled ? (
								<div className="ownership-transfer-modal__field">
									<label className="blog-settings__field-title" htmlFor="ownership-transfer-2fa">{t("twoFactorLabel")}</label>

									<div className="field field--default">
										<label className="field__wrapper">
											<input id="ownership-transfer-2fa" className="text-input ownership-transfer-modal__code-input" type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={twoFactorCode} onChange={changeTwoFactorCode} placeholder="000 000" />
										</label>
									</div>
								</div>
							) : null}

							{errorMessage ? <p className="ownership-transfer-modal__error" role="alert">{errorMessage}</p> : null}

							<div className="confirm-modal__actions">
								<button type="button" className="button button--size-m button--type-minimal" onClick={() => changeStep(1)} disabled={isLoading}>
									{t("back")}
								</button>

								<button type="submit" className="button button--size-m button--type-danger" disabled={!canSubmit || isLoading}>
									{isLoading ? t("transferring") : t("confirm")}
								</button>
							</div>
						</form>
					</div>
				</div>
			</div>
		</Modal>
	);
}