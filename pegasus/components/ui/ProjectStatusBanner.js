"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

export default function ProjectStatusBanner({ type, settingsHref }) {
    const t = useTranslations("ProjectPage.statusBanner");

    return (
        <div className={`project-status-banner project-status-banner--${type}`}>
            <div className="project-status-banner__icon" aria-hidden="true">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-triangle-alert-icon lucide-triangle-alert">
                    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"></path>
                    <path d="M12 9v4"></path>
                    <path d="M12 17h.01"></path>
                </svg>
            </div>

            <div className="project-status-banner__content">
                <h2 className="project-status-banner__title">{t(`${type}.title`)}</h2>

                <p className="project-status-banner__text">{t(`${type}.description`)}</p>
                
                <Link href={settingsHref} className="button button--size-m button--type-secondary button--active-transform button--with-icon project-status-banner__link">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon lucide lucide-plus-icon lucide-plus">
                        <path d="M5 12h14"></path>
                        <path d="M12 5v14"></path>
                    </svg>
                    
                    {t(`${type}.action`)}
                </Link>
            </div>
        </div>
    );
}