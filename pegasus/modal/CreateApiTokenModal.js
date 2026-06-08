"use client";

import { useEffect, useRef, useState } from "react";
import Modal from "react-modal";
import { useTranslations } from "next-intl";

Modal.setAppElement("body");

export default function CreateApiTokenModal({ isOpen, onRequestClose, form, onInputChange, onSelectDuration, onSubmit, isCreatingToken }) {
    const t = useTranslations("SettingsAPIPage");
    const [isDurationPopoverOpen, setIsDurationPopoverOpen] = useState(false);
    const durationRef = useRef(null);

    const durations = [
        { value: "1w", label: t("durations.week") },
        { value: "1m", label: t("durations.month") },
        { value: "3m", label: t("durations.quarter") },
        { value: "1y", label: t("durations.year") },
        { value: "forever", label: t("durations.forever") },
    ];

    const currentDurationLabel = durations.find((d) => d.value === form.duration)?.label;

    useEffect(() => {
        const handleClickOutside = (event) => {
            if(durationRef.current && !durationRef.current.contains(event.target)) {
                setIsDurationPopoverOpen(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleClose = () => {
        setIsDurationPopoverOpen(false);
        onRequestClose();
    };

    const handleDurationSelect = (event, value) => {
        event.stopPropagation();
        setIsDurationPopoverOpen(false);
        onSelectDuration(value);
    };

    return (
        <Modal closeTimeoutMS={150} isOpen={isOpen} onRequestClose={handleClose} className="modal active" overlayClassName="modal-overlay">
            <div className="modal-window version-upload-modal">
                <div className="modal-window__header">
                    <span style={{ fontSize: "18px", fontWeight: "500" }}>{t("createToken")}</span>
                    
                    <button className="icon-button modal-window__close" type="button" onClick={handleClose} aria-label={t("close")}>
                        <svg className="icon icon--cross" height="24" width="24">
                            <path fillRule="evenodd" clipRule="evenodd" d="M5.293 5.293a1 1 0 0 1 1.414 0L12 10.586l5.293-5.293a1 1 0 0 1 1.414 1.414L13.414 12l5.293 5.293a1 1 0 0 1-1.414 1.414L12 13.414l-5.293 5.293a1 1 0 0 1-1.414-1.414L10.586 12 5.293 6.707a1 1 0 0 1 0-1.414Z" />
                        </svg>
                    </button>
                </div>

                <div className="modal-window__content">
                    <form onSubmit={onSubmit}>
                        <p className="blog-settings__field-title">{t("tokenName")}</p>
                        <div className="field field--default">
                            <label style={{ marginBottom: "10px" }} className="field__wrapper">
                                <input type="text" name="name" value={form.name} onChange={onInputChange} placeholder={t("placeholders.tokenName")} className="text-input" maxLength={60} required disabled={isCreatingToken} />
                            </label>
                        </div>

                        <p className="blog-settings__field-title">{t("expiration")}</p>
                        <div className="field field--default" ref={durationRef}>
                            <label className="field__wrapper" onClick={() => setIsDurationPopoverOpen(!isDurationPopoverOpen)} style={{ marginBottom: "10px" }}>
                                <div className="field__wrapper-body">
                                    <div className="select">
                                        <div className="select__selected">{currentDurationLabel}</div>
                                    </div>
                                </div>
                            </label>

                            {isDurationPopoverOpen && (
                                <div className="popover" onClick={(event) => event.stopPropagation()}>
                                    <div className="context-list" data-scrollable style={{ maxHeight: "280px", overflowY: "auto" }}>
                                        {durations.map((opt) => (
                                            <div key={opt.value} className={`context-list-option ${form.duration === opt.value ? "context-list-option--selected" : ""}`} onClick={(event) => handleDurationSelect(event, opt.value)}>
                                                <div className="context-list-option__label">
                                                    {opt.label}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "16px" }}>
                            <button type="button" className="button button--size-m button--type-minimal" onClick={handleClose} disabled={isCreatingToken}>
                                {t("cancel")}
                            </button>

                            <button type="submit" className="button button--size-m button--type-primary" disabled={isCreatingToken}>
                                {isCreatingToken ? t("creating") : t("createToken")}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </Modal>
    );
}