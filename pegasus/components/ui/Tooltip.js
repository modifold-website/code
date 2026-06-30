"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const TOOLTIP_GAP = 10;
const VIEWPORT_PADDING = 8;

export default function Tooltip({ content, children, position = "top", delay = 500 }) {
    const [isVisible, setIsVisible] = useState(false);
    const [tooltipStyle, setTooltipStyle] = useState(null);
    const [isMounted, setIsMounted] = useState(false);
    const triggerRef = useRef(null);
    const bubbleRef = useRef(null);
    const timeoutRef = useRef(null);

    const updateTooltipPosition = useCallback(() => {
        const trigger = triggerRef.current;
        const bubble = bubbleRef.current;

        if(!trigger || !bubble) {
            return;
        }

        const triggerRect = trigger.getBoundingClientRect();
        const bubbleRect = bubble.getBoundingClientRect();
        const normalizedPosition = ["top", "bottom"].includes(position) ? position : "top";
        const maxLeft = Math.max(VIEWPORT_PADDING, window.innerWidth - bubbleRect.width - VIEWPORT_PADDING);
        const left = Math.min(
            Math.max(triggerRect.left + triggerRect.width / 2 - bubbleRect.width / 2, VIEWPORT_PADDING),
            maxLeft
        );
        const top = normalizedPosition === "bottom"
            ? triggerRect.bottom + TOOLTIP_GAP
            : triggerRect.top - bubbleRect.height - TOOLTIP_GAP;

        setTooltipStyle({
            left: `${left}px`,
            top: `${Math.max(VIEWPORT_PADDING, top)}px`,
        });
    }, [position]);

    const clearShowTimeout = () => {
        if(timeoutRef.current !== null) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
    };

    const scheduleShow = () => {
        clearShowTimeout();
        timeoutRef.current = setTimeout(() => {
            setIsVisible(true);
            timeoutRef.current = null;
        }, delay);
    };

    const hideTooltip = () => {
        clearShowTimeout();
        setIsVisible(false);
        setTooltipStyle(null);
    };

    useEffect(() => {
        setIsMounted(true);
    }, []);

    useEffect(() => () => clearShowTimeout(), []);

    useLayoutEffect(() => {
        if(!isVisible) {
            return;
        }

        updateTooltipPosition();
    }, [isVisible, content, updateTooltipPosition]);

    useEffect(() => {
        if(!isVisible) {
            return;
        }

        window.addEventListener("resize", updateTooltipPosition);
        window.addEventListener("scroll", updateTooltipPosition, true);

        return () => {
            window.removeEventListener("resize", updateTooltipPosition);
            window.removeEventListener("scroll", updateTooltipPosition, true);
        };
    }, [isVisible, updateTooltipPosition]);

    if(!content) {
        return children;
    }

    return (
        <span ref={triggerRef} className={`mf-tooltip${isVisible ? " mf-tooltip--visible" : ""}`} data-position={position} onMouseEnter={scheduleShow} onMouseLeave={hideTooltip} onFocus={scheduleShow} onBlur={hideTooltip}>
            {children}

            {isMounted && isVisible ? createPortal(
                <span ref={bubbleRef} className={`mf-tooltip__bubble mf-tooltip__bubble--portal${tooltipStyle ? " mf-tooltip__bubble--visible" : ""}`} data-position={position} role="tooltip" style={tooltipStyle || undefined}>
                    {content}
                </span>,
                document.body
            ) : null}
        </span>
    );
}