"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "react-toastify";
import { PasswordField } from "./EmailAuthFields";
import { EmailLoginAuth } from "@/modal/LoginModal";
import PasswordRecoveryModal from "@/modal/PasswordRecoveryModal";
import { passwordRecoveryRequest } from "@/utils/auth/passwordRecovery";

export default function PasswordRecoveryPage() {
	const t = useTranslations("PasswordRecovery");
	const authT = useTranslations("LoginModal.emailAuth");
	const router = useRouter();
	const [token, setToken] = useState(null);
	const [password, setPassword] = useState("");
	const [confirmation, setConfirmation] = useState("");
	const [visible, setVisible] = useState(false);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	const [email, setEmail] = useState(null);
	const [requestOpen, setRequestOpen] = useState(false);

	useEffect(() => {
		let active = true;
		const value = new URLSearchParams(window.location.hash.slice(1)).get("token") || "";
		if(!/^[a-f0-9]{64}$/.test(value)) {
			setToken("");
			setError("invalid_link");
			return;
		}
		
		passwordRecoveryRequest("validate", { token: value }).then(() => {
			if(active) setToken(value);
		}).catch((error) => {
			if(active) {
				setToken(value);
				setError(error.message);
			}
		});

		return () => { active = false; };
	}, []);

	const submit = async (event) => {
		event.preventDefault();
		if(busy) return;
		if(password !== confirmation) return setError("password_mismatch");
		if(password.length < 8) return setError("invalid_password");
		if(new TextEncoder().encode(password).length > 72) return setError("password_too_long");
		setBusy(true);
		setError("");

		try {
			const data = await passwordRecoveryRequest("confirm", { token, password, confirmPassword: confirmation });
			window.history.replaceState(null, "", window.location.pathname);
			setPassword("");
			setConfirmation("");
			setToken("");
			setEmail(data.email);
			toast.success(t("success"));
		} catch(error) {
			setError(error.message);
		} finally {
			setBusy(false);
		}
	};

	if(email !== null) return <EmailLoginAuth isOpen initialEmail={email} onClose={() => router.replace("/")} onBack={() => router.replace("/")} />;

	return (
		<div className="password-recovery-page">
			<div className="auth password-recovery">
				<h1 className="email-auth__title">{t("resetTitle")}</h1>
				
				{token === null ? <p role="status">{authT("submitting")}</p> : error === "invalid_link" ? <>
					<p className="email-auth__description" role="alert">{t(error)}</p>

					<button className="button button--size-xl button--type-primary" type="button" onClick={() => setRequestOpen(true)}>
						{t("requestButton")}
					</button>
				</> : <>
					<p className="email-auth__description">{t("resetDescription")}</p>
					
					<form className="email-auth__form" onSubmit={submit} aria-busy={busy}>
						<PasswordField autoComplete="new-password" name="password" placeholder={t("newPassword")} value={password} onChange={(event) => setPassword(event.target.value)} showPassword={visible} onToggle={() => setVisible((value) => !value)} t={authT} />
						
						<PasswordField autoComplete="new-password" name="confirmPassword" placeholder={t("confirmPassword")} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} showPassword={visible} onToggle={() => setVisible((value) => !value)} t={authT} />
						
						{error && <p className="email-auth__status" role="alert">{t(error)}</p>}
						
						<button className="button button--size-xl button--type-primary" type="submit" disabled={busy}>
							{busy ? authT("submitting") : t("saveButton")}
						</button>
					</form>
				</>}
			</div>

			<PasswordRecoveryModal isOpen={requestOpen} onClose={() => setRequestOpen(false)} onBack={() => setEmail("")} />
		</div>
	);
}