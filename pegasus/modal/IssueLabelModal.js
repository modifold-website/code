"use client";

import { useEffect, useRef, useState } from "react";
import Modal from "react-modal";
import { useTranslations } from "next-intl";

Modal.setAppElement("body");

const DEFAULT_COLORS = [
    "#c1121f",
    "#d9480f",
    "#f59f00",
    "#2f9e44",
    "#0b7285",
    "#1c7ed6",
    "#1864ab",
    "#5f3dc4",
    "#f2a7a7",
    "#ffd6a5",
    "#fff3bf",
    "#d3f9d8",
    "#c5f6fa",
    "#d0ebff",
    "#dbe4ff",
    "#e5dbff",
];

const normalizeHex = (value) => {
    if(!value) {
        return "";
    }

    let next = value.trim().toLowerCase();
    if(!next.startsWith("#")) {
        next = `#${next}`;
    }

    const hex = next.slice(1);
    if(hex.length === 3 && /^[0-9a-f]{3}$/.test(hex)) {
        return `#${hex.split("").map((char) => char + char).join("")}`;
    }

    if(/^[0-9a-f]{6}$/.test(hex)) {
        return `#${hex}`;
    }

    return value;
};

export default function IssueLabelModal({ isOpen, label, onSubmit, onRequestClose, isSubmitting }) {
    const t = useTranslations("IssueSettings");
    const [name, setName] = useState("");
    const [color, setColor] = useState("#2ca84f");
    const [userSelectable, setUserSelectable] = useState(true);
    const [isPaletteOpen, setIsPaletteOpen] = useState(false);
    const popoverRef = useRef(null);
    const triggerRef = useRef(null);

    useEffect(() => {
        if(!isOpen) {
            return;
        }

        setName(label?.name || "");
        setColor(label?.color || "#2ca84f");
        setUserSelectable(typeof label?.user_selectable === "boolean" ? label.user_selectable : true);
        setIsPaletteOpen(false);
    }, [isOpen, label]);

    useEffect(() => {
        if(!isPaletteOpen) {
            return undefined;
        }

        const handleClickOutside = (event) => {
            const target = event.target;
            if(popoverRef.current && popoverRef.current.contains(target)) {
                return;
            }

            if(triggerRef.current && triggerRef.current.contains(target)) {
                return;
            }

            setIsPaletteOpen(false);
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [isPaletteOpen]);

    const handleSubmit = (event) => {
        event.preventDefault();
        const normalized = normalizeHex(color) || "#2ca84f";
        onSubmit({ id: label?.id || null, name, color: normalized, user_selectable: userSelectable });
    };

    const resolvedColor = normalizeHex(color) || "#2ca84f";
    const previewName = name.trim() || t("labels.namePlaceholder");

    return (
        <Modal closeTimeoutMS={150} isOpen={isOpen} onRequestClose={onRequestClose} className="modal active" overlayClassName="modal-overlay">
            <div className="modal-window" style={{ maxWidth: "520px" }}>
                <div className="modal-window__header">
                    <h2 className="modal-window__title">
                        {label?.id ? t("labels.editTitle") : t("labels.createTitle")}
                    </h2>

                    <button className="icon-button modal-window__close" type="button" onClick={onRequestClose} aria-label={t("common.close")}> 
                        <svg className="icon icon--cross" height="24" width="24">
                            <path fillRule="evenodd" clipRule="evenodd" d="M5.293 5.293a1 1 0 0 1 1.414 0L12 10.586l5.293-5.293a1 1 0 0 1 1.414 1.414L13.414 12l5.293 5.293a1 1 0 0 1-1.414 1.414L12 13.414l-5.293 5.293a1 1 0 0 1-1.414-1.414L10.586 12 5.293 6.707a1 1 0 0 1 0-1.414Z" />
                        </svg>
                    </button>
                </div>

                <div className="modal-window__content">
                    <form onSubmit={handleSubmit}>
                        <div className="issue-label-preview">
                            <div className="issue-label-chip" style={{ background: `${resolvedColor}22`, color: resolvedColor, border: `1px solid ${resolvedColor}44` }}>
                                <span>{previewName}</span>
                            </div>
                        </div>

                        <p className="blog-settings__field-title">{t("labels.name")}</p>
                        <div className="field field--default">
                            <label className="field__wrapper">
                                <input className="text-input" value={name} onChange={(event) => setName(event.target.value)} placeholder={t("labels.namePlaceholder")} required maxLength={40} />
                            </label>
                        </div>

                        <p className="blog-settings__field-title">{t("labels.color")}</p>
                        <div className="issue-color-picker">
                            <div className="issue-color-picker__row">
                                <button
                                    ref={triggerRef}
                                    type="button"
                                    className="issue-color-picker__preview"
                                    style={{ background: resolvedColor }}
                                    onClick={() => setIsPaletteOpen((prev) => !prev)}
                                    aria-label={t("labels.color")}
                                />

                                <div className="field field--default">
                                    <label className="field__wrapper">
                                        <input className="text-input" value={color} onChange={(event) => setColor(event.target.value)} onBlur={(event) => setColor(normalizeHex(event.target.value))} placeholder="#2ca84f" inputMode="text" autoComplete="off" />
                                    </label>
                                </div>
                            </div>

                            {isPaletteOpen && (
                                <div className="issue-color-picker__popover" ref={popoverRef}>
                                    <div className="issue-color-picker__palette">
                                        {DEFAULT_COLORS.map((item) => (
                                            <button
                                                key={item}
                                                type="button"
                                                className={`issue-color-picker__swatch ${resolvedColor === item ? "is-active" : ""}`}
                                                style={{ background: item }}
                                                onClick={() => {
                                                    setColor(item);
                                                    setIsPaletteOpen(false);
                                                }}
                                                aria-label={item}
                                            />
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        <p className="blog-settings__field-title">{t("labels.applyAccessTitle")}</p>
                        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                            <button type="button" className={`button button--size-m ${userSelectable ? "button--type-primary" : "button--type-minimal"}`} onClick={() => setUserSelectable(true)}>
                                {t("labels.applyAccessEveryone")}
                            </button>

                            <button type="button" className={`button button--size-m ${!userSelectable ? "button--type-primary" : "button--type-minimal"}`} onClick={() => setUserSelectable(false)}>
                                {t("labels.applyAccessTeamOnly")}
                            </button>
                        </div>

                        <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "16px" }}>
                            <button type="button" className="button button--size-m button--type-minimal" onClick={onRequestClose} disabled={isSubmitting}>
                                {t("common.cancel")}
                            </button>

                            <button type="submit" className="button button--size-m button--type-primary" disabled={isSubmitting}>
                                {isSubmitting ? t("common.saving") : t("labels.save")}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </Modal>
    );
}