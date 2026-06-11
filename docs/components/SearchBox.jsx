"use client";

import Link from 'next/link';
import { Search, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';

const MAX_RESULTS = 8;

function normalize(value) {
    return value.toLowerCase().trim();
}

function getScore(item, query) {
    const title = normalize(item.title);
    const href = normalize(item.href);
    const description = normalize(item.description || '');
    const searchText = normalize(item.searchText || '');

    if(title === query || href === query) {
        return 120;
    }

    if(title.startsWith(query) || href.startsWith(query)) {
        return 90;
    }

    if(title.includes(query) || href.includes(query)) {
        return 70;
    }

    if(description.includes(query)) {
        return 45;
    }

    if(searchText.includes(query)) {
        return 20;
    }

    return 0;
}

function getSnippet(item, query) {
    const source = item.description || item.searchText || '';
    const sourceLower = source.toLowerCase();
    const index = sourceLower.indexOf(query);

    if(index === -1) {
        return item.description || item.href;
    }

    const start = Math.max(0, index - 48);
    const end = Math.min(source.length, index + query.length + 90);
    const prefix = start > 0 ? '...' : '';
    const suffix = end < source.length ? '...' : '';

    return `${prefix}${source.slice(start, end)}${suffix}`;
}

export default function SearchBox({ items }) {
    const router = useRouter();
    const [query, setQuery] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const [activeIndex, setActiveIndex] = useState(0);
    const rootRef = useRef(null);
    const inputRef = useRef(null);

    const results = useMemo(() => {
        const normalizedQuery = normalize(query);

        if(normalizedQuery.length < 2) {
            return [];
        }

        return items.map((item) => ({
            ...item,
            score: getScore(item, normalizedQuery),
            snippet: getSnippet(item, normalizedQuery),
        })).filter((item) => item.score > 0).sort((a, b) => b.score - a.score || a.title.localeCompare(b.title)).slice(0, MAX_RESULTS);
    }, [items, query]);

    useEffect(() => {
        function onPointerDown(event) {
            if(rootRef.current && !rootRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        }

        document.addEventListener('pointerdown', onPointerDown);

        return () => document.removeEventListener('pointerdown', onPointerDown);
    }, []);

    useEffect(() => {
        function onKeyDown(event) {
            if((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
                event.preventDefault();
                inputRef.current?.focus();
                setIsOpen(true);
            }
        }

        window.addEventListener('keydown', onKeyDown);

        return () => window.removeEventListener('keydown', onKeyDown);
    }, []);

    useEffect(() => {
        setActiveIndex(0);
    }, [query]);

    function clearSearch() {
        setQuery('');
        setIsOpen(false);
        inputRef.current?.focus();
    }

    function onInputKeyDown(event) {
        if(event.key === 'Escape') {
            setIsOpen(false);
            return;
        }

        if(!results.length) {
            return;
        }

        if(event.key === 'ArrowDown') {
            event.preventDefault();
            setActiveIndex((current) => (current + 1) % results.length);
        }

        if(event.key === 'ArrowUp') {
            event.preventDefault();
            setActiveIndex((current) => (current - 1 + results.length) % results.length);
        }

        if(event.key === 'Enter') {
            event.preventDefault();
            setIsOpen(false);
            router.push(results[activeIndex].href);
        }
    }

    return (
        <div className="searchbar" ref={rootRef}>
            <Search className="search-icon" size={18} aria-hidden="true" />
            
            <input
                ref={inputRef}
                type="search"
                value={query}
                onChange={(event) => {
                    setQuery(event.target.value);
                    setIsOpen(true);
                }}
                onFocus={() => setIsOpen(true)}
                onKeyDown={onInputKeyDown}
                placeholder="Search docs..."
                aria-label="Search documentation"
                aria-expanded={isOpen}
                aria-controls="docs-search-results"
            />

            {query ? (
                <button className="search-clear" type="button" onClick={clearSearch} aria-label="Clear search">
                    <X size={16} />
                </button>
            ) : (
                <kbd className="search-shortcut">⌘K</kbd>
            )}

            {isOpen && query.length >= 2 ? (
                <div className="search-results" id="docs-search-results" role="listbox">
                    {results.length ? (
                        results.map((item, index) => (
                            <Link key={item.href} href={item.href} className={`search-result ${index === activeIndex ? 'is-active' : ''}`} role="option" aria-selected={index === activeIndex} onMouseEnter={() => setActiveIndex(index)} onClick={() => setIsOpen(false)}>
                                <span className="search-result-title">{item.title}</span>

                                <span className="search-result-path">{item.href}</span>

                                <span className="search-result-snippet">{item.snippet}</span>
                            </Link>
                        ))
                    ) : (
                        <div className="search-empty">No results found</div>
                    )}
                </div>
            ) : null}
        </div>
    );
}