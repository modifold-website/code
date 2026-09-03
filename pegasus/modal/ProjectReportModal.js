"use client";

import { useEffect, useMemo, useState } from "react";
import Modal from "react-modal";
import axios from "axios";
import { toast } from "react-toastify";
import { useTranslations } from "next-intl";

Modal.setAppElement("body");

const COMMENT_MAX_LENGTH = 1000;

export default function ProjectReportModal({ isOpen, onRequestClose, projectSlug, authToken, onSubmitted }) {
    const t = useTranslations("ProjectReportModal");
    const [reason, setReason] = useState("rules_violation");
    const [comment, setComment] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const reasonOptions = useMemo(() => ([
        "rules_violation",
        "spam",
        "malware",
        "copyright",
        "nsfw",
        "fraud",
        "other",
    ]), []);

    useEffect(() => {
        if(!isOpen) {
            return;
        }

        setReason("rules_violation");
        setComment("");
        setIsSubmitting(false);
    }, [isOpen]);

    const handleSubmit = async (event) => {
        event.preventDefault();

        if(!reason) {
            toast.error(t("errors.reasonRequired"));
            return;
        }

        if(comment.length > COMMENT_MAX_LENGTH) {
            toast.error(t("errors.commentTooLong", { max: COMMENT_MAX_LENGTH }));
            return;
        }

        try {
            setIsSubmitting(true);

            await axios.post(
                `${process.env.NEXT_PUBLIC_API_BASE}/reports/projects/${projectSlug}`,
                { reason, comment },
                { headers: { Authorization: `Bearer ${authToken}` } }
            );

            toast.success(t("success"));
            onSubmitted?.();
            onRequestClose();
        } catch (error) {
            const message = error?.response?.data?.message;

            if(message === "Report already submitted") {
                toast.error(t("errors.duplicate"));
            } else if(message === "Invalid report reason") {
                toast.error(t("errors.reasonRequired"));
            } else {
                toast.error(t("errors.generic"));
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Modal closeTimeoutMS={150} isOpen={isOpen} onRequestClose={onRequestClose} className="modal active" overlayClassName="modal-overlay">
            <div className="modal-window">
                <div className="modal-window__header">
                    <h2 className="modal-window__title">{t("title")}</h2>
                    
                    <button className="icon-button modal-window__close" type="button" onClick={onRequestClose} aria-label={t("close")}>
                        <svg className="icon icon--cross" height="24" width="24">
                            <path fillRule="evenodd" clipRule="evenodd" d="M5.293 5.293a1 1 0 0 1 1.414 0L12 10.586l5.293-5.293a1 1 0 0 1 1.414 1.414L13.414 12l5.293 5.293a1 1 0 0 1-1.414 1.414L12 13.414l-5.293 5.293a1 1 0 0 1-1.414-1.414L10.586 12 5.293 6.707a1 1 0 0 1 0-1.414Z" />
                        </svg>
                    </button>
                </div>

                <div className="modal-window__content">
                    <p style={{ marginBottom: "14px" }}>{t("description")}</p>

                    <form onSubmit={handleSubmit}>
                        <p className="blog-settings__field-title">{t("reason")}</p>
                        <div role="group" aria-label={t("reason")} style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "12px" }}>
                            {reasonOptions.map((code) => (
                                <button key={code} type="button" className={`button button--size-m ${reason === code ? "button--type-primary" : "button--type-minimal"}`} aria-pressed={reason === code} onClick={() => setReason(code)} disabled={isSubmitting}>
                                    {t(`reasons.${code}`)}
                                </button>
                            ))}
                        </div>

                        <p className="blog-settings__field-title">{t("comment")}</p>
                        <div className="field field--default textarea blog-settings__input">
                            <label className="field__wrapper">
                                <textarea
                                    className="autosize textarea__input"
                                    value={comment}
                                    onChange={(e) => setComment(e.target.value)}
                                    placeholder={t("placeholders.comment")}
                                    style={{ height: "110px" }}
                                    maxLength={COMMENT_MAX_LENGTH}
                                />
                            </label>
                        </div>

                        <div style={{ marginTop: "6px", color: "var(--theme-color-text-secondary)", fontSize: "13px" }}>
                            {t("commentCounter", { count: comment.length, max: COMMENT_MAX_LENGTH })}
                        </div>

                        <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "16px" }}>
                            <button type="submit" className="button button--size-m button--type-primary" disabled={isSubmitting}>
                                {isSubmitting ? t("submitting") : t("submit")}
                            </button>

                            <button type="button" className="button button--size-m button--type-minimal" onClick={onRequestClose} disabled={isSubmitting}>
                                {t("cancel")}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </Modal>
    );
}