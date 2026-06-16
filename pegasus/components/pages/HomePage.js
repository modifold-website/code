"use client";

import Link from "next/link";
import { getProjectPath } from "@/utils/projectRoutes";
import { useMemo, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import ProjectCard from "../project/ProjectCard";
import { useAuth } from "../providers/AuthProvider";
import LoginModal from "../../modal/LoginModal";
import HomeAnalyticsSection from "../ui/HomeAnalyticsSection";
import HomeNotificationsSection from "../ui/HomeNotificationsSection";
import HytaleModJamPromotion from "../ui/HytaleModJamPromotion";

export default function HomePage({ news = [], locale, projects = [], projectsLimit = 20 }) {
	const t = useTranslations("HomePage");
	const { isLoggedIn } = useAuth();
	const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
	const [isMarqueePaused, setIsMarqueePaused] = useState(false);
	const activeLocale = useLocale();
	const currentLocale = activeLocale || locale || "en";

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString(currentLocale, { month: "long", day: "numeric", year: "numeric" });
    };

    const hytaleToken = "__HYTALE__";
    const heroTitle = t("heroTitle", { hytale: hytaleToken });
    const [heroTitleBefore, heroTitleAfter] = heroTitle.split(hytaleToken);
    const heroHasToken = heroTitle.includes(hytaleToken);

    const displayedProjects = useMemo(() => {
        const sorted = [...projects];

        sorted.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
        return sorted.slice(0, projectsLimit);
    }, [projects]);

    const showcaseProjects = displayedProjects.slice(0, 3);

    return (
        <>
            <img src="/images/background-home.webp" className="fixed-background-teleport" alt="" />

            <div className="layout">
                <section className="hero-section">
                    <div className="hero-container">
                        <div className="hero-content animated">
                            <svg style={{ width: "150px", height: "100%", marginLeft: "auto", marginRight: "auto", marginBottom: "16px" }} xmlns="http://www.w3.org/2000/svg" width="86" height="85" viewBox="0 0 86 85" fill="none">
                                <path d="M0 36.788C0 6.49309 6.50029 0 36.8288 0H48.2655C78.594 0 85.0943 6.49309 85.0943 36.788V48.212C85.0943 78.5068 78.594 85 48.2655 85H36.8288C6.50029 85 0 78.5068 0 48.212V36.788Z" fill="url(#paint0_linear_6642_2)"></path>
                                <path d="M42.1389 9.28913C42.5195 9.06622 42.9903 9.06622 43.3709 9.28913L71.6206 25.83C71.9958 26.0497 72.2266 26.4527 72.2266 26.8885V58.2922C72.2266 58.73 71.9937 59.1351 71.6156 59.354L43.3659 75.7139C42.9878 75.9328 42.522 75.9328 42.1439 75.7139L13.8943 59.354C13.5162 59.1351 13.2832 58.73 13.2832 58.2922V26.8885C13.2832 26.4527 13.514 26.0497 13.8892 25.83L42.1389 9.28913ZM16.5399 28.0235V57.161L42.7549 72.3901L68.9702 57.161V28.0235L42.7549 12.606L16.5399 28.0235ZM65.9578 29.5322V55.7467L42.7549 68.9955L19.5522 55.7467V29.5322L42.7549 16.0007L65.9578 29.5322ZM22.6372 54.191L41.5329 65.0349V43.6295L22.6372 32.8798V54.191ZM44.2592 43.661V64.9408L63.0609 54.1603V32.7855L44.2592 43.661ZM39.5587 57.7743V61.1851L36.7384 59.5659V56.1713L39.5587 57.7743ZM48.9593 59.5659L46.1392 61.1851V57.7743L48.9593 56.1713V59.5659ZM27.5256 50.9851V54.3797L24.6114 52.7767V49.3821L27.5256 50.9851ZM61.0867 52.7767L58.1723 54.3797V50.9851L61.0867 49.3821V52.7767ZM34.4822 46.0816V52.3994L29.2178 49.4762V43.1584L34.4822 46.0816ZM56.48 49.4762L51.2158 52.3994V46.0816L56.48 43.1584V49.4762ZM39.6527 45.2329V48.8161L36.7384 47.2131V43.6299L39.6527 45.2329ZM48.9593 47.2131L46.0454 48.8161V45.2329L48.9593 43.6299V47.2131ZM27.5256 38.6322V42.0269L24.6114 40.4238V37.0291L27.5256 38.6322ZM61.0867 40.4237L58.1723 42.0269V38.632L61.0867 37.029V40.4237Z" fill="white"></path>
                                <defs>
                                    <linearGradient id="paint0_linear_6642_2" x1="-1.0674e-06" y1="4.00018e-06" x2="84.9999" y2="85.0943" gradientUnits="userSpaceOnUse">
                                        <stop stop-color="#68A5FF"></stop>
                                        <stop offset="0.5" stop-color="#307DF0"></stop>
                                        <stop offset="1" stop-color="#307DF0"></stop>
                                    </linearGradient>
                                </defs>
                            </svg>

                            <h1 className="hero-title">
                                {heroHasToken ? (
                                    <>
                                        {heroTitleBefore}
                                        <span className="highlight-text">Hytale</span>
                                        {heroTitleAfter}
                                    </>
                                ) : (
                                    heroTitle
                                )}
                            </h1>

                            <p className="hero-description">{t("heroDescription")}</p>

                            <div className="hero-actions">
                                <Link href="/mods" className="button button--size-xl button--type-primary button--with-icon button--active-transform">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <circle cx="12" cy="12" r="10" />
                                        <path d="m16.24 7.76-1.804 5.411a2 2 0 0 1-1.265 1.265L7.76 16.24l1.804-5.411a2 2 0 0 1 1.265-1.265z" />
                                    </svg>

                                    {t("exploreMods")}
                                </Link>

                                {isLoggedIn ? (
                                    <Link href="/dashboard" className="button button--size-xl button--type-secondary button--with-icon button--active-transform">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-layout-panel-left-icon lucide-layout-panel-left">
                                            <rect width="7" height="18" x="3" y="3" rx="1"/>
                                            <rect width="7" height="7" x="14" y="3" rx="1"/>
                                            <rect width="7" height="7" x="14" y="14" rx="1"/>
                                        </svg>
                                        
                                        {t("dashboardCta")}
                                    </Link>
                                ) : (
                                    <button className="button button--size-xl button--type-secondary button--with-icon button--active-transform" type="button" onClick={() => setIsLoginModalOpen(true)}>
                                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-log-in-icon lucide-log-in">
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

				<HytaleModJamPromotion />

                <section className="stats-section">
                    <div className="mods-marquee">
                        <div className="marquee-content" style={{ animationPlayState: isMarqueePaused ? "paused" : "running" }}>
                            {displayedProjects.length === 0 && (
                                <div className="mod-badge" style={{ cursor: "default" }} onMouseEnter={() => setIsMarqueePaused(true)} onMouseLeave={() => setIsMarqueePaused(false)}>
                                    <span className="mod-name">{t("noProjects")}</span>
                                </div>
                            )}

                            {displayedProjects.map((project) => (
                                <Link href={getProjectPath(project)} key={project.id} className="mod-badge button--active-transform" onMouseEnter={() => setIsMarqueePaused(true)} onMouseLeave={() => setIsMarqueePaused(false)}>
                                    <img src={project.icon_url || "https://media.modifold.com/static/no-project-icon.svg"} alt="" className="mod-avatar" width={64} height={64} />
                                    
                                    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                                        <span className="mod-name">{project.title}</span>
                                        <span className="mod-desc">{project.summary}</span>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </div>
                </section>

                <section className="home-showcase-section">
                    <div className="showcase-shell">
                        <div className="showcase-copy">
                            <span className="home-pill home-pill--players" style={{ width: "fit-content" }}>{t("showcase.playersBadge")}</span>

                            <h3>{t("showcase.playersTitle")}</h3>
                            
                            <p>{t("showcase.playersLead")}</p>
                        </div>

                        <div className="showcase-visual">
                            <div className="sort-controls">
                                <div className="field field--large" style={{ width: "100%" }}>
                                    <label className="field__wrapper" style={{ background: "var(--theme-color-background-content)" }}>
                                        <div className="field__wrapper-body">
                                            <svg className="icon icon--search field__icon field__icon--left" xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="m21 21-4.34-4.34" />
                                                <circle cx="11" cy="11" r="8" />
                                            </svg>

                                            <input type="text" placeholder={t("showcase.searchPlaceholder")} value="" readOnly className="text-input" />
                                        </div>
                                    </label>
                                </div>

                                <div style={{ display: "flex", gap: "12px", flexDirection: "row", alignItems: "center" }}>
                                    <div className="sort-wrapper">
                                        <div className="dropdown">
                                            <button className="dropdown__label" type="button" disabled style={{ cursor: "default" }}>
                                                {t("showcase.sortRelevance")}
                                                <svg style={{ fill: "none" }} xmlns="http://www.w3.org/2000/svg" className="icon icon--chevron_up" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="m6 9 6 6 6-6" />
                                                </svg>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="browse-project-list">
                                {showcaseProjects.length === 0 && (
                                    <div className="subsite-empty-feed">
                                        <p className="subsite-empty-feed__title">{t("noProjects")}</p>
                                    </div>
                                )}

                                {showcaseProjects.map((project) => (
                                    <ProjectCard key={`showcase-${project.id}`} maxTags={3} project={project} />
                                ))}
                            </div>
                        </div>
                    </div>
                </section>

				<HomeNotificationsSection t={t} />

				<HomeAnalyticsSection currentLocale={currentLocale} t={t} />

                <section className="creator-features-section">
                    <div className="home-section-intro">
                        <span className="home-pill home-pill--creators">{t("creatorSection.badge")}</span>
                        
                        <h2 className="home-section-title">{t("creatorSection.title")}</h2>
                        
                        <p className="home-section-lead">{t("creatorSection.lead")}</p>
                    </div>

                    <div className="creator-features-grid">
                        <article className="creator-feature-card">
                            <div className="creator-feature-icon">
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-users-round-icon lucide-users-round">
                                    <path d="M18 21a8 8 0 0 0-16 0"/>
                                    <circle cx="10" cy="8" r="5"/>
                                    <path d="M22 20c0-3.37-2-6.5-4-8a5 5 0 0 0-.45-8.3"/>
                                </svg>
                            </div>

                            <h3>{t("creatorCards.team.title")}</h3>
                            <p>{t("creatorCards.team.description")}</p>
                        </article>

                        <article className="creator-feature-card">
                            <div className="creator-feature-icon">
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-git-branch-icon lucide-git-branch">
                                    <path d="M15 6a9 9 0 0 0-9 9V3"/>
                                    <circle cx="18" cy="6" r="3"/>
                                    <circle cx="6" cy="18" r="3"/>
                                </svg>
                            </div>

                            <h3>{t("creatorCards.versions.title")}</h3>
                            <p>{t("creatorCards.versions.description")}</p>
                        </article>

                        <article className="creator-feature-card">
                            <div className="creator-feature-icon">
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-file-text-icon lucide-file-text">
                                    <path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z"/>
                                    <path d="M14 2v5a1 1 0 0 0 1 1h5"/>
                                    <path d="M10 9H8"/>
                                    <path d="M16 13H8"/>
                                    <path d="M16 17H8"/>
                                </svg>
                            </div>

                            <h3>{t("creatorCards.pages.title")}</h3>
                            <p>{t("creatorCards.pages.description")}</p>
                        </article>

                        <article className="creator-feature-card">
                            <div className="creator-feature-icon">
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-message-circle-icon lucide-message-circle">
                                    <path d="M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719"/>
                                </svg>
                            </div>

                            <h3>{t("creatorCards.feedback.title")}</h3>
                            <p>{t("creatorCards.feedback.description")}</p>
                        </article>

                        <article className="creator-feature-card">
                            <div className="creator-feature-icon">
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-shield-check-icon lucide-shield-check">
                                    <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>
                                    <path d="m9 12 2 2 4-4"/>
                                </svg>
                            </div>

                            <h3>{t("creatorCards.moderation.title")}</h3>
                            <p>{t("creatorCards.moderation.description")}</p>
                        </article>

                        <article className="creator-feature-card">
                            <div className="creator-feature-icon">
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-bell-ring-icon lucide-bell-ring">
                                    <path d="M10.268 21a2 2 0 0 0 3.464 0"/>
                                    <path d="M22 8c0-2.3-.8-4.3-2-6"/>
                                    <path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326"/>
                                    <path d="M4 2C2.8 3.7 2 5.7 2 8"/>
                                </svg>
                            </div>

                            <h3>{t("creatorCards.notifications.title")}</h3>
                            <p>{t("creatorCards.notifications.description")}</p>
                        </article>
                    </div>
                </section>

                <section className="latest-news">
                    <h2 className="latest-title">{t("latestNewsTitle")}</h2>

                    <div className="news-cards">
                        {news.slice(0, 3).map((article) => (
                            <Link href={`${article.slug}`} className="news-card button--active-transform" key={article.slug}>
                                <img src={article.image || "/images/placeholder.png"} alt={article.title} className="news-image" />
                                
                                <div className="news-content">
                                    <h3>{article.title}</h3>
                                    <p>{article.description}</p>
                                    <span>{formatDate(article.date)}</span>
                                </div>
                            </Link>
                        ))}
                    </div>

                    <div className="view-all">
                        <Link href="/news" className="button button--size-xl button--type-primary button--with-icon button--active-transform">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon lucide lucide-newspaper-icon lucide-newspaper">
                                <path d="M15 18h-5"/>
                                <path d="M18 14h-8"/>
                                <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-4 0v-9a2 2 0 0 1 2-2h2"/>
                                <rect width="8" height="4" x="10" y="6" rx="1"/>
                            </svg>
                            
                            {t("viewAllNews")}
                        </Link>
                    </div>
                </section>
            </div>

            <LoginModal isOpen={isLoginModalOpen} onClose={() => setIsLoginModalOpen(false)} />
        </>
    );
}