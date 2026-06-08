"use client";

import { useLocale, useTranslations } from "next-intl";

function formatTimelineDate(value, now, locale, separator) {
	if(!value) {
		return "";
	}

	const date = new Date(value);
	if(Number.isNaN(date.getTime())) {
		return "";
	}

	const currentDate = new Date(now);
	const isCurrentYear = date.getFullYear() === currentDate.getFullYear();
	const dateText = new Intl.DateTimeFormat(locale, {
		day: "numeric",
		month: "long",
		year: isCurrentYear ? undefined : "numeric",
	}).format(date);
	const timeText = new Intl.DateTimeFormat(locale, {
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
	}).format(date);
	return `${dateText}${separator}${timeText}`;
}

function getTimelineProgress(milestones, now) {
	if(milestones.some((time) => !Number.isFinite(time)) || milestones[milestones.length - 1] <= milestones[0]) {
		return 0;
	}

	if(now <= milestones[0]) {
		return 0;
	}

	if(now >= milestones[milestones.length - 1]) {
		return 100;
	}

	for(let index = 0; index < milestones.length - 1; index++) {
		const current = milestones[index];
		const next = milestones[index + 1];

		if(now < next) {
			const segmentProgress = next > current ? (now - current) / (next - current) : 1;
			return ((index + segmentProgress) / (milestones.length - 1)) * 100;
		}
	}

	return 100;
}

export default function ModJamTimeline({ jam }) {
	const t = useTranslations("ModJamsPage");
	const locale = useLocale();
	const now = Date.now();
	const dateTimeSeparator = t("timeline.dateTimeSeparator");
	const submissionsStartsAt = jam.submissions_start_at || jam.starts_at;
	const votingStartsAt = jam.voting_starts_at || jam.submissions_end_at;
	const startTime = new Date(jam.starts_at).getTime();
	const submissionsStartTime = new Date(submissionsStartsAt).getTime();
	const submissionsTime = new Date(jam.submissions_end_at).getTime();
	const votingStartTime = new Date(votingStartsAt).getTime();
	const votingTime = new Date(jam.voting_end_at).getTime();
	const milestones = [startTime, submissionsStartTime, submissionsTime, votingStartTime, votingTime];
	const progress = getTimelineProgress(milestones, now);
	const getStepClassName = (index, extraClassName = "") => {
		const isReached = Number.isFinite(milestones[index]) && now >= milestones[index];
		return `mod-jam-timeline__step ${extraClassName} ${isReached ? "mod-jam-timeline__step--reached" : ""}`.trim();
	};
	const getStepStyle = (index) => ({
		"--step-position": `${(index / (milestones.length - 1)) * 100}%`,
	});

	return (
		<section className="mod-jam-timeline" aria-label={t("timeline.ariaLabel")}>
			<div className="mod-jam-timeline__track" style={{ "--progress": `${progress}%` }}>
				<div className="mod-jam-timeline__rail"></div>
				<div className="mod-jam-timeline__fill"></div>

				<div className={getStepClassName(0, "mod-jam-timeline__step--edge-start")} style={getStepStyle(0)}>
					<span className="mod-jam-timeline__dot"></span>
					<span className="mod-jam-timeline__copy">
						<strong>{t("timeline.steps.start")}</strong>
						<small>{formatTimelineDate(jam.starts_at, now, locale, dateTimeSeparator)}</small>
					</span>
				</div>

				<div className={getStepClassName(1)} style={getStepStyle(1)}>
					<span className="mod-jam-timeline__dot"></span>
					<span className="mod-jam-timeline__copy">
						<strong>{t("timeline.steps.submissionsOpen")}</strong>
						<small>{formatTimelineDate(submissionsStartsAt, now, locale, dateTimeSeparator)}</small>
					</span>
				</div>

				<div className={getStepClassName(2)} style={getStepStyle(2)}>
					<span className="mod-jam-timeline__dot"></span>
					<span className="mod-jam-timeline__copy">
						<strong>{t("timeline.steps.submissionsClose")}</strong>
						<small>{formatTimelineDate(jam.submissions_end_at, now, locale, dateTimeSeparator)}</small>
					</span>
				</div>

				<div className={getStepClassName(3)} style={getStepStyle(3)}>
					<span className="mod-jam-timeline__dot"></span>
					<span className="mod-jam-timeline__copy">
						<strong>{t("timeline.steps.votingOpen")}</strong>
						<small>{formatTimelineDate(votingStartsAt, now, locale, dateTimeSeparator)}</small>
					</span>
				</div>

				<div className={getStepClassName(4, "mod-jam-timeline__step--edge-end")} style={getStepStyle(4)}>
					<span className="mod-jam-timeline__dot"></span>
					<span className="mod-jam-timeline__copy">
						<strong>{t("timeline.steps.winnersAnnounced")}</strong>
						<small>{formatTimelineDate(jam.voting_end_at, now, locale, dateTimeSeparator)}</small>
					</span>
				</div>
			</div>
		</section>
	);
}