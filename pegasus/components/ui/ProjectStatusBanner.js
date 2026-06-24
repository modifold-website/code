"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

export default function ProjectStatusBanner({ type, settingsHref }) {
    const t = useTranslations("ProjectPage.statusBanner");

    return (
        <div className={`project-status-banner project-status-banner--${type}`}>
            <div className="project-status-banner__icon" aria-hidden="true">
                <svg className="icon icon--settings" height="24" width="24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m3 6 3 1m0 0-3 9a5 5 0 0 0 6.001 0M6 7l3 9M6 7l6-2m6 2 3-1m-3 1-3 9a5 5 0 0 0 6.001 0M18 7l3 9m-3-9-6-2m0-2v2m0 16V5m0 16H9m3 0h3"></path>
                </svg>
            </div>

            <div className="project-status-banner__content">
                <h2 className="project-status-banner__title">{t(`${type}.title`)}</h2>

                <p className="project-status-banner__text">{t(`${type}.description`)}</p>
                
                <Link href={settingsHref} className="button button--size-m button--type-secondary button--active-transform button--with-icon project-status-banner__link">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon lucide lucide-arrow-up-right-icon lucide-arrow-up-right">
                        <path d="M7 7h10v10"/>
                        <path d="M7 17 17 7"/>
                    </svg>
                    
                    {t(`${type}.action`)}
                </Link>
            </div>
        </div>
    );
}