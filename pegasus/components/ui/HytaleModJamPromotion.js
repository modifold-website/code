"use client";

import CountUp from "react-countup";
import { useTranslations } from "next-intl";

export const HYTALE_MODJAM_PROMO_SLIDE = {
	type: "hytale-modjam-promo",
	item: {
		id: "hytale-modjam-2026",
	},
};

export default function HytaleModJamPromotion({ variant = "home" }) {
	const t = useTranslations("HytaleModJamPromotion");

	const cta = (
		<a className="hytale-modjam-promo__cta button--active-transform" href="https://hytalemodjam.com/" target="_blank" rel="noopener noreferrer">
			{t("cta")}

			<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
				<path d="M7 7h10v10" />
				<path d="M7 17 17 7" />
			</svg>
		</a>
	);

	return (
		<div className={`hytale-modjam-promo hytale-modjam-promo--${variant}`} aria-label={t("ariaLabel")}>
			<div className="hytale-modjam-promo__frame">
				<img className="hytale-modjam-promo__background" src="/images/hytale-modjam-background.jpg" alt="" loading={variant === "home" ? "lazy" : "eager"} />
				
				<div className="hytale-modjam-promo__shade" />

				<div className="hytale-modjam-promo__content">
					<div className="hytale-modjam-promo__main">
						<div className="hytale-modjam-promo__logos" aria-label={t("logosLabel")}>
							<img className="hytale-modjam-promo__logo hytale-modjam-promo__logo--hytale" src="/images/hytale-modjam-hytale-logo.png" alt={t("hytaleLogoAlt")} />
							
							<svg className="hytale-modjam-promo__logo-x" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
								<path d="M18 6 6 18" />
								<path d="m6 6 12 12" />
							</svg>

							<img className="hytale-modjam-promo__logo hytale-modjam-promo__logo--modding" src="/images/hytale-modjam-hytalemodding-logo.svg" alt={t("hytaleModdingLogoAlt")} />
						</div>

						<div className="hytale-modjam-promo__copy">
							<h2>{t("title")}</h2>

							<p>{t("description")}</p>
						</div>

						{variant === "rail" && (
							<div className="hytale-modjam-promo__actions">
								{cta}
							</div>
						)}
					</div>

					<div className="hytale-modjam-promo__aside">
						<div className="hytale-modjam-promo__prize">
							<span>{t("prizeLabel")}</span>

							<strong aria-label={t("prizeAmount")}>
								<span className="hytale-modjam-promo__prize-currency">$</span>
								<CountUp start={0} end={5000} duration={1.8} separator="," />
							</strong>
						</div>

						{variant !== "rail" && cta}
					</div>
				</div>
			</div>
		</div>
	);
}