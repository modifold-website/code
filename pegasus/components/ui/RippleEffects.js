"use client";

import { useEffect } from "react";

const createRipple = (event, target) => {
    const isCenter = target.dataset.ripple === "center";
    let x;
    let y;
    let size;

    if(isCenter) {
        const width = target.clientWidth;
        const height = target.clientHeight;
        x = width / 2;
        y = height / 2;
        size = Math.max(width, height);
    } else {
        const rect = target.getBoundingClientRect();
        x = event.clientX - rect.left;
        y = event.clientY - rect.top;
        size = Math.max(rect.width, rect.height);
    }

    const ripple = document.createElement("span");
    ripple.className = "ripple-effect";
    ripple.style.left = `${x}px`;
    ripple.style.top = `${y}px`;
    ripple.style.width = `${size * 2}px`;
    ripple.style.height = `${size * 2}px`;
    ripple.addEventListener("animationend", () => ripple.remove(), { once: true });
    target.appendChild(ripple);
};

export default function RippleEffects() {
    useEffect(() => {
        const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

        const updateReducedEffects = () => {
            if(mediaQuery.matches) {
                document.documentElement.setAttribute("data-effects", "reduced");
            } else {
                document.documentElement.removeAttribute("data-effects");
            }
        };

        const handlePointerDown = (event) => {
            if(mediaQuery.matches) {
                return;
            }

            const target = event.target;
            if(!(target instanceof Element)) {
                return;
            }

            const rippleTarget = target.closest("[data-ripple]");
            if(!(rippleTarget instanceof HTMLElement)) {
                return;
            }

            createRipple(event, rippleTarget);
        };

        updateReducedEffects();
        mediaQuery.addEventListener("change", updateReducedEffects);
        document.addEventListener("pointerdown", handlePointerDown, { passive: true });

        return () => {
            mediaQuery.removeEventListener("change", updateReducedEffects);
            document.removeEventListener("pointerdown", handlePointerDown);
        };
    }, []);

    return null;
}