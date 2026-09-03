"use client";

import { useState } from "react";
import Modal from "react-modal";
import axios from "axios";
import { toast } from "react-toastify";
import { useRouter } from "next/navigation";
import { useAuth } from "./providers/AuthProvider";
import { useTranslations } from "next-intl";

Modal.setAppElement("body");

export default function DeleteAccountSection() {
    const t = useTranslations("DeleteAccountSection");
    const { logout } = useAuth();
    const router = useRouter();

    const [modalIsOpen, setModalIsOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const openModal = () => setModalIsOpen(true);
    const closeModal = () => setModalIsOpen(false);

    const handleDeleteAccount = async () => {
        setIsDeleting(true);

        try {
            await axios.delete(`${process.env.NEXT_PUBLIC_API_BASE}/users/me`, {
                headers: {
                    Authorization: `Bearer ${localStorage.getItem("authToken")}`,
                },
            });

            toast.success(t("success"));

            localStorage.removeItem("authToken");
            logout();

            setTimeout(() => {
                router.push("/");
            }, 2000);
        } catch (error) {
            console.error("Delete account error:", error);
            const msg = error.response?.data?.message || t("errors.generic");
            toast.error(msg);
        } finally {
            setIsDeleting(false);
            closeModal();
        }
    };

    return (
        <div className="delete-account-section">
            <p className="blog-settings__field-title" style={{ color: "var(--theme-color-signal-negative-default)" }}>{t("title")}</p>

            <p style={{ marginBottom: "16px" }}>
                {t("description")}
            </p>

            <button type="button" onClick={openModal} className="button button--size-m button--type-danger" disabled={isDeleting}>
                {t("deleteButton")}
            </button>

            <Modal closeTimeoutMS={150} isOpen={modalIsOpen} onRequestClose={closeModal} className="modal active" overlayClassName="modal-overlay">
                <div className="modal-window">
                    <div className="modal-window__header">
                        <button className="icon-button modal-window__close" type="button" onClick={closeModal}>
                            <svg className="icon icon--cross" height="24" width="24">
                                <path fillRule="evenodd" clipRule="evenodd" d="M5.293 5.293a1 1 0 0 1 1.414 0L12 10.586l5.293-5.293a1 1 0 0 1 1.414 1.414L13.414 12l5.293 5.293a1 1 0 0 1-1.414 1.414L12 13.414l-5.293 5.293a1 1 0 0 1-1.414-1.414L10.586 12 5.293 6.707a1 1 0 0 1 0-1.414Z"></path>
                            </svg>
                        </button>
                    </div>

                    <div className="modal-window__content">
                        <p className="blog-settings__field-title">{t("confirmTitle")}</p>

                        <p style={{ lineHeight: 1.5, margin: "16px 0 24px" }}>
                            {t("confirmDescription")}
                        </p>

                        <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
                            <button type="button" onClick={closeModal} className="button button--size-m button--type-minimal" disabled={isDeleting}>
                                {t("cancel")}
                            </button>

                            <button type="button" onClick={handleDeleteAccount} className="button button--size-m button--type-danger" disabled={isDeleting}>
                                {isDeleting ? t("deleting") : t("confirmDelete")}
                            </button>
                        </div>
                    </div>
                </div>
            </Modal>
        </div>
    );
}