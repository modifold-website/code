"use client";

import { useLocale, useTranslations } from "next-intl";
import Tooltip from "@/components/ui/Tooltip";

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

const formatAchievementDate = (timestamp, locale) => {
    const numericTimestamp = Number(timestamp);
    const date = Number.isFinite(numericTimestamp) && numericTimestamp > 0 ? new Date(numericTimestamp * 1000) : null;

    if(!date || Number.isNaN(date.getTime())) {
        return null;
    }

    return new Intl.DateTimeFormat(locale, getDateFormatOptions(date)).format(date);
};

export default function ProfileAchievements({ achievements = [], isBanned = false }) {
    const t = useTranslations("ProfilePage");
    const locale = useLocale();
    const visibleAchievements = isBanned ? [] : (Array.isArray(achievements) ? achievements : []);

    if(visibleAchievements.length === 0) {
        return null;
    }

    const getTranslatedAchievementField = (achievement, field) => {
        const code = typeof achievement?.code === "string" ? achievement.code.trim() : "";
        const key = code ? `achievements.items.${code}.${field}` : "";

        if(key && typeof t.has === "function" && t.has(key)) {
            return t(key);
        }

        return null;
    };

    const getAchievementTitle = (achievement) => {
        return getTranslatedAchievementField(achievement, "title") || achievement?.name || t("achievements.customTitle");
    };

    const getAchievementDescription = (achievement) => {
        return getTranslatedAchievementField(achievement, "description") || achievement?.description || achievement?.note || t("achievements.customDescription");
    };

    const getAchievementTooltip = (achievement) => {
        const title = getAchievementTitle(achievement);
        const description = getAchievementDescription(achievement);
        const awardedDate = formatAchievementDate(achievement?.awarded_at, locale);

        return (
            <span className="subsite-achievement-tooltip">
                <strong>{title}</strong>
                
                <span>{description}</span>

                {awardedDate && <span>{t("achievements.receivedAt", { date: awardedDate })}</span>}
            </span>
        );
    };

    return (
        <div className="content content--padding subsite-achievements">
            <h2>{t("achievements.title")}</h2>

            <div className="subsite-achievements__grid">
                {visibleAchievements.map((achievement) => {
                    const title = getAchievementTitle(achievement);
                    const iconUrl = achievement.icon_url || "/badges/creator.webp";

                    return (
                        <Tooltip key={achievement.id || achievement.code} content={getAchievementTooltip(achievement)}>
                            <span className="subsite-achievements__item" tabIndex={0}>
                                <img src={iconUrl} alt={title} width="56" height="56" />
                            </span>
                        </Tooltip>
                    );
                })}
            </div>
        </div>
    );
}