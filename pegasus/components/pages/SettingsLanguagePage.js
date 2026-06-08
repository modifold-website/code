"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "next/navigation";

export default function SettingsLanguagePage() {
    const t = useTranslations("SettingsBlogPage");
    const locale = useLocale();
    const router = useRouter();

    const [selectedLocale, setSelectedLocale] = useState(locale || "en");
    const languages = useMemo(() => ([
        { code: "en", native: "English (United States)" },
        { code: "es", native: "Español" },
        { code: "pt", native: "Português" },
        { code: "ru", native: "Русский" },
        { code: "uk", native: "Українська" },
        { code: "tr", native: "Türkçe" },
    ]), []);

    useEffect(() => {
        setSelectedLocale(locale || "en");
    }, [locale]);

    const setLanguage = (newLocale) => {
        if(newLocale === locale) {
            return;
        }

        setSelectedLocale(newLocale);
        document.cookie = `NEXT_LOCALE=${newLocale}; path=/; max-age=31536000`;
        router.refresh();
    };

    return (
        <div className="settings-wrapper blog-settings settings-wrapper--narrow">
            <div className="blog-settings__body">
                <p className="blog-settings__field-title">{t("language.title")}</p>
                <div className="settings-language-warning">
                    <div className="settings-language-warning__icon" aria-hidden="true">
                        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-triangle-alert-icon lucide-triangle-alert">
                            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/>
                            <path d="M12 9v4"/>
                            <path d="M12 17h.01"/>
                        </svg>
                    </div>

                    <div>{t("language.notice")}</div>
                </div>

                <p className="settings-language-description">{t("language.description")}</p>

                <div className="settings-language-section">{t("language.standard")}</div>
                <div className="settings-language-list">
                    {languages.map((lang) => (
                        <button key={lang.code} type="button" className={`settings-language-item ${selectedLocale === lang.code ? "is-active" : ""}`} onClick={() => setLanguage(lang.code)}>
                            <span className={`settings-language-radio ${selectedLocale === lang.code ? "is-active" : ""}`} aria-hidden="true"></span>
                            <span className="settings-language-name">{lang.native}</span>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}