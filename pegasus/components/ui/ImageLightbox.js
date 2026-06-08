"use client";

import React, { useCallback, useEffect, useState } from "react";

const LIGHTBOX_SELECTOR = ".js-lightbox-trigger, [data-lightbox-src]";

const getImageFromTrigger = (trigger) => {
    if(!trigger) {
        return null;
    }

    const url = trigger.dataset.lightboxSrc || trigger.getAttribute("src") || trigger.getAttribute("href");
    if(!url) {
        return null;
    }

    return {
        url,
        title: trigger.dataset.lightboxTitle || trigger.getAttribute("alt") || "",
        description: trigger.dataset.lightboxDescription || "",
    };
};

export const useImageLightbox = ({ selector = LIGHTBOX_SELECTOR } = {}) => {
    const [lightboxOpen, setLightboxOpen] = useState(false);
    const [lightboxImage, setLightboxImage] = useState(null);

    const openLightbox = useCallback((image) => {
        if(!image?.url) {
            return;
        }

        setLightboxImage(image);
        setLightboxOpen(true);
    }, []);

    const closeLightbox = useCallback(() => {
        setLightboxOpen(false);
        setLightboxImage(null);
    }, []);

    const getLightboxTriggerProps = useCallback((image) => ({
        onClick: () => openLightbox(image),
        onKeyDown: (e) => {
            if(e.key !== "Enter" && e.key !== " ") {
                return;
            }

            e.preventDefault();
            openLightbox(image);
        },
        role: "button",
        tabIndex: 0,
    }), [openLightbox]);

    useEffect(() => {
        const handleDocumentClick = (e) => {
            if(!(e.target instanceof Element)) {
                return;
            }

            const trigger = e.target.closest(selector);
            if(!trigger) {
                return;
            }

            const image = getImageFromTrigger(trigger);
            if(!image) {
                return;
            }

            e.preventDefault();
            openLightbox(image);
        };

        document.addEventListener("click", handleDocumentClick);
        return () => document.removeEventListener("click", handleDocumentClick);
    }, [openLightbox, selector]);

    return {
        lightboxOpen,
        lightboxImage,
        openLightbox,
        closeLightbox,
        getLightboxTriggerProps,
    };
};

export default function ImageLightbox({isOpen, image, onClose, dialogLabel, closeLabel, openInNewTabLabel, fallbackAlt}) {
    if(!isOpen || !image?.url) {
        return null;
    }

    return (
        <div className="expanded-image-modal" onClick={onClose} role="dialog" aria-label={dialogLabel}>
            <div className="expanded-image-content" onClick={onClose}>
                <img src={image.url} alt={image.title || fallbackAlt} className="expanded-image" onClick={(e) => e.stopPropagation()} />

                <div className="floating" aria-label={dialogLabel} onClick={(e) => e.stopPropagation()}>
                    {(image.title || image.description) &&
                        <div className="text">
                            {image.title && <h2>{image.title}</h2>}

                            {image.description && <p>{image.description}</p>}
                        </div>
                    }

                    <div className="controls">
                        <div className="buttons">
                            <button className="close circle-button" onClick={onClose} type="button" aria-label={closeLabel} style={{ cursor: "pointer" }}>
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-x-icon lucide-x"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                            </button>

                            <a className="open circle-button" target="_blank" rel="noopener noreferrer" href={image.url} aria-label={openInNewTabLabel}>
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-external-link-icon lucide-external-link"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}