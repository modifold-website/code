"use client";

import { useState } from "react";
import Modal from "react-modal";
import { toast } from "react-toastify";
import { useTranslations } from "next-intl";

if(typeof window !== "undefined") {
    Modal.setAppElement("body");
}

function PasswordInput({ autoComplete, name, placeholder, value, onChange, showPassword, onToggle, labelShow, labelHide }) {
    return (
        <div className="field field--default">
            <label className="field__wrapper" style={{ marginBottom: "10px" }}>
                <input className="text-input" name={name} type={showPassword ? "text" : "password"} autoComplete={autoComplete} placeholder={placeholder} minLength={8} value={value} onChange={onChange} required />

                <button className="settings-password-toggle" type="button" onClick={onToggle} aria-label={showPassword ? labelHide : labelShow}>
                    {showPassword ? (
                        <svg className="icon lucide lucide-eye-off-icon lucide-eye-off" xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49" />
                            <path d="M14.084 14.158a3 3 0 0 1-4.242-4.242" />
                            <path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143" />
                            <path d="m2 2 20 20" />
                        </svg>
                    ) : (
                        <svg className="icon" width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                            <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    )}
                </button>
            </label>
        </div>
    );
}

export default function ChangePasswordModal({ isOpen, authToken, onRequestClose }) {
    const t = useTranslations("SettingsBlogPage");
    const [form, setForm] = useState({ currentPassword: "", newPassword: "" });
    const [showCurrentPassword, setShowCurrentPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const getErrorMessage = (code) => {
        const normalizedCode = code || "generic";
        try {
            return t(`passwordChange.errors.${normalizedCode}`);
        } catch {
            return t("passwordChange.errors.generic");
        }
    };

    const resetState = () => {
        setForm({ currentPassword: "", newPassword: "" });
        setShowCurrentPassword(false);
        setShowNewPassword(false);
        setIsSubmitting(false);
    };

    const handleClose = () => {
        resetState();
        onRequestClose();
    };

    const handleChange = (event) => {
        const { name, value } = event.target;
        setForm((current) => ({ ...current, [name]: value }));
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setIsSubmitting(true);

        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE}/auth/password/change`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${authToken}`,
                },
                body: JSON.stringify(form),
            });
            const data = await res.json().catch(() => ({}));

            if(!res.ok || !data?.success) {
                toast.error(getErrorMessage(data?.code));
                return;
            }

            setForm({ currentPassword: "", newPassword: "" });
            setShowCurrentPassword(false);
            setShowNewPassword(false);
            toast.success(t("passwordChange.success"));
            onRequestClose();
        } catch (error) {
            toast.error(t("passwordChange.errors.generic"));
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Modal closeTimeoutMS={150} isOpen={isOpen} onRequestClose={handleClose} className="modal active" overlayClassName="modal-overlay">
            <div className="modal-window">
                <div className="modal-window__header">
                    <h2 className="modal-window__title">{t("passwordChange.title")}</h2>

                    <button className="icon-button modal-window__close" type="button" onClick={handleClose} aria-label={t("twoFactor.close")}>
                        <svg className="icon icon--cross" height="24" width="24">
                            <path fillRule="evenodd" clipRule="evenodd" d="M5.293 5.293a1 1 0 0 1 1.414 0L12 10.586l5.293-5.293a1 1 0 0 1 1.414 1.414L13.414 12l5.293 5.293a1 1 0 0 1-1.414 1.414L12 13.414l-5.293 5.293a1 1 0 0 1-1.414-1.414L10.586 12 5.293 6.707a1 1 0 0 1 0-1.414Z" />
                        </svg>
                    </button>
                </div>

                <div className="modal-window__content">
                    <form onSubmit={handleSubmit}>
                        <p style={{ marginBottom: "12px", color: "var(--theme-color-text-secondary)" }}>{t("passwordChange.description")}</p>

                        <PasswordInput
                            autoComplete="current-password"
                            labelHide={t("passwordChange.hidePassword")}
                            labelShow={t("passwordChange.showPassword")}
                            name="currentPassword"
                            onChange={handleChange}
                            onToggle={() => setShowCurrentPassword((current) => !current)}
                            placeholder={t("passwordChange.currentPlaceholder")}
                            showPassword={showCurrentPassword}
                            value={form.currentPassword}
                        />

                        <PasswordInput
                            autoComplete="new-password"
                            labelHide={t("passwordChange.hidePassword")}
                            labelShow={t("passwordChange.showPassword")}
                            name="newPassword"
                            onChange={handleChange}
                            onToggle={() => setShowNewPassword((current) => !current)}
                            placeholder={t("passwordChange.newPlaceholder")}
                            showPassword={showNewPassword}
                            value={form.newPassword}
                        />

                        <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "16px" }}>
                            <button type="button" className="button button--size-m button--type-minimal" onClick={handleClose} disabled={isSubmitting}>
                                {t("twoFactor.cancel")}
                            </button>

                            <button type="submit" className="button button--size-m button--type-primary" disabled={isSubmitting || !form.currentPassword.trim() || !form.newPassword.trim()}>
                                {isSubmitting ? t("passwordChange.submitting") : t("passwordChange.submit")}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </Modal>
    );
}