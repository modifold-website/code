"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";

function formatDate(value, locale, hideCurrentYear = false) {
	if(!value) {
		return "";
	}

	const date = new Date(value);
	const formatOptions = { day: "numeric", month: "short" };

	if(!hideCurrentYear || date.getFullYear() !== new Date().getFullYear()) {
		formatOptions.year = "numeric";
	}

	return new Intl.DateTimeFormat(locale, formatOptions).format(date);
}

export default function ModJamCard({ jam }) {
	const locale = useLocale();
	const t = useTranslations("ModJamsPage");

	return (
		<div className="media-project-card">
			<Link className="media-project-card__overlay" href={`/jams/${jam.slug}`}></Link>
			
			<div className="media-project-cover">
				{jam.cover_url ? <img src={jam.cover_url} loading="lazy" alt="" /> : null}
			</div>

			<div className="media-project-body">
				<div className="media-project-header" style={{ marginBottom: "24px" }}>
					<img className="media-project-icon" src={jam.avatar_url || "https://media.modifold.com/static/no-project-icon.svg"} alt="" />
					
					<div className="media-project-header-text">
						<div className="media-project-title-row">
							<span className="media-project-title">{jam.title}</span>
						</div>

						<p className="media-project-description" style={{ "-webkit-line-clamp": "3" }}>{jam.summary}</p>
					</div>
				</div>

				<div className="media-project-stats">
					<div className="media-project-stat">
						<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
							<path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/>
							<path d="m3.3 7 8.7 5 8.7-5"/>
							<path d="M12 22V12"/>
						</svg>

						<span>{Number(jam.submissions_count) || 0}</span>
					</div>

					<div className="media-project-stat">
						<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
							<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
							<circle cx="9" cy="7" r="4"></circle>
							<path d="M22 21v-2a4 4 0 0 0-3-3.87"></path>
							<path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
						</svg>

						<span>{Number(jam.participants_count) || 0}</span>
					</div>

					<div className="media-project-stat media-project-updated">
						<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" viewBox="0 0 24 24" className="lucide lucide-heart-icon lucide-update">
							<path d="M3 3v5h5"></path>
							<path d="M3.05 13A9 9 0 1 0 6 5.3L3 8"></path>
							<path d="M12 7v5l4 2"></path>
						</svg>

						<span>{formatDate(jam.starts_at, locale, true)} — {formatDate(jam.voting_end_at, locale, true)}</span>
					</div>
				</div>

				<button className="button button--size-m button--type-minimal button--active-transform button--with-icon">
					<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon lucide lucide-plus-icon lucide-plus">
						<path d="M5 12h14"></path>
						<path d="M12 5v14"></path>
					</svg>

					{t("participate")}
				</button>
			</div>
		</div>
	);
}