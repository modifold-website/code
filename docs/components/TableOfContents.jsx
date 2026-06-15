"use client";

import { useEffect, useState } from 'react';

export default function TableOfContents({ headings }) {
    const [activeId, setActiveId] = useState(headings[0]?.id || '');
    const [hashActiveId, setHashActiveId] = useState('');

    useEffect(() => {
        if(!headings.length) {
            return;
        }

        function syncHashActiveId() {
            const hashId = decodeURIComponent(window.location.hash.replace(/^#/, ''));
            const matchingHeading = headings.find((heading) => heading.id === hashId);
            const nextHashActiveId = matchingHeading?.id || '';

            setHashActiveId(nextHashActiveId);

            if(nextHashActiveId) {
                setActiveId(nextHashActiveId);
            }
        }

        syncHashActiveId();
        window.addEventListener('hashchange', syncHashActiveId);

        const observer = new IntersectionObserver((entries) => {
            const hashId = decodeURIComponent(window.location.hash.replace(/^#/, ''));
            const matchingHeading = headings.find((heading) => heading.id === hashId);

            if(matchingHeading) {
                setHashActiveId(matchingHeading.id);
                setActiveId(matchingHeading.id);
                return;
            }

            setHashActiveId('');

            const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);

            if(visible[0]?.target?.id) {
                setActiveId(visible[0].target.id);
            }
        },
        {
            rootMargin: '-90px 0px -60% 0px',
            threshold: [0.1, 0.6, 1],
        });

        const elements = headings.map((heading) => document.getElementById(heading.id)).filter(Boolean);

        elements.forEach((el) => observer.observe(el));

        return () => {
            window.removeEventListener('hashchange', syncHashActiveId);
            observer.disconnect();
        };
    }, [headings]);

    const displayedActiveId = hashActiveId || activeId;

    return (
        <aside className="toc">
            <h2>On this page</h2>
            <ul>
                {headings.map((heading) => {
                    const isActive = displayedActiveId === heading.id;
                    return (
                        <li key={heading.id} className={`${heading.depth === 3 ? 'toc-sub' : ''} ${isActive ? 'toc-active' : ''}`.trim()}>
                            <a href={`#${heading.id}`} title={heading.text}>{heading.text}</a>
                        </li>
                    );
                })}
            </ul>
        </aside>
    );
}