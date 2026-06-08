"use client";

import { useState } from "react";
import Modal from "react-modal";
import { useTranslations } from "next-intl";

if(typeof window !== "undefined") {
    Modal.setAppElement("body");
}

export default function FooterModrinthModal() {
    const t = useTranslations("Footer.modrinthModal");
    const [isOpen, setIsOpen] = useState(false);

    return (
        <>
            <button type="button" className={`footer-announcement__link footer-announcement__button`} onClick={() => setIsOpen(true)} aria-label={t("openAriaLabel")}>
                Modrinth
            </button>

            <Modal closeTimeoutMS={150} isOpen={isOpen} onRequestClose={() => setIsOpen(false)} className="modal active" overlayClassName="modal-overlay">
                <div className="modal-window">
                    <div className="modal-window__header">
                        <h2 className="modal-window__title">{t("title")}</h2>

                        <button className="icon-button modal-window__close" type="button" onClick={() => setIsOpen(false)} aria-label={t("closeAriaLabel")}>
                            <svg className="icon icon--cross" height="24" width="24">
                                <path fillRule="evenodd" clipRule="evenodd" d="M5.293 5.293a1 1 0 0 1 1.414 0L12 10.586l5.293-5.293a1 1 0 0 1 1.414 1.414L13.414 12l5.293 5.293a1 1 0 0 1-1.414 1.414L12 13.414l-5.293 5.293a1 1 0 0 1-1.414-1.414L10.586 12 5.293 6.707a1 1 0 0 1 0-1.414Z"></path>
                            </svg>
                        </button>
                    </div>

                    <div className="modal-window__content footer-modrinth-modal__content">
                        <p>{t("paragraph1")}</p>
                        <p>
                            {t("paragraph2Prefix")}{" "}
                            <a href="https://modrinth.com" target="_blank" rel="noopener noreferrer" className="footer-announcement__link">
                                Modrinth
                            </a>{" "}
                            {t("paragraph2Suffix")}
                        </p>
                        <p>{t("paragraph3")}</p>

                        <blockquote className="footer-modrinth-modal__quote">
                            <p>{t("quote1")}</p>
                            <p>{t("quote2")}</p>
                            <p>{t("quote3")}</p>
                        </blockquote>
                    </div>
                </div>
            </Modal>
        </>
    );
}