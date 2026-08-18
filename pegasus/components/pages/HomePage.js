"use client";

import Link from "next/link";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import LoginModal from "@/modal/LoginModal";
import ProjectCreationModal from "@/modal/ProjectCreationModal";
import { useAuth } from "@/components/providers/AuthProvider";
import HomeAnalyticsSection from "@/components/ui/HomeAnalyticsSection";
import DiscoverProjectRail from "@/components/pages/discover/DiscoverProjectRail";
import PopularCategories from "@/components/pages/discover/PopularCategories";

function formatNewsDate(dateString, locale) {
	const date = new Date(dateString);
	const options = {
		month: "long",
		day: "numeric",
	};

	if(date.getFullYear() !== new Date().getFullYear()) {
		options.year = "numeric";
	}

	return date.toLocaleDateString(locale, options);
}

function HytaleWordmark() {
	return (
		<svg className="hero-title__wordmark" viewBox="0 0 195 70" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
			<g clipPath="url(#hytale-wordmark-clip)">
				<path d="M178.098 34.7872H185.799L188.634 27.0993H178.098V22.527H191.442L194.929 13.0466L168.465 13.0811V48.8069H193.883V39.3265H178.098V34.7872Z" fill="currentColor"/>
				<path d="M153.143 38.3219V13.0825H139.562L141.764 17.1769V48.8069H167.11L163.191 38.3219H153.143Z" fill="currentColor"/>
				<path d="M129.722 13.0781L110.737 13.1154L112.202 15.8594L99.9688 48.8068H111.531L113.213 44.1068H126.896L128.77 48.8068H140.343L128.207 15.8637L129.724 13.0781H129.722ZM116.495 34.6264L120.163 24.041L123.876 34.6264H116.494H116.495Z" fill="currentColor"/>
				<path d="M106.189 13.0781H67.1448L60.25 27.9029L53.3567 13.0781L53.3394 13.1327L53.3163 13.0781H41.8438L54.4243 40.4343L50.4972 48.8757H62.4156L75.8401 19.9896L77.2353 23.4196L83.8011 23.4224V48.8958H95.6185V23.4196H102.205L106.189 13.0781Z" fill="currentColor"/>
				<path d="M28.1882 -0.008584V22.5141L18.571 22.4912L18.3806 -0.0458984L-0.015625 2.62198L5.84762 13.4342L5.85338 49.2561L18.5191 58.4179L18.5263 33.3277L28.0151 33.3665V68.501L40.6173 59.3794V13.4456L46.4964 2.65069L28.1882 -0.008584Z" fill="currentColor"/>
			</g>

			<defs>
				<clipPath id="hytale-wordmark-clip">
					<rect width="194.912" height="69.4596" fill="currentColor"/>
				</clipPath>
			</defs>
		</svg>
	);
}

export default function HomePage({ news = [], locale, discoverData = null, authToken = null }) {
	const t = useTranslations("HomePage");
	const tDiscover = useTranslations("DiscoverPage");
	const tCategoryLabels = useTranslations("CategoryLabels");
	const { isLoggedIn } = useAuth();
	const activeLocale = useLocale();
	const currentLocale = activeLocale || locale || "en";
	const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
	const [isProjectCreationModalOpen, setIsProjectCreationModalOpen] = useState(false);
	const weeklyPopular = discoverData?.weeklyPopular || [];
	const recentlyUpdated = discoverData?.recentlyUpdated || [];
	const popularCategories = discoverData?.popularCategories || [];
	const hytaleToken = "__HYTALE__";
	const heroTitle = t("heroTitle", { hytale: hytaleToken });
	const heroTitleLabel = t("heroTitle", { hytale: "Hytale" });
	const [heroTitleBefore, heroTitleAfter] = heroTitle.split(hytaleToken);
	const heroHasToken = heroTitle.includes(hytaleToken);

	const handlePublishProject = () => {
		if(isLoggedIn) {
			setIsLoginModalOpen(false);
			setIsProjectCreationModalOpen(true);
			return;
		}

		setIsProjectCreationModalOpen(false);
		setIsLoginModalOpen(true);
	};
	const closeModals = () => {
		setIsLoginModalOpen(false);
		setIsProjectCreationModalOpen(false);
	};

	return (
		<>
			<img src="/images/background-home.webp" className="fixed-background-teleport" alt="" />

			<main className="layout home-page">
				<section className="hero-section">
					<div className="hero-container">
						<div className="hero-content animated">
							<svg className="hero-logo" width="710" height="802" viewBox="0 0 710 802" fill="none" xmlns="http://www.w3.org/2000/svg">
								<path d="M347.578 2.0083C352.164 -0.669477 357.835 -0.669387 362.421 2.0083L702.7 200.728C707.22 203.368 710 208.209 710 213.446V590.725C710 595.988 707.193 600.85 702.638 603.481L362.36 800.027C357.805 802.657 352.193 802.658 347.639 800.027L7.36041 603.481C2.80578 600.85 0 595.988 0 590.725V213.446C0.000100346 208.209 2.77944 203.368 7.29959 200.728L347.578 2.0083ZM39.2283 227.081V577.138L355.002 760.096L670.775 577.138V227.081L355.002 41.8568L39.2283 227.081ZM634.49 245.207V560.145L355.002 719.313L75.5127 560.145V245.207L355.002 82.6402L634.49 245.207ZM112.673 541.452L340.28 671.732V414.571L112.673 285.424V541.452ZM373.118 414.946V670.6L599.593 541.084V284.291L373.118 414.946ZM316.5 584.505V625.48L282.529 606.029V565.246L316.5 584.505ZM429.737 606.028L395.766 625.479V584.504L429.737 565.245V606.028ZM171.556 502.938V543.722L136.453 524.463V483.679L171.556 502.938ZM575.813 524.462L540.709 543.72V502.937L575.813 483.678V524.462ZM255.352 444.029V519.931L191.939 484.812V408.91L255.352 444.029ZM520.327 484.811L456.914 519.93V444.028L520.327 408.909V484.811ZM317.632 433.833V476.882L282.529 457.623V414.574L317.632 433.833ZM429.737 457.622L394.634 476.881V433.832L429.737 414.573V457.622ZM171.556 354.532V395.315L136.453 376.057V335.273L171.556 354.532ZM575.813 376.056L540.709 395.314V354.531L575.813 335.272V376.056Z" fill="currentColor"/>
							</svg>

							<h1 className="hero-title" aria-label={heroTitleLabel}>
								{heroHasToken ? (
									<>
										{heroTitleBefore}
										<HytaleWordmark/>
										{heroTitleAfter}
									</>
								) : heroTitle}
							</h1>

							<p className="hero-description">{t("heroDescription")}</p>

							<div className="hero-actions">
								<Link href="/discover" className="button button--size-xl button--type-primary button--with-icon button--active-transform">
									<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
										<circle cx="12" cy="12" r="10"/>
										<path d="m16.24 7.76-1.804 5.411a2 2 0 0 1-1.265 1.265L7.76 16.24l1.804-5.411a2 2 0 0 1 1.265-1.265z"/>
									</svg>

									{t("exploreMods")}
								</Link>

								{isLoggedIn ? (
									<Link href="/dashboard" className="button button--size-xl button--type-secondary button--with-icon button--active-transform">
										<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
											<rect width="7" height="18" x="3" y="3" rx="1"/>
											<rect width="7" height="7" x="14" y="3" rx="1"/>
											<rect width="7" height="7" x="14" y="14" rx="1"/>
										</svg>

										{t("dashboardCta")}
									</Link>
								) : (
									<button className="button button--size-xl button--type-secondary button--with-icon button--active-transform" type="button" onClick={() => setIsLoginModalOpen(true)}>
										<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
											<path d="m10 17 5-5-5-5"/>
											<path d="M15 12H3"/>
											<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
										</svg>

										{t("loginCta")}
									</button>
								)}
							</div>
						</div>
					</div>
				</section>

				<section className="home-discovery-section">
					<div className="home-section-intro">
						<span className="home-pill home-pill--players">{t("discovery.badge")}</span>
						
						<h2 className="home-section-title">{t("discovery.title")}</h2>
						
						<p className="home-section-lead">{t("discovery.lead")}</p>
					</div>

					<div className="home-discovery-section__content">
						<DiscoverProjectRail title={t("discovery.popularTitle")} titleIcon={<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M16 7h6v6"/><path d="m22 7-8.5 8.5-5-5L2 17"/></svg>} projects={weeklyPopular.slice(0, 10)} t={tDiscover} tCategoryLabels={tCategoryLabels} viewAllHref="/discover" />
						<DiscoverProjectRail title={t("discovery.updatedTitle")} titleIcon={<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M8 16H3v5"/></svg>} projects={recentlyUpdated.slice(0, 10)} t={tDiscover} tCategoryLabels={tCategoryLabels} viewAllHref="/discover" />
						<PopularCategories categories={popularCategories.slice(0, 6)} tCategoryLabels={tCategoryLabels} t={tDiscover} />
					</div>
				</section>

				<section className="home-player-tools">
					<div className="home-section-intro">
						<span className="home-pill home-pill--notifications">{t("playerTools.badge")}</span>
						
						<h2 className="home-section-title">{t("playerTools.title")}</h2>
						
						<p className="home-section-lead">{t("playerTools.lead")}</p>
					</div>

					<div className="home-player-tools__grid">
						<article className="home-player-tool">
							<span className="home-api-showcase__marker home-api-showcase__marker--top-left" aria-hidden="true"/>
							<span className="home-api-showcase__marker home-api-showcase__marker--bottom-left" aria-hidden="true"/>
							<span className="home-api-showcase__marker home-api-showcase__marker--top-right" aria-hidden="true"/>
							<span className="home-api-showcase__marker home-api-showcase__marker--bottom-right" aria-hidden="true"/>
							
							<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
								<path d="M12 3v12"/>
								<path d="m8 11 4 4 4-4"/>
								<path d="M5 21h14"/>
							</svg>

							<h3>{t("playerTools.versionsTitle")}</h3>
							
							<p>{t("playerTools.versionsText")}</p>
						</article>

						<article className="home-player-tool">
							<span className="home-api-showcase__marker home-api-showcase__marker--top-left" aria-hidden="true"/>
							<span className="home-api-showcase__marker home-api-showcase__marker--bottom-left" aria-hidden="true"/>
							<span className="home-api-showcase__marker home-api-showcase__marker--top-right" aria-hidden="true"/>
							<span className="home-api-showcase__marker home-api-showcase__marker--bottom-right" aria-hidden="true"/>
							
							<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
								<path d="M4 21v-7"/>
								<path d="M4 10V3"/>
								<path d="M12 21v-9"/>
								<path d="M12 8V3"/>
								<path d="M20 21v-5"/>
								<path d="M20 12V3"/>
								<path d="M1 14h6"/>
								<path d="M9 8h6"/>
								<path d="M17 16h6"/>
							</svg>

							<h3>{t("playerTools.filtersTitle")}</h3>
							
							<p>{t("playerTools.filtersText")}</p>
						</article>

						<article className="home-player-tool">
							<span className="home-api-showcase__marker home-api-showcase__marker--top-left" aria-hidden="true"/>
							<span className="home-api-showcase__marker home-api-showcase__marker--bottom-left" aria-hidden="true"/>
							<span className="home-api-showcase__marker home-api-showcase__marker--top-right" aria-hidden="true"/>
							<span className="home-api-showcase__marker home-api-showcase__marker--bottom-right" aria-hidden="true"/>
							
							<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
								<path d="M10.268 21a2 2 0 0 0 3.464 0"/>
								<path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326"/>
							</svg>

							<h3>{t("playerTools.updatesTitle")}</h3>
							
							<p>{t("playerTools.updatesText")}</p>
						</article>
					</div>
				</section>

				<section className="home-safety-section">
					<div className="home-safety-upload-demo" role="img" aria-label={t("safety.animationLabel")}>
						<svg className="home-safety-upload-demo__animation" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 560 310" fill="none" aria-hidden="true">
							<g className="home-safety-upload-demo__target" transform="translate(280 110)">
								<g className="home-safety-upload-demo__upload-target">
									<circle className="home-safety-upload-demo__target-background" r="45"/>
									<circle className="home-safety-upload-demo__progress" r="45" pathLength="100" transform="rotate(-90)"/>
									<g transform="translate(-18 -18) scale(1.5)" strokeWidth="2">
										<path d="M12 3v12"/>
										<path d="m17 8-5-5-5 5"/>
										<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
									</g>
								</g>

								<g className="home-safety-upload-demo__success-icon">
									<circle r="50"/>
									<g transform="translate(-24 -24) scale(2)">
										<path d="M20 6 9 17l-5-5"/>
									</g>
								</g>

								<g className="home-safety-upload-demo__moderator-icon">
									<circle r="50"/>
									<g transform="translate(-18 -18) scale(1.5)">
										<path d="m3 6 3 1m0 0-3 9a5 5 0 0 0 6.001 0M6 7l3 9M6 7l6-2m6 2 3-1m-3 1-3 9a5 5 0 0 0 6.001 0M18 7l3 9m-3-9-6-2m0-2v2m0 16V5m0 16H9m3 0h3"/>
									</g>
								</g>
							</g>

							<g transform="translate(190 188)">
								<g className="home-safety-upload-demo__file">
									<rect className="home-safety-upload-demo__file-background" width="180" height="74" rx="16"/>
									<g className="home-safety-upload-demo__file-icon" transform="translate(20 15) scale(1.7)">
										<path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z"/>
										<path d="M14 2v5a1 1 0 0 0 1 1h5"/>
									</g>
									<path className="home-safety-upload-demo__file-line" d="M78 29h70"/>
									<path className="home-safety-upload-demo__file-line" d="M78 45h52"/>
								</g>
							</g>

							<g transform="translate(380 245)">
								<g className="home-safety-upload-demo__cursor">
									<path className="home-safety-upload-demo__cursor-fill" d="M2 2v31l8-8 8 17 8-4-8-17h12z"/>
									<circle className="home-safety-upload-demo__cursor-click" cx="1" cy="1" r="14"/>
								</g>
							</g>
						</svg>

						<div className="home-safety-upload-demo__transfer-progress" aria-hidden="true">
							<div className="home-safety-upload-demo__transfer-copy">
								<span>{t("safety.uploadedLabel")}</span>
								<strong>
									<span className="home-safety-upload-demo__transfer-values">
										<span>64 KB / 10 MB</span>
										<span>2.6 MB / 10 MB</span>
										<span>5.1 MB / 10 MB</span>
										<span>7.8 MB / 10 MB</span>
										<span>10 MB / 10 MB</span>
									</span>
								</strong>
							</div>

							<span className="home-safety-upload-demo__transfer-track">
								<span/>
							</span>
						</div>

						<div className="home-safety-upload-demo__statuses">
							<div className="home-safety-upload-demo__status home-safety-upload-demo__status--queued">
								<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
									<circle cx="12" cy="12" r="10"/>
									<path d="M12 6v6l4 2"/>
								</svg>

								<strong>{t("safety.queuedTitle")}</strong>
							</div>

							<div className="home-safety-upload-demo__status home-safety-upload-demo__status--reviewing">
								<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
									<path d="m3 6 3 1m0 0-3 9a5 5 0 0 0 6.001 0M6 7l3 9M6 7l6-2m6 2 3-1m-3 1-3 9a5 5 0 0 0 6.001 0M18 7l3 9m-3-9-6-2m0-2v2m0 16V5m0 16H9m3 0h3"/>
								</svg>
								
								<strong>{t("safety.reviewingTitle")}</strong>
							</div>

							<div className="home-safety-upload-demo__status home-safety-upload-demo__status--published">
								<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
									<path d="M20 6 9 17l-5-5"/>
								</svg>

								<strong>{t("safety.publishedTitle")}</strong>
							</div>
						</div>
					</div>

					<div className="home-safety-section__copy">
						<span className="home-pill home-pill--safety">{t("safety.badge")}</span>
						
						<h2 className="home-section-title">{t("safety.title")}</h2>
						
						<p className="home-section-lead">{t("safety.lead")}</p>
						
						<Link href="/legal/rules" className="button button--size-xl button--type-secondary button--with-icon button--active-transform">
							<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
								<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>
								<path d="m9 12 2 2 4-4"/>
							</svg>
							
							{t("safety.cta")}
						</Link>
					</div>
				</section>

				<HomeAnalyticsSection t={t} onPublish={handlePublishProject}/>

				<section className="home-open-source-section">
					<div className="home-api-showcase" role="region" aria-label={t("openSource.codeLabel")}>
						<span className="home-api-showcase__marker home-api-showcase__marker--top-left" aria-hidden="true"/>
						<span className="home-api-showcase__marker home-api-showcase__marker--bottom-left" aria-hidden="true"/>
						<span className="home-api-showcase__marker home-api-showcase__marker--top-right" aria-hidden="true"/>
						<span className="home-api-showcase__marker home-api-showcase__marker--bottom-right" aria-hidden="true"/>

						<div className="home-api-code">
							<div className="home-api-code__header">
								<div className="home-api-code__traffic-lights" aria-hidden="true">
									<span/>
									<span/>
									<span/>
								</div>
							</div>

							<pre><code>
								<span className="home-api-code__line"><span className="home-api-code__token--keyword">const</span>{" response = "}<span className="home-api-code__token--keyword">await</span>{" "}<span className="home-api-code__token--function">fetch</span>{"("}</span>
								<span className="home-api-code__line">{"  "}<span className="home-api-code__token--string">"https://api.modifold.com/projects/mermaids"</span>{","}</span>
								<span className="home-api-code__line">{"  { "}<span className="home-api-code__token--property">method</span>{": "}<span className="home-api-code__token--string">"GET"</span>{" }"}</span>
								<span className="home-api-code__line">{");"}</span>
								<span className="home-api-code__line" aria-hidden="true">&nbsp;</span>
								<span className="home-api-code__line"><span className="home-api-code__token--keyword">const</span>{" json = "}<span className="home-api-code__token--keyword">await</span>{" response."}<span className="home-api-code__token--function">json</span>{"();"}</span>
								<span className="home-api-code__line"><span className="home-api-code__token--property">console</span>{"."}<span className="home-api-code__token--function">log</span>{"(json);"}</span>
							</code></pre>
						</div>
					</div>

					<div className="home-open-source-section__copy">
						<span className="home-pill home-pill--creators">{t("openSource.badge")}</span>

						<h2 className="home-section-title">{t("openSource.title")}</h2>

						<p className="home-section-lead">{t("openSource.lead")}</p>

						<div className="home-open-source-section__actions">
							<a href="https://docs.modifold.com/" className="button button--size-xl button--type-primary button--with-icon button--active-transform" target="_blank" rel="noopener noreferrer">
								<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
									<path d="M12 7v14"/>
									<path d="M3 18a1 1 0 0 1-1-1V5a2 2 0 0 1 2-2h5a3 3 0 0 1 3 3v15a3 3 0 0 0-3-3z"/>
									<path d="M21 18a1 1 0 0 0 1-1V5a2 2 0 0 0-2-2h-5a3 3 0 0 0-3 3v15a3 3 0 0 1 3-3z"/>
								</svg>

								{t("openSource.docsCta")}
							</a>

							<a href="https://github.com/modifold-website" className="button button--size-xl button--type-secondary button--with-icon button--active-transform" target="_blank" rel="noopener noreferrer">
								<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
									<polyline points="16 18 22 12 16 6"/>
									<polyline points="8 6 2 12 8 18"/>
								</svg>

								{t("openSource.sourceCta")}
							</a>
						</div>
					</div>
				</section>

				<section className="latest-news home-latest-news">
					<h2 className="latest-title">{t("latestNewsTitle")}</h2>

					<div className="news-cards">
						{news.slice(0, 3).map((article) => (
							<Link href={article.slug} className="news-card button--active-transform" key={article.slug}>
								<img src={article.image || "/images/placeholder.png"} alt={article.title} className="news-image"/>
								
								<div className="news-content">
									<h3>{article.title}</h3>

									<p>{article.description}</p>

									<span>{formatNewsDate(article.date, currentLocale)}</span>
								</div>
							</Link>
						))}
					</div>

					<div className="view-all">
						<Link href="/blog" className="button button--size-xl button--type-primary button--with-icon button--active-transform">
							<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
								<path d="M15 18h-5"/>
								<path d="M18 14h-8"/>
								<path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-4 0v-9a2 2 0 0 1 2-2h2"/>
								<rect width="8" height="4" x="10" y="6" rx="1"/>
							</svg>

							{t("viewAllNews")}
						</Link>
					</div>
				</section>
			</main>

			<LoginModal isOpen={isLoginModalOpen} onClose={closeModals}/>
			<ProjectCreationModal isOpen={isProjectCreationModalOpen} authToken={authToken} onRequestClose={closeModals}/>
		</>
	);
}