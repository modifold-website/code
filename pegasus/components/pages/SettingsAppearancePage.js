"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

const applyTheme = (nextTheme) => {
    const resolvedTheme = nextTheme === "system" ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : nextTheme === "dark" ? "dark" : "light";

    document.body.classList.remove("light", "dark", "system");
    document.body.classList.add(resolvedTheme);
    document.body.dataset.themePreference = nextTheme;
};

const getSavedTheme = () => {
    const cookies = document.cookie.split("; ").reduce((acc, cookie) => {
        const [rawName, ...rest] = cookie.split("=");
        const name = rawName?.trim();
        if(!name) {
            return acc;
        }

        acc[name] = decodeURIComponent(rest.join("=") || "");
        return acc;
    }, {});

    const themeFromDataset = document.body?.dataset?.themePreference;
    const savedTheme = cookies.theme === "dark" || cookies.theme === "light" || cookies.theme === "system" ? cookies.theme : themeFromDataset === "dark" || themeFromDataset === "light" || themeFromDataset === "system" ? themeFromDataset : "light";

    return savedTheme;
};

export default function SettingsAppearancePage() {
    const t = useTranslations("SettingsBlogPage");
    const tHeader = useTranslations("Header");
    const [theme, setThemeState] = useState("system");

    useEffect(() => {
        const savedTheme = getSavedTheme();
        setThemeState(savedTheme);
        applyTheme(savedTheme);
    }, []);

    const setTheme = (nextTheme) => {
        setThemeState(nextTheme);
        applyTheme(nextTheme);
        document.cookie = `theme=${nextTheme}; path=/; max-age=31536000; samesite=lax`;
    };

    return (
        <div className="settings-wrapper blog-settings settings-wrapper--narrow">
            <div className="blog-settings__body">
                <p className="blog-settings__field-title">{t("appearance.title")}</p>
                <p style={{ marginBottom: "14px", color: "var(--theme-color-text-secondary)" }}>{t("appearance.description")}</p>

                <div className="settings-theme-grid">
                    <button type="button" className={`settings-theme-card ${theme === "system" ? "is-active" : ""}`} onClick={() => setTheme("system")}>
                        <div className="settings-theme-preview settings-theme-preview--system">
                            <div className="skeleton-square" style={{ width: "34px", height: "34px", borderRadius: "8px" }}></div>
                            
                            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                <div className="skeleton-bar" style={{ width: "96px", height: "10px" }}></div>
                                <div className="skeleton-bar" style={{ width: "50px", height: "10px" }}></div>
                            </div>
                        </div>

                        <div className="settings-theme-label">{tHeader("theme.system")}</div>
                    </button>

                    <button type="button" className={`settings-theme-card ${theme === "light" ? "is-active" : ""}`} onClick={() => setTheme("light")}>
                        <div className="settings-theme-preview settings-theme-preview--light">
                            <div className="skeleton-square" style={{ width: "34px", height: "34px", borderRadius: "8px" }}></div>
                            
                            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                <div className="skeleton-bar" style={{ width: "96px", height: "10px" }}></div>
                                <div className="skeleton-bar" style={{ width: "50px", height: "10px" }}></div>
                            </div>
                        </div>

                        <div className="settings-theme-label">{tHeader("theme.light")}</div>
                    </button>

                    <button type="button" className={`settings-theme-card ${theme === "dark" ? "is-active" : ""}`} onClick={() => setTheme("dark")}>
                        <div className="settings-theme-preview settings-theme-preview--dark">
                            <div className="skeleton-square" style={{ width: "34px", height: "34px", borderRadius: "8px" }}></div>
                            
                            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                <div className="skeleton-bar" style={{ width: "96px", height: "10px" }}></div>
                                <div className="skeleton-bar" style={{ width: "50px", height: "10px" }}></div>
                            </div>
                        </div>

                        <div className="settings-theme-label">{tHeader("theme.dark")}</div>
                    </button>
                </div>
            </div>
        </div>
    );
}