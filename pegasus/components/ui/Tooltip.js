"use client";

import { useEffect, useRef, useState } from "react";

export default function Tooltip({ content, children, position = "top", delay = 500 }) {
    const [isVisible, setIsVisible] = useState(false);
    const timeoutRef = useRef(null);

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
    };

    useEffect(() => () => clearShowTimeout(), []);

    if(!content) {
        return children;
    }

    return (
        <span className={`mf-tooltip${isVisible ? " mf-tooltip--visible" : ""}`} data-position={position} onMouseEnter={scheduleShow} onMouseLeave={hideTooltip} onFocus={scheduleShow} onBlur={hideTooltip}>
            {children}
            
            <span className="mf-tooltip__bubble" role="tooltip">
                {content}
            </span>
        </span>
    );
}