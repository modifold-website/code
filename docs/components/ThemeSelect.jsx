"use client";

import { Check, ChevronDown, Moon, Sun } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

function applyTheme(value) {
    const body = document.body;
    body.classList.remove('theme-light', 'theme-dark');
    body.classList.add(`theme-${value}`);
}

function writeCookie(value) {
    const maxAge = 60 * 60 * 24 * 365;
    document.cookie = `theme-preference=${value}; Path=/; Max-Age=${maxAge}; SameSite=Lax`;
}

export default function ThemeSelect({ initialTheme = 'dark' }) {
    const [theme, setTheme] = useState(initialTheme);
    const [isOpen, setIsOpen] = useState(false);
    const rootRef = useRef(null);

    useEffect(() => {
        function onPointerDown(event) {
            if(rootRef.current && !rootRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        }

        function onKeyDown(event) {
            if(event.key === 'Escape') {
                setIsOpen(false);
            }
        }

        document.addEventListener('pointerdown', onPointerDown);
        document.addEventListener('keydown', onKeyDown);

        return () => {
            document.removeEventListener('pointerdown', onPointerDown);
            document.removeEventListener('keydown', onKeyDown);
        };
    }, []);

    function selectTheme(value) {
        setTheme(value);
        applyTheme(value);
        writeCookie(value);
        setIsOpen(false);
    }

    const Icon = theme === 'light' ? Sun : Moon;
    const label = theme === 'light' ? 'Light' : 'Dark';
    const options = [
        { value: 'light', label: 'Light', icon: Sun },
        { value: 'dark', label: 'Dark', icon: Moon },
    ];

    return (
        <div className="theme-select-wrap" ref={rootRef}>
            <button className="theme-trigger" type="button" onClick={() => setIsOpen((value) => !value)} aria-haspopup="menu" aria-expanded={isOpen}>
                <Icon size={16} />
                
                <span>{label}</span>
                
                <ChevronDown className={`theme-trigger-chevron ${isOpen ? 'rotate' : ''}`} size={16} />
            </button>

            {isOpen ? (
                <div className="theme-popover" role="menu">
                    {options.map((option) => {
                        const OptionIcon = option.icon;
                        const isSelected = option.value === theme;

                        return (
                            <button key={option.value} className={`theme-option ${isSelected ? 'is-selected' : ''}`} type="button" role="menuitemradio" aria-checked={isSelected} onClick={() => selectTheme(option.value)}>
                                <OptionIcon size={16} />
                                
                                <span>{option.label}</span>
                                
                                {isSelected ? <Check className="theme-option-check" size={16} /> : null}
                            </button>
                        );
                    })}
                </div>
            ) : null}
        </div>
    );
}