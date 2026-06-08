"use client";

import { useState } from "react";
import Modal from "react-modal";
import { toast } from "react-toastify";
import { useTranslations } from "next-intl";

if(typeof window !== "undefined") {
    Modal.setAppElement("body");
}

export default function TwoFactorDisableModal({ isOpen, authToken, onRequestClose, onDisabled }) {
    const t = useTranslations("SettingsBlogPage");
    const [code, setCode] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const handleDisable = async () => {
        if(!code.trim()) {
            toast.error(t("twoFactor.errors.missingCode"));
            return;
        }

        try {
            setIsLoading(true);
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE}/auth/2fa/disable`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${authToken}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ code: code.trim() }),
            });

            const data = await res.json().catch(() => ({}));
            if(!res.ok) {
                throw new Error(data?.message || t("twoFactor.errors.invalidCode"));
            }

            toast.success(t("twoFactor.disabled"));
            onDisabled?.();
            onRequestClose();
        } catch (error) {
            toast.error(error?.message || t("twoFactor.errors.invalidCode"));
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Modal closeTimeoutMS={150} isOpen={isOpen} onRequestClose={onRequestClose} className="modal active" overlayClassName="modal-overlay">
            <div className="modal-window">
                <div className="modal-window__header">
                    <h2 className="modal-window__title">{t("twoFactor.disableTitle")}</h2>
                    
                    <button className="icon-button modal-window__close" type="button" onClick={onRequestClose} aria-label={t("twoFactor.close")}>
                        <svg className="icon icon--cross" height="24" width="24">
                            <path fillRule="evenodd" clipRule="evenodd" d="M5.293 5.293a1 1 0 0 1 1.414 0L12 10.586l5.293-5.293a1 1 0 0 1 1.414 1.414L13.414 12l5.293 5.293a1 1 0 0 1-1.414 1.414L12 13.414l-5.293 5.293a1 1 0 0 1-1.414-1.414L10.586 12 5.293 6.707a1 1 0 0 1 0-1.414Z" />
                        </svg>
                    </button>
                </div>

                <div className="modal-window__content">
                    <p style={{ marginBottom: "12px" }}>{t("twoFactor.disableDescription")}</p>

                    <div className="field field--default">
                        <label style={{ marginBottom: "16px" }} className="field__wrapper">
                            <input type="text" inputMode="numeric" value={code} onChange={(event) => setCode(event.target.value)} placeholder={t("twoFactor.codePlaceholder")} className="text-input" />
                        </label>
                    </div>

                    <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                        <button type="button" className="button button--size-m button--type-minimal" onClick={onRequestClose} disabled={isLoading}>
                            {t("twoFactor.cancel")}
                        </button>

                        <button type="button" className="button button--size-m button--type-primary" onClick={handleDisable} disabled={isLoading}>
                            {isLoading ? t("twoFactor.submitting") : t("twoFactor.disable")}
                        </button>
                    </div>
                </div>
            </div>
        </Modal>
    );
}