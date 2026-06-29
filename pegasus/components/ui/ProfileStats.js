"use client";

import { useLocale, useTranslations } from "next-intl";
import Tooltip from "@/components/ui/Tooltip";

const formatFullNumber = (num, locale) => new Intl.NumberFormat(locale).format(Math.max(0, Number(num) || 0));

const getDateFormatOptions = (date) => {
    const now = new Date();
    const options = {
        day: "numeric",
        month: "long",
    };

    if(date.getFullYear() !== now.getFullYear()) {
        options.year = "numeric";
    }

    return options;
};

const formatJoinedDate = (timestamp, locale) => {
    const date = new Date(timestamp);
    return new Intl.DateTimeFormat(locale, getDateFormatOptions(date)).format(date);
};

const formatJoinedTooltip = (timestamp, locale) => {
    const date = new Date(timestamp);

    return new Intl.DateTimeFormat(locale, {
        ...getDateFormatOptions(date),
        hour: "2-digit",
        minute: "2-digit",
    }).format(date);
};

export default function ProfileStats({ projectsCount = 0, downloadsCount = 0, subscribersCount = 0, subscriptionsCount = 0, timestamp, onOpenFollowModal }) {
    const t = useTranslations("ProfilePage");
    const locale = useLocale();

    return (
        <>
            <div className="profile-stats">
                <Tooltip content={t("publishedProjectsTooltip")}>
                    <button type="button" className="profile-stat profile-stat--disabled" disabled>
                        <span className="profile-stat__icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"></path>
                                <path d="m3.3 7 8.7 5 8.7-5"></path>
                                <path d="M12 22V12"></path>
                            </svg>
                        </span>
                        
                        <span className="profile-stat__value">{formatFullNumber(projectsCount, locale)}</span>
                        
                        <span className="profile-stat__label">{t("projectsLabel", { count: projectsCount })}</span>
                    </button>
                </Tooltip>

                <Tooltip content={t("downloadsTooltip")}>
                    <button type="button" className="profile-stat profile-stat--disabled" disabled>
                        <span className="profile-stat__icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <path d="M12 15V3"></path>
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                <path d="m7 10 5 5 5-5"></path>
                            </svg>
                        </span>

                        <span className="profile-stat__value">{formatFullNumber(downloadsCount, locale)}</span>
                        
                        <span className="profile-stat__label">{t("downloadsLabel", { count: downloadsCount })}</span>
                    </button>
                </Tooltip>

                <button type="button" className={`profile-stat ${subscribersCount < 1 ? "profile-stat--disabled" : ""}`} onClick={() => onOpenFollowModal?.("subscribers")} disabled={subscribersCount < 1}>
                    <span className="profile-stat__icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
                            <path d="M16 3.128a4 4 0 0 1 0 7.744"></path>
                            <path d="M22 21v-2a4 4 0 0 0-3-3.87"></path>
                            <circle cx="9" cy="7" r="4"></circle>
                        </svg>
                    </span>
                    
                    <span className="profile-stat__value">{formatFullNumber(subscribersCount, locale)}</span>
                    
                    <span className="profile-stat__label">{t("subscribersLabel", { count: subscribersCount })}</span>
                </button>

                <button type="button" className={`profile-stat ${subscriptionsCount < 1 ? "profile-stat--disabled" : ""}`} onClick={() => onOpenFollowModal?.("subscriptions")} disabled={subscriptionsCount < 1}>
                    <span className="profile-stat__icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M2 21a8 8 0 0 1 13.292-6"></path>
                            <circle cx="10" cy="8" r="5"></circle>
                            <path d="M19 16v6"></path>
                            <path d="M22 19h-6"></path>
                        </svg>
                    </span>
                    
                    <span className="profile-stat__value">{formatFullNumber(subscriptionsCount, locale)}</span>
                    
                    <span className="profile-stat__label">{t("subscriptionsLabel", { count: subscriptionsCount })}</span>
                </button>
            </div>

            <Tooltip content={formatJoinedTooltip(timestamp, locale)}>
                <div className="profile-reg_date">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M8 2v4"></path>
                        <path d="M16 2v4"></path>
                        <rect width="18" height="18" x="3" y="4" rx="2"></rect>
                        <path d="M3 10h18"></path>
                    </svg>

                    <span>{t("registrationDate", { date: formatJoinedDate(timestamp, locale) })}</span>
                </div>
            </Tooltip>
        </>
    );
}