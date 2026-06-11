"use client";

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

function canAnimateTransition() {
    return typeof document !== 'undefined' && 'startViewTransition' in document && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function isModifiedClick(event) {
    return event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0;
}

export default function RouteTransitionManager() {
    const router = useRouter();

    useEffect(() => {
        function onClick(event) {
            if(isModifiedClick(event) || !canAnimateTransition()) {
                return;
            }

            const link = event.target instanceof Element ? event.target.closest('a[href]') : null;
            if(!link || link.target || link.hasAttribute('download')) {
                return;
            }

            const nextUrl = new URL(link.href, window.location.href);
            const currentUrl = new URL(window.location.href);

            if(nextUrl.origin !== currentUrl.origin) {
                return;
            }

            const nextPath = `${nextUrl.pathname}${nextUrl.search}`;
            const currentPath = `${currentUrl.pathname}${currentUrl.search}`;

            if(nextPath === currentPath) {
                return;
            }

            event.preventDefault();

            document.startViewTransition(() => {
                router.push(`${nextPath}${nextUrl.hash}`);
            });
        }

        document.addEventListener('click', onClick, true);

        return () => {
            document.removeEventListener('click', onClick, true);
        };
    }, [router]);

    return null;
}