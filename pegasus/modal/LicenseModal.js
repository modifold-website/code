"use client";

import { useState, useEffect } from "react";
import Modal from "react-modal";
import axios from "axios";
import { toast } from "react-toastify";
import { useTranslations } from "next-intl";

Modal.setAppElement("body");

export default function LicenseModal({ isOpen, licenseId, onRequestClose }) {
    const t = useTranslations("LicenseModal");
    const [license, setLicense] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if(!isOpen || !licenseId) {
            setLicense(null);
            return;
        }

        const normalizedLicenseId = licenseId.toString().toLowerCase();
        if(normalizedLicenseId === "arr" || normalizedLicenseId === "no-license") {
            setLoading(false);
            setLicense({
                name: "ARR",
                body: "All rights reserved unless explicitly stated.",
            });
            
            return;
        }

        const fetchLicense = async () => {
            setLoading(true);

            try {
                const response = await axios.get(`${process.env.NEXT_PUBLIC_API_BASE}/projects/license/${licenseId}`);

                setLicense(response.data);
            } catch (err) {
                console.error(err);
                const message = err.response?.data?.message || t("failed");
                toast.error(message);
            } finally {
                setLoading(false);
            }
        };

        fetchLicense();
    }, [isOpen, licenseId, t]);

    return (
        <Modal closeTimeoutMS={150} isOpen={isOpen} onRequestClose={onRequestClose} className="modal active license-modal" overlayClassName="modal-overlay">
            <div className="modal-window">
                <div className="modal-window__header">
                    <h2 className="modal-window__title">
                        {loading ? "" : license?.name || t("unknown")}
                    </h2>

                    <button className="icon-button modal-window__close" type="button" onClick={onRequestClose} aria-label={t("close")}> 
                        <svg className="icon icon--cross" height="24" width="24">
                            <path fillRule="evenodd" clipRule="evenodd" d="M5.293 5.293a1 1 0 0 1 1.414 0L12 10.586l5.293-5.293a1 1 0 0 1 1.414 1.414L13.414 12l5.293 5.293a1 1 0 0 1-1.414 1.414L12 13.414l-5.293 5.293a1 1 0 0 1-1.414-1.414L10.586 12 5.293 6.707a1 1 0 0 1 0-1.414Z" />
                        </svg>
                    </button>
                </div>

                <div className="modal-window__content license-modal__content">
                    {!loading && license && (
                        <span>{license.body}</span>
                    )}

                    {!loading && !license && <p className="no-data">{t("empty")}</p>}
                </div>
            </div>
        </Modal>
    );
}