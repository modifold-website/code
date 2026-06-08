"use client";

import Modal from "react-modal";
import { useTranslations } from "next-intl";

Modal.setAppElement("body");

export default function IssueTemplatePickerModal({ isOpen, templates = [], onSelect, onRequestClose }) {
    const t = useTranslations("Issues");

    return (
        <Modal closeTimeoutMS={150} isOpen={isOpen} onRequestClose={onRequestClose} className="modal active" overlayClassName="modal-overlay">
            <div className="modal-window">
                <div className="modal-window__header">
                    <h2 className="modal-window__title">{t("newIssue.selectTitle")}</h2>

                    <button className="icon-button modal-window__close" type="button" onClick={onRequestClose} aria-label={t("common.close")}>
                        <svg className="icon icon--cross" height="24" width="24">
                            <path fillRule="evenodd" clipRule="evenodd" d="M5.293 5.293a1 1 0 0 1 1.414 0L12 10.586l5.293-5.293a1 1 0 0 1 1.414 1.414L13.414 12l5.293 5.293a1 1 0 0 1-1.414 1.414L12 13.414l-5.293 5.293a1 1 0 0 1-1.414-1.414L10.586 12 5.293 6.707a1 1 0 0 1 0-1.414Z" />
                        </svg>
                    </button>
                </div>

                <div className="modal-window__content">
                    <div className="issue-modal-list">
                        <button type="button" className="issue-modal-template" onClick={() => onSelect(null)}>
                            <span className="issue-modal-template__title">{t("newIssue.blankTitle")}</span>
                            <span className="issue-modal-template__desc">{t("newIssue.blankDesc")}</span>
                        </button>

                        {templates.map((template) => (
                            <button key={template.id} type="button" className="issue-modal-template" onClick={() => onSelect(template)}>
                                <span className="issue-modal-template__title">{template.name}</span>
                                <span className="issue-modal-template__desc">{template.description || t("newIssue.noDescription")}</span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </Modal>
    );
}