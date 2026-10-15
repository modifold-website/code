"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import Tooltip from "@/components/ui/Tooltip";
import AchievementDetailsModal from "@/modal/AchievementDetailsModal";
import { getProfileBadge } from "@/utils/profileBadges";

const ACHIEVEMENT_LINKS = {
	hytalemodjam_2026: { href: "https://hytalemodjam.com/submissions?modjam=hm-26.2", site: "Hytale ModJam" },
	hytalemodding: { href: "https://hytalemodding.dev/", site: "HytaleModding" },
};

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
	const [selectedAchievementId, setSelectedAchievementId] = useState(null);
	const [isDetailsOpen, setIsDetailsOpen] = useState(false);
	const visibleAchievements = isBanned ? [] : (Array.isArray(achievements) ? achievements : []);
	const selectedAchievement = visibleAchievements.find((achievement) => (achievement.id || achievement.code) === selectedAchievementId);
	const selectedLink = ACHIEVEMENT_LINKS[selectedAchievement?.code] || null;

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
		const awardedDate = formatAchievementDate(achievement?.awarded_at, locale);

		return (
			<span className="subsite-achievement-tooltip">
				<strong>{title}</strong>

				{awardedDate && <span>{t("achievements.receivedAt", { date: awardedDate })}</span>}
			</span>
		);
	};

	return (
		<>
			<div className="content content--padding subsite-achievements">
				<h2>{t("achievements.title")}</h2>

				<div className="subsite-achievements__grid">
					{visibleAchievements.map((achievement) => {
						const title = getAchievementTitle(achievement);
						const iconUrl = achievement.icon_url || getProfileBadge(achievement.code)?.icon || "/badges/creator.webp";

						return (
							<Tooltip key={achievement.id || achievement.code} content={getAchievementTooltip(achievement)}>
								<button className="subsite-achievements__item" type="button" aria-label={title} aria-haspopup="dialog" onClick={() => {
									setSelectedAchievementId(achievement.id || achievement.code);
									setIsDetailsOpen(true);
								}}>
									<img src={iconUrl} alt="" width="56" height="56" />
								</button>
							</Tooltip>
						);
					})}
				</div>
			</div>

			<AchievementDetailsModal
				isOpen={isDetailsOpen && Boolean(selectedAchievement)}
				onRequestClose={() => setIsDetailsOpen(false)}
				title={getAchievementTitle(selectedAchievement)}
				description={getAchievementDescription(selectedAchievement)}
				iconUrl={selectedAchievement?.icon_url || getProfileBadge(selectedAchievement?.code)?.icon || "/badges/creator.webp"}
				awardedDate={formatAchievementDate(selectedAchievement?.awarded_at, locale)}
				link={selectedLink}
				t={t}
			/>
		</>
	);
}