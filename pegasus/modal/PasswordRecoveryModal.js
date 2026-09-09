"use client";

import { useState } from "react";
import Modal from "react-modal";
import { useLocale, useTranslations } from "next-intl";
import { EmailAuthField } from "@/components/auth/EmailAuthFields";
import { passwordRecoveryRequest } from "@/utils/auth/passwordRecovery";

export default function PasswordRecoveryModal({ isOpen, onClose, onBack = onClose, initialEmail = "" }) {
	const t = useTranslations("PasswordRecovery");
	const authT = useTranslations("LoginModal.emailAuth");
	const locale = useLocale();
	const [email, setEmail] = useState(initialEmail);
	const [sent, setSent] = useState(false);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	const [retryAt, setRetryAt] = useState(0);

	const submit = async (event) => {
		event.preventDefault();
		if(busy) return;
		if(Date.now() < retryAt) {
			setError("rate_limited");
			return;
		}
		
		setBusy(true);
		setError("");

		try {
			await passwordRecoveryRequest("request", { email, locale });
			setRetryAt(Date.now() + 60000);
			setSent(true);
		} catch(error) {
			setError(error.message);
		} finally {
			setBusy(false);
		}
	};

	return (
		<Modal appElement={typeof document !== "undefined" ? document.getElementById("app") : undefined} aria={{ modal: true }} isOpen={isOpen} onRequestClose={onClose} className="modal active" overlayClassName="modal-overlay" contentLabel={t("title")}>
			<div className="modal-window">
				<div className="modal-window__header">
					<button className="icon-button modal-window__close" type="button" onClick={onClose} aria-label={authT("close")}>
						<svg className="icon" width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
							<path d="m6 5 6 6 6-6 1 1-6 6 6 6-1 1-6-6-6 6-1-1 6-6-6-6Z" />
						</svg>
					</button>
				</div>

				<div className="modal-window__content">
					<div className="auth email-auth password-recovery">
						<h2 className="email-auth__title">{t(sent ? "sentTitle" : "title")}</h2>
						<p className="email-auth__description" role={sent ? "status" : undefined}>{t(sent ? "sentDescription" : "description")}</p>
						
						{!sent && <form className="email-auth__form" onSubmit={submit} aria-busy={busy}>
							<EmailAuthField>
								<input className="text-input" name="email" type="email" autoComplete="email" aria-label={authT("emailPlaceholder")} placeholder={authT("emailPlaceholder")} maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} required disabled={busy} />
							</EmailAuthField>

							<button className="button button--size-xl button--type-primary" type="submit" disabled={busy}>
								{busy ? authT("submitting") : t("requestButton")}
							</button>
						</form>}

						{error && <p className="email-auth__status" role="alert">{t(error)}</p>}
						
						<div className="auth__footer email-auth__footer">
							{sent && <button className="link-button link-button--default" type="button" onClick={() => { setSent(false); setError(""); }}>{t("sendAgain")}</button>}
							
							<button className="link-button link-button--default" type="button" onClick={onBack}>
								{authT("backToLogin")}
							</button>
						</div>
					</div>
				</div>
			</div>
		</Modal>
	);
}