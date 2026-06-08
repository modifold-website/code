"use client";

import { useState } from "react";
import Modal from "react-modal";
import axios from "axios";
import { toast } from "react-toastify";
import { useAuth } from "../components/providers/AuthProvider";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { getProjectPathByType } from "@/utils/projectRoutes";

Modal.setAppElement("body");

export default function ProjectCreationModal({ isOpen, authToken, onRequestClose }) {
    const t = useTranslations("ProjectCreationModal");
    const { isLoggedIn } = useAuth();
    const router = useRouter();
    const [formData, setFormData] = useState({
        title: "",
        summary: "",
        visibility: "public",
        project_type: "mod",
    });
    const [loading, setLoading] = useState(false);
    const isFormValid = formData.title.trim().length > 0 && formData.summary.trim().length >= 30;

    if(!isLoggedIn && isOpen) {
        router.push("/");
        return null;
    }

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        const data = new FormData();
        data.append("title", formData.title);
        data.append("summary", formData.summary);
        data.append("visibility", formData.visibility);
        data.append("project_type", formData.project_type);

        try {
            const res = await axios.post(`${process.env.NEXT_PUBLIC_API_BASE}/projects`, data, {
                headers: {
                    Authorization: `Bearer ${authToken}`,
                    "Content-Type": "multipart/form-data",
                },
            });

            toast.success(t("success"));
            onRequestClose();
            router.push(`${getProjectPathByType({ slug: res.data.slug, projectType: res.data.project_type })}/settings`);
        } catch (err) {
            toast.error(err.response?.data?.message || t("errors.generic"));
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal closeTimeoutMS={150} isOpen={isOpen} onRequestClose={onRequestClose} className="modal active" overlayClassName="modal-overlay">
            <div className="modal-window">
                <div className="modal-window__header">
                    <h2 className="modal-window__title">{t("title")}</h2>
                    
                    <button className="icon-button modal-window__close" type="button" onClick={onRequestClose} aria-label={t("close")}>
                        <svg className="icon icon--cross" height="24" width="24">
                            <path fillRule="evenodd" clipRule="evenodd" d="M5.293 5.293a1 1 0 0 1 1.414 0L12 10.586l5.293-5.293a1 1 0 0 1 1.414 1.414L13.414 12l5.293 5.293a1 1 0 0 1-1.414 1.414L12 13.414l-5.293 5.293a1 1 0 0 1-1.414-1.414L10.586 12 5.293 6.707a1 1 0 0 1 0-1.414Z"></path>
                        </svg>
                    </button>
                </div>

                <div className="modal-window__content">
                    <form onSubmit={handleSubmit}>
                        <p className="blog-settings__field-title">{t("name")}</p>
                        <div className="field field--default">
                            <label className="field__wrapper">
                                <input type="text" name="title" placeholder={t("placeholders.name")} value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} required className="text-input" maxLength="30" disabled={loading} />
                            </label>
                        </div>

                        <p className="blog-settings__field-title" style={{ marginBottom: "4px" }}>{t("summary")}</p>

                        <p style={{ marginBottom: "8px", color: "var(--theme-color-text-secondary)" }}>{t("summaryHint")}</p>
                        
                        <div className="field field--default textarea">
                            <label className="field__wrapper">
                                <textarea name="summary" value={formData.summary} onChange={(e) => setFormData({ ...formData, summary: e.target.value })} placeholder={t("placeholders.summary")} className="autosize textarea__input" style={{ height: "128px" }} required minLength={30} maxLength={256} disabled={loading} />
                            </label>
                        </div>

                        <p className="blog-settings__field-title">{t("projectType")}</p>
                        <div style={{ display: "flex", gap: "10px" }}>
                            <button type="button" className={`button tag-selector__button button--size-m ${formData.project_type === "mod" ? "button--type-primary" : "button--type-minimal"}`} onClick={() => setFormData({ ...formData, project_type: "mod" })} disabled={loading}>
                                <div className="tag-selector__icon">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-box-icon lucide-box">
                                        <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/>
                                        <path d="m3.3 7 8.7 5 8.7-5"/>
                                        <path d="M12 22V12"/>
                                    </svg>
                                </div>

                                {t("projectTypes.mod")}
                            </button>
                            
                            <button type="button" className={`button tag-selector__button button--size-m ${formData.project_type === "modpack" ? "button--type-primary" : "button--type-minimal"}`} onClick={() => setFormData({ ...formData, project_type: "modpack" })} disabled={loading}>
                                <div className="tag-selector__icon">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-package-open-icon lucide-package-open">
                                        <path d="M12 22v-9"/>
                                        <path d="M15.17 2.21a1.67 1.67 0 0 1 1.63 0L21 4.57a1.93 1.93 0 0 1 0 3.36L8.82 14.79a1.655 1.655 0 0 1-1.64 0L3 12.43a1.93 1.93 0 0 1 0-3.36z"/>
                                        <path d="M20 13v3.87a2.06 2.06 0 0 1-1.11 1.83l-6 3.08a1.93 1.93 0 0 1-1.78 0l-6-3.08A2.06 2.06 0 0 1 4 16.87V13"/>
                                        <path d="M21 12.43a1.93 1.93 0 0 0 0-3.36L8.83 2.2a1.64 1.64 0 0 0-1.63 0L3 4.57a1.93 1.93 0 0 0 0 3.36l12.18 6.86a1.636 1.636 0 0 0 1.63 0z"/>
                                    </svg>
                                </div>
                                
                                {t("projectTypes.modpack")}
                            </button>
                        </div>

                        <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "16px" }}>
                            <button type="button" className="button button--size-m button--type-minimal" onClick={onRequestClose} disabled={loading}>
                                {t("cancel")}
                            </button>
                            
                            <button type="submit" className="button button--size-m button--type-primary" disabled={loading || !isFormValid}>
                                {loading ? t("creating") : t("createProject")}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </Modal>
    );
}