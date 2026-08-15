"use client";

export default function HomeAnalyticsSection({ t, onPublish }) {
	return (
		<section className="home-creators-section">
			<div className="home-creators-section__copy">
				<span className="home-pill home-pill--creators">{t("creatorSection.badge")}</span>
				
				<h2 className="home-section-title">{t("creatorSection.title")}</h2>
				
				<p className="home-section-lead">{t("creatorSection.lead")}</p>

				<button className="button button--size-xl button--type-primary button--with-icon button--active-transform" type="button" onClick={onPublish}>
					<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
						<path d="M12 3v12"/>
						<path d="m17 8-5-5-5 5"/>
						<path d="M5 21h14"/>
					</svg>
					
					{t("analyticsSection.cta")}
				</button>
			</div>

			<div className="home-creator-tools">
				<div className="home-creator-tool">
					<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
						<path d="M15 6a9 9 0 0 0-9 9V3"/>
						<circle cx="18" cy="6" r="3"/>
						<circle cx="6" cy="18" r="3"/>
					</svg>

					<div>
						<h3>{t("creatorCards.versions.title")}</h3>
						
						<p>{t("creatorCards.versions.description")}</p>
					</div>
				</div>

				<div className="home-creator-tool">
					<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
						<path d="M18 21a8 8 0 0 0-16 0"/>
						<circle cx="10" cy="8" r="5"/>
						<path d="M22 20c0-3.37-2-5.5-4-8a5 5 0 0 0-.45-8.3"/>
					</svg>

					<div>
						<h3>{t("creatorCards.team.title")}</h3>

						<p>{t("creatorCards.team.description")}</p>
					</div>
				</div>

				<div className="home-creator-tool">
					<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
						<path d="M3 3v18h18"/>
						<path d="m19 9-5 5-4-4-3 3"/>
					</svg>

					<div>
						<h3>{t("analyticsSection.title")}</h3>
						
						<p>{t("analyticsSection.lead")}</p>
					</div>
				</div>
			</div>
		</section>
	);
}