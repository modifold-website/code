"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import UserName from "@/components/ui/UserName";
import Tooltip from "@/components/ui/Tooltip";

function JuryUserCard({ user, roleLabel, tooltip, children }) {
	if(!user?.slug) {
		return null;
	}

	return (
		<div className="author author-card" style={{ "--1ebedaf6": "40px" }}>
			<Link className="author__avatar button--active-transform" href={`/user/${user.slug}`}>
				<div className="andropov-media andropov-media--rounded andropov-media--bordered andropov-media--loaded andropov-media--has-preview andropov-image" style={{ aspectRatio: "1.77778 / 1", width: "40px", height: "40px", maxWidth: "none" }}>
					<img className="magnify" alt={user.username} src={user.avatar || "https://media.modifold.com/static/no-project-icon.svg"} />
				</div>
			</Link>

			<div className="author__main">
				<Link className="author__name" href={`/user/${user.slug}`}>
					<UserName user={user} />
				</Link>
			</div>

			<div className="author__details" style={{ display: "flex", alignItems: "center", overflow: "visible" }}>
				<span>{roleLabel}</span>

				{tooltip && (
					<Tooltip content={tooltip}>
						{children}
					</Tooltip>
				)}
			</div>
		</div>
	);
}

export default function ModJamJuryPanel({ owner, jury = [] }) {
	const t = useTranslations("ModJamsPage");
	const members = Array.isArray(jury) ? jury : [];

	if(!owner && members.length === 0) {
		return null;
	}

	return (
		<div className="content content--padding">
			<h2>{t("jury.title")}</h2>

			<div className="mod-jam-jury-list">
				<JuryUserCard user={owner} roleLabel={t("jury.organizer")} tooltip={t("jury.organizerTooltip")}>
					<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" className="lucide lucide-crown" viewBox="0 0 24 24" style={{ color: "#e08325", verticalAlign: "middle", fill: "none" }}>
						<path d="m2 4 3 12h14l3-12-6 7-4-7-4 7z"></path>
						<path d="M5 20h14"></path>
					</svg>
				</JuryUserCard>

				{members.map((member) => (
					<JuryUserCard key={member.user_id} user={member.user} roleLabel={t("jury.member")} tooltip={t("jury.memberTooltip")}>
						<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" className="lucide lucide-scale" viewBox="0 0 24 24" style={{ color: "var(--theme-color-accent)", verticalAlign: "middle", fill: "none" }}>
							<path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"></path>
							<path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"></path>
							<path d="M7 21h10"></path>
							<path d="M12 3v18"></path>
							<path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"></path>
						</svg>
					</JuryUserCard>
				))}
			</div>
		</div>
	);
}