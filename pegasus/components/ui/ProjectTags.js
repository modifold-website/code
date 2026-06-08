"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { getCategoryLabel } from "@/utils/categoryLabels";

const normalizeTags = (tags) => {
    if(Array.isArray(tags)) {
        return tags.map((tag) => String(tag).trim()).filter(Boolean);
    }

    if(typeof tags === "string") {
        return tags.split(",").map((tag) => tag.trim()).filter(Boolean);
    }

    return [];
};

export default function ProjectTags({ tags, limit = 5, tagClassName = "new-tag", overflowTagClassName = "", popoverClassName = "", totalCount, popoverAlign = "right" }) {
    const tLabels = useTranslations("CategoryLabels");
    const [isOpen, setIsOpen] = useState(false);
    const [popoverStyle, setPopoverStyle] = useState({});
    const triggerRef = useRef(null);
    const popoverRef = useRef(null);
    const closeTimerRef = useRef(null);
    const normalizedTags = normalizeTags(tags);

    if(normalizedTags.length === 0) {
        return null;
    }

    const visibleTags = normalizedTags.slice(0, limit);
    const hiddenTags = normalizedTags.slice(limit);
    const numericTotalCount = Number.isFinite(Number(totalCount)) ? Number(totalCount) : null;
    const resolvedTotalCount = numericTotalCount !== null ? Math.max(normalizedTags.length, numericTotalCount) : normalizedTags.length;
    const hiddenCount = Math.max(0, resolvedTotalCount - visibleTags.length);
    const overflowClass = overflowTagClassName || tagClassName;

    const clearCloseTimer = () => {
        if(closeTimerRef.current) {
            clearTimeout(closeTimerRef.current);
            closeTimerRef.current = null;
        }
    };

    const updatePopoverPosition = useCallback(() => {
        if(!triggerRef.current || !popoverRef.current) {
            return;
        }

        const triggerRect = triggerRef.current.getBoundingClientRect();
        const popoverRect = popoverRef.current.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const margin = 8;
        const gap = 6;

        let top = triggerRect.bottom + gap;
        if(top + popoverRect.height > viewportHeight - margin && triggerRect.top - gap - popoverRect.height >= margin) {
            top = triggerRect.top - gap - popoverRect.height;
        }

        let left = popoverAlign === "left" ? triggerRect.left : triggerRect.right - popoverRect.width;
        left = Math.max(margin, Math.min(left, viewportWidth - popoverRect.width - margin));
        top = Math.max(margin, Math.min(top, viewportHeight - popoverRect.height - margin));

        setPopoverStyle({
            top: `${Math.round(top)}px`,
            left: `${Math.round(left)}px`,
        });
    }, [popoverAlign]);

    const stopLinkNavigation = (event) => {
        event.preventDefault();
        event.stopPropagation();
    };

    const stopPropagationOnly = (event) => {
        event.stopPropagation();
    };

    const openPopover = () => {
        clearCloseTimer();
        setIsOpen(true);
    };
    
    const scheduleClosePopover = (event) => {
        const next = event?.relatedTarget;
        if(next instanceof Node && event.currentTarget.contains(next)) {
            return;
        }

        clearCloseTimer();
        closeTimerRef.current = setTimeout(() => {
            setIsOpen(false);
        }, 120);
    };

    const handleKeyDown = (event) => {
        if(event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            event.stopPropagation();
        }
    };

    useEffect(() => {
        if(!isOpen) {
            return undefined;
        }

        updatePopoverPosition();
        const frameId = requestAnimationFrame(updatePopoverPosition);
        const handleViewportChange = () => updatePopoverPosition();

        window.addEventListener("scroll", handleViewportChange, true);
        window.addEventListener("resize", handleViewportChange);

        return () => {
            cancelAnimationFrame(frameId);
            window.removeEventListener("scroll", handleViewportChange, true);
            window.removeEventListener("resize", handleViewportChange);
        };
    }, [isOpen, updatePopoverPosition]);

    useEffect(() => () => clearCloseTimer(), []);

    const popover = isOpen && typeof document !== "undefined" ? createPortal(
        <span ref={popoverRef} className="project-tags-floating-popover" role="tooltip" style={popoverStyle} onMouseEnter={openPopover} onMouseLeave={scheduleClosePopover} onClick={stopPropagationOnly}>
            {hiddenTags.map((tag, index) => (
                <span key={`${tag}-${index}`} className="new-tag">
                    {getCategoryLabel(tLabels, tag)}
                </span>
            ))}
        </span>,
        document.body
    ) : null;

    return (
        <>
            {visibleTags.map((tag, index) => (
                <span key={`${tag}-${index}`} className={tagClassName}>
                    {getCategoryLabel(tLabels, tag)}
                </span>
            ))}

            {hiddenCount > 0 && (
                <span ref={triggerRef} className={`project-tags-overflow ${overflowClass}`} tabIndex={0} onClick={stopLinkNavigation} onMouseDown={stopLinkNavigation} onTouchStart={stopLinkNavigation} onKeyDown={handleKeyDown} onMouseEnter={openPopover} onMouseLeave={scheduleClosePopover} onFocus={openPopover} onBlur={scheduleClosePopover}>
                    +{hiddenCount}
                </span>
            )}

            {popover}
        </>
    );
}