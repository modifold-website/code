"use client";

import { useState } from "react";
import Modal from "react-modal";
import axios from "axios";
import { toast } from "react-toastify";
import { useTranslations } from "next-intl";

Modal.setAppElement("body");

export default function CreateOrganizationModal({ isOpen, authToken, onRequestClose, onCreated }) {
    const t = useTranslations("Organizations");
    const [formData, setFormData] = useState({
        name: "",
        slug: "",
        summary: "",
    });
    const [loading, setLoading] = useState(false);
    const isFormValid = formData.name.trim().length > 0 && formData.summary.trim().length > 0;

    const handleSubmit = async (event) => {
        event.preventDefault();
        if(loading || !isFormValid) {
            return;
        }

        setLoading(true);
        try {
            const response = await axios.post(`${process.env.NEXT_PUBLIC_API_BASE}/organizations`, formData, {
                headers: {
                    Authorization: `Bearer ${authToken}`,
                },
            });

            toast.success(t("create.success"));
            setFormData({ name: "", slug: "", summary: "" });
            onCreated?.(response.data?.organization || null);
            onRequestClose?.();
        } catch (error) {
            toast.error(error.response?.data?.message || t("create.errors.generic"));
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal closeTimeoutMS={150} isOpen={isOpen} onRequestClose={onRequestClose} className="modal active" overlayClassName="modal-overlay">
            <div className="modal-window">
                <div className="modal-window__header">
                    <span style={{ fontSize: "18px", fontWeight: "500" }}>{t("create.title")}</span>
                    
                    <button className="icon-button modal-window__close" type="button" onClick={onRequestClose} aria-label={t("create.close") }>
                        <svg className="icon icon--cross" height="24" width="24">
                            <path fillRule="evenodd" clipRule="evenodd" d="M5.293 5.293a1 1 0 0 1 1.414 0L12 10.586l5.293-5.293a1 1 0 0 1 1.414 1.414L13.414 12l5.293 5.293a1 1 0 0 1-1.414 1.414L12 13.414l-5.293 5.293a1 1 0 0 1-1.414-1.414L10.586 12 5.293 6.707a1 1 0 0 1 0-1.414Z"></path>
                        </svg>
                    </button>
                </div>

                <div className="modal-window__content">
                    <form onSubmit={handleSubmit}>
                        <p className="blog-settings__field-title">{t("create.fields.name")}</p>
                        <div className="field field--default">
                            <label className="field__wrapper">
                                <input className="text-input" name="name" value={formData.name} onChange={(event) => setFormData((prev) => ({ ...prev, name: event.target.value }))} placeholder={t("create.placeholders.name")} maxLength={128} required />
                            </label>
                        </div>

                        <p className="blog-settings__field-title">{t("create.fields.url")}</p>
                        <div className="field field--default">
                            <label className="field__wrapper">
                                <input className="text-input" name="slug" value={formData.slug} onChange={(event) => setFormData((prev) => ({ ...prev, slug: event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") }))} placeholder="organization-slug" maxLength={64} />
                            </label>
                        </div>

                        <p className="blog-settings__field-title">{t("create.fields.summary")}</p>
                        <div className="field field--default textarea">
                            <label className="field__wrapper">
                                <textarea className="autosize textarea__input" name="summary" value={formData.summary} onChange={(event) => setFormData((prev) => ({ ...prev, summary: event.target.value }))} placeholder={t("create.placeholders.summary")} maxLength={512} required style={{ height: "140px" }} />
                            </label>
                        </div>

                        <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "16px" }}>
                            <button type="button" className="button button--size-m button--type-minimal" onClick={onRequestClose} disabled={loading}>{t("create.actions.cancel")}</button>
                            
                            <button type="submit" className="button button--size-m button--type-primary" disabled={loading || !isFormValid}>
                                {loading ? t("create.actions.creating") : t("create.actions.create")}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </Modal>
    );
}