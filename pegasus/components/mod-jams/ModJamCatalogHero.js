export default function ModJamCatalogHero({ t, onCreate }) {
	return (
		<section className="mod-jams-catalog-hero">
			<div className="mod-jams-catalog-hero__copy">
				<span className="mod-jams-catalog-hero__eyebrow">{t("eyebrow")}</span>
				
				<h1>{t("title")}</h1>
				
				<p>{t("description")}</p>
				
				<div className="mod-jams-catalog-hero__actions">
					<button className="button button--size-m button--type-secondary button--active-transform button--with-icon" type="button" onClick={onCreate}>
						<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
							<path d="M10 14.66v1.626a2 2 0 0 1-.976 1.696A5 5 0 0 0 7 21.978"></path>
							<path d="M14 14.66v1.626a2 2 0 0 0 .976 1.696A5 5 0 0 1 17 21.978"></path>
							<path d="M18 9h1.5a1 1 0 0 0 0-5H18"></path>
							<path d="M4 22h16"></path>
							<path d="M6 9a6 6 0 0 0 12 0V3a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1z"></path>
							<path d="M6 9H4.5a1 1 0 0 1 0-5H6"></path>
						</svg>
						
						{t("create")}
					</button>
				</div>
			</div>

			<img src="/images/modjam-golem.webp" className="mod-jams-catalog-hero__golem" />

			<img src="/images/modjam-background.svg" className="mod-jams-background" />
		</section>
	);
}