"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useTranslations } from 'next-intl';

export default function CookieBanner() {
    const t = useTranslations("CookieBanner");
    const [isVisible, setIsVisible] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [cookiePreferences, setCookiePreferences] = useState({
        essential: true,
        analytics: false,
    });

    useEffect(() => {
        const savedPreferences = localStorage.getItem("cookiePreferences");
        if(savedPreferences) {
            setCookiePreferences(JSON.parse(savedPreferences));
            setIsVisible(false);
        } else {
            setIsVisible(true);
        }
    }, []);

    const handleAcceptAll = () => {
        const preferences = { essential: true, analytics: true };
        localStorage.setItem("cookiePreferences", JSON.stringify(preferences));
        setCookiePreferences(preferences);
        setIsVisible(false);
    };

    const handleSavePreferences = () => {
        localStorage.setItem("cookiePreferences", JSON.stringify(cookiePreferences));
        setIsVisible(false);
        setIsSettingsOpen(false);
    };

    const handleToggleAnalytics = () => {
        setCookiePreferences((prev) => ({ ...prev, analytics: !prev.analytics }));
    };

    if(!isVisible) {
        return null;
    }

    return (
        <div className="cookie-banner">
            <div className="cookie-banner__content">
                <p>
                    {t("message")}{" "}
                    <Link href="/legal/privacy" className="cookie-banner__link">
                        {t("learnMore")}
                    </Link>
                </p>

                {isSettingsOpen ? (
                    <div className="cookie-banner__settings">
                        <label>
                            <input type="checkbox" checked={cookiePreferences.essential} disabled />
                            {t("essentialCookies")}
                        </label>

                        <label>
                            <input type="checkbox" checked={cookiePreferences.analytics} onChange={handleToggleAnalytics} />
                            {t("analyticsCookies")}
                        </label>

                        <button className="button button--size-m button--type-primary" style={{ width: '100%' }} onClick={handleSavePreferences}>
                            {t("savePreferences")}
                        </button>
                    </div>
                ) : (
                    <div className="cookie-banner__actions">
                        <button className="button button--size-m button--type-primary" onClick={handleAcceptAll}>
                            {t("acceptAll")}
                        </button>

                        <button className="button button--size-m button--type-minimal" onClick={() => setIsSettingsOpen(true)}>
                            {t("customize")}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}