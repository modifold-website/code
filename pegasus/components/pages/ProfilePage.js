"use client";

import { Fragment, useState, useRef, useEffect } from "react";
import { useAuth } from "../providers/AuthProvider";
import axios from "axios";
import { toast } from "react-toastify";
import Link from "next/link";
import ProjectCard from "../project/ProjectCard";
import { useTranslations, useLocale } from "next-intl";
import UserName from "../ui/UserName";
import Modal from "react-modal";
import ImageLightbox, { useImageLightbox } from "../ui/ImageLightbox";
import RoleBadge from "../ui/RoleBadge";
import ProfileSubscriptionsModal from "@/modal/ProfileSubscriptionsModal";
import Tooltip from "@/components/ui/Tooltip";

if(typeof window !== "undefined") {
    Modal.setAppElement("body");
}

const DESCRIPTION_URL_RE = /\bhttps?:\/\/[^\s<]+/gi;

const getSafeExternalUrl = (value) => {
    if(typeof value !== "string") {
        return null;
    }

    try {
        const parsed = new URL(value);
        if(parsed.protocol !== "http:" && parsed.protocol !== "https:") {
            return null;
        }

        return parsed.toString();
    } catch {
        return null;
    }
};

const renderDescription = (desc) => {
    if(!desc) {
        return null;
    }

    const lines = desc.split("\n");
    return lines.map((line, lineIndex) => {
        const parts = [];
        let lastIndex = 0;

        line.replace(DESCRIPTION_URL_RE, (match, offset) => {
            if(offset > lastIndex) {
                parts.push(line.slice(lastIndex, offset));
            }

            const safeUrl = getSafeExternalUrl(match);
            if(safeUrl) {
                parts.push(
                    <a key={`url-${lineIndex}-${offset}`} href={safeUrl} target="_blank" rel="noopener noreferrer">
                        {match.replace(/^https?:\/\//i, "")}
                    </a>
                );
            } else {
                parts.push(match);
            }

            lastIndex = offset + match.length;
            return match;
        });

        if(lastIndex < line.length) {
            parts.push(line.slice(lastIndex));
        }

        return (
            <Fragment key={`line-${lineIndex}`}>
                {parts}
                {lineIndex < lines.length - 1 && <br />}
            </Fragment>
        );
    });
};

const formatDate = (timestamp, locale) => {
    const date = new Date(timestamp);
    const now = new Date();
    const day = date.getDate().toString().padStart(2, '0');
    const month = date.toLocaleString(locale, { month: 'short' });
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const year = date.getFullYear();

    if(year !== now.getFullYear()) {
        return `${day} ${month} ${year} ${hours}:${minutes}`;
    }

    return `${day} ${month} ${hours}:${minutes}`;
};

const formatFullNumber = (num, locale) => new Intl.NumberFormat(locale).format(Math.max(0, Number(num) || 0));

const getProjectDownloadsTotal = (projects) => projects.reduce((sum, project) => sum + Math.max(0, Number(project?.downloads) || 0), 0);

export default function ProfilePage({ user, isBanned, isSubscribed: initialSubscribed, subscriptionId: initialSubId, authToken, projects = [], totalProjects = null, totalDownloads = null, organizations = [], currentPage = 1, totalPages = 1 }) {
    const t = useTranslations("ProfilePage");
    const tLinks = useTranslations("Organizations.settings.links");
    const locale = useLocale();
    const { isLoggedIn, user: currentUser } = useAuth();
    const [isSubscribed, setIsSubscribed] = useState(initialSubscribed);
    const [subscriptionId, setSubscriptionId] = useState(initialSubId);
    const [isPopoverOpen, setIsPopoverOpen] = useState(false);
    const [isVerifiedModalOpen, setIsVerifiedModalOpen] = useState(false);
    const [isModifoldVerifiedModalOpen, setIsModifoldVerifiedModalOpen] = useState(false);
    const [activeFollowModal, setActiveFollowModal] = useState(null);
    const popoverRef = useRef(null);
    const buttonRef = useRef(null);
    const { lightboxOpen, lightboxImage, closeLightbox, getLightboxTriggerProps } = useImageLightbox();

    useEffect(() => {
        setActiveFollowModal(null);
    }, [user.slug]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if(isPopoverOpen && popoverRef.current && !popoverRef.current.contains(event.target) && buttonRef.current && !buttonRef.current.contains(event.target)) {
                setIsPopoverOpen(false);
            }

        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [isPopoverOpen]);

    const handleSubscribe = async () => {
        if(!isLoggedIn || !authToken) {
            toast.error(t("loginToSubscribe"));
            return;
        }

        try {
            if(isSubscribed) {
                await axios.delete(`${process.env.NEXT_PUBLIC_API_BASE}/subscriptions/${subscriptionId}`, {
                    headers: { Authorization: `Bearer ${authToken}` },
                });

                setIsSubscribed(false);
                setSubscriptionId(null);
            } else {
                const res = await axios.post(`${process.env.NEXT_PUBLIC_API_BASE}/subscriptions`, { userId: user.id }, { headers: { Authorization: `Bearer ${authToken}` } });
                setIsSubscribed(true);
                setSubscriptionId(res.data.subscriptionId);
            }
        } catch (err) {
            toast.error(err.response?.data?.message || t("errors.subscriptionChange"));
        }
    };

    const togglePopover = () => {
        setIsPopoverOpen((prev) => !prev);
    };

    const handleOpenFollowModal = (type) => {
        const count = type === "subscribers" ? countSubs : countUserSubs;
        if(count < 1) {
            return;
        }

        setActiveFollowModal(type);
    };

    const authorAva = isBanned ? "https://leonardo.osnova.io/8e95d9d3-932c-5f85-8b53-43da2e8ccaeb/-/format/webp/" : user.avatar || "https://cdn.modifold.com/default_avatar.png";
    const authorTitle = isBanned ? t("accountFrozen") : user.username;
    const profileDescription = typeof user.description === "string" ? user.description.trim() : "";
    const desc = isBanned ? null : (renderDescription(profileDescription) || t("defaultDescription"));

    const countSubs = user.subscribers || 0;
    const countUserSubs = user.subscriptions || 0;
    const publishedProjectsCount = Math.max(0, Number(totalProjects ?? projects.length) || 0);
    const authorDownloadsCount = Math.max(0, Number(totalDownloads ?? getProjectDownloadsTotal(projects)) || 0);

    const isOwnProfile = isLoggedIn && user.id === currentUser.id;

    const getPageButtons = () => {
        const maxButtons = 10;
        let startPage = Math.max(1, currentPage - Math.floor(maxButtons / 2));
        let endPage = Math.min(totalPages, startPage + maxButtons - 1);
        if(endPage - startPage + 1 < maxButtons) {
            startPage = Math.max(1, endPage - maxButtons + 1);
        }

        const buttons = [];
        for(let i = startPage; i <= endPage; i++) {
            buttons.push(
                <Link key={i} href={i === 1 ? `/user/${user.slug}` : `/user/${user.slug}?page=${i}`} className={`button button--size-m pagination-button ${currentPage === i ? "button--type-primary" : "button--type-secondary"}`} aria-current={currentPage === i ? "page" : undefined}>
                    {i}
                </Link>
            );
        }

        return buttons;
    };

    return (
        <>
            <div className="layout">
                <div className="browse-page">
                    <div className="subsite-content">
                        <div className="subsite-header">
                            <div className="subsite-header__padding">
                                <div className="subsite-header__header">
                                    <div className="subsite-avatar subsite-header__avatar">
                                        <div className="andropov-media andropov-media--rounded andropov-media--bordered andropov-media--cropped andropov-image andropov-image--zoom subsite-avatar__image" style={{ aspectRatio: "1.5 / 1", maxWidth: "none" }} aria-label={t("openAvatar")} {...getLightboxTriggerProps({ url: authorAva, title: authorTitle })}>
                                            <img className="magnify" src={authorAva} alt={authorTitle} />
                                        </div>
                                    </div>

                                    {isLoggedIn && (
                                        <div className="subsite-header__controls">
                                            {currentUser.id === user.id ? (
                                                <Link href="/settings" className="button button--size-m button--type-minimal button--active-transform">{t("edit")}</Link>
                                            ) : (
                                                <>
                                                    <button className="button button--size-m button--type-primary" style={{ display: isSubscribed ? "none" : "block" }} onClick={handleSubscribe}>{t("subscribe")}</button>

                                                    <button className="button button--size-m button--type-minimal" style={{ display: isSubscribed ? "block" : "none" }} onClick={handleSubscribe}>{t("subscribed")}</button>
                                                </>
                                            )}

                                            {!isOwnProfile && (
                                                <div className="content-header__actions" style={{ position: "relative", right: "0" }}>
                                                    <button ref={buttonRef} className="icon-button content__etc" type="button" onClick={togglePopover} aria-label={t("moreActionsAria")}>
                                                        <svg viewBox="0 0 24 24" className="icon icon--dots" height="24" width="24">
                                                            <path fillRule="evenodd" clipRule="evenodd" d="M5 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM19 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" fill="currentColor" />
                                                        </svg>
                                                    </button>

                                                    {isPopoverOpen && (
                                                        <div id="popover-overlay" className="popover-overlay">
                                                            <div ref={popoverRef} className="popover" tabIndex={0} style={{ "--width": "207px", "--top": "45px", "--position": "absolute", "--left": "auto", "--right": "15px", "--bottom": "auto", "--distance": "8px" }}>
                                                                <div className="popover__scrollable" style={{ "--max-height": "auto" }}>
                                                                    <div className="context-list-option">
                                                                        <div className="context-list-option__label">{t("moreActionsPlaceholder")}</div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                <h1 className="subsite-header__name" style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                                    {(user?.isRole === "admin" || user?.isRole === "moderator") && (                   
                                        <svg width="20" height="20" style={{ marginRight: "2px", cursor: "pointer" }} viewBox="0 0 128 128" fill="none" xmlns="http://www.w3.org/2000/svg" onClick={() => setIsModifoldVerifiedModalOpen(true)} role="button" aria-label="Verified by Modifold">
                                            <path d="M56.6424 5.64827C60.6427 0.783909 68.0894 0.783909 72.0897 5.64827L82.8299 18.7088C84.696 20.9778 87.4657 22.311 90.4032 22.3553L107.311 22.6092C113.608 22.7042 118.251 28.527 116.942 34.6873L113.428 51.2274C112.817 54.1011 113.502 57.0975 115.299 59.4217L125.641 72.7996C129.493 77.782 127.836 85.0416 122.204 87.8592L107.081 95.4246C104.453 96.739 102.536 99.1419 101.84 101.996L97.8299 118.423C96.3363 124.541 89.6267 127.773 83.9119 125.126L68.5692 118.018C65.9033 116.784 62.8288 116.784 60.1629 118.018L44.8201 125.126C39.1054 127.773 32.3958 124.541 30.9022 118.423L26.8924 101.996C26.1956 99.1419 24.2787 96.739 21.6512 95.4246L6.52816 87.8592C0.896047 85.0416 -0.761059 77.782 3.09066 72.7996L13.4344 59.4217C15.2311 57.0976 15.915 54.1009 15.3045 51.2274L11.7899 34.6873C10.4809 28.5269 15.1245 22.7039 21.4217 22.6092L38.3289 22.3553C41.2665 22.3111 44.0361 20.977 45.9022 18.7078L56.6424 5.64827ZM65.1248 26.1942C64.6554 25.9221 64.0748 25.9221 63.6053 26.1942L28.7713 46.3856C28.3086 46.6538 28.0243 47.1465 28.0243 47.6785V86.0145C28.0244 86.549 28.3111 87.0431 28.7772 87.3104L63.6121 107.281C64.0783 107.548 64.6528 107.548 65.119 107.281L99.953 87.3104C100.419 87.0431 100.707 86.549 100.707 86.0145V47.6785C100.707 47.1465 100.422 46.6538 99.9588 46.3856L65.1248 26.1942ZM96.6912 49.0633V84.6336L64.3651 103.224L32.0399 84.6336V49.0633L64.3651 30.243L96.6912 49.0633ZM35.7537 50.9051V82.9071L64.3651 99.0799L92.9764 82.9071V50.9051L64.3651 34.3866L35.7537 50.9051ZM62.8582 68.1151V94.245L39.5584 81.0076V54.992L62.8582 68.1151ZM89.4041 80.9696L66.2196 94.1307V68.1532L89.4041 54.8768V80.9696ZM56.9461 87.5692L60.4237 89.5457V85.3817L56.9461 83.4256V87.5692ZM68.5379 85.3817V89.5457L72.0164 87.5692V83.4246L68.5379 85.3817ZM41.993 79.2811L45.5858 81.2381V77.0936L41.993 75.1375V79.2811ZM83.3758 77.0936V81.2381L86.9696 79.2811V75.1366L83.3758 77.0936ZM47.6727 75.2518L54.1639 78.8211V71.1082L47.6727 67.5399V75.2518ZM74.7977 71.1082V78.8201L81.2899 75.2518V67.5399L74.7977 71.1082ZM56.9461 72.4891L60.5399 74.4461V70.0721L56.9461 68.1151V72.4891ZM68.4227 70.0721V74.4461L72.0164 72.4891V68.1151L68.4227 70.0721ZM41.993 64.201L45.5858 66.158V62.0145L41.993 60.0575V64.201ZM83.3758 62.0145V66.158L86.9696 64.201V60.0575L83.3758 62.0145Z" fill="#307df0"/>
                                        </svg>
                                    )}

                                    <UserName showVerifiedIcon={false} showModifoldVerifiedIcon={false} user={isBanned ? { username: authorTitle } : user} />

                                    {user.isVerified === 1 && (
                                        <img onClick={() => setIsVerifiedModalOpen(true)} src="/badges/creator.webp" alt="Verified" style={{ width: "20px", cursor: "pointer" }} />
                                    )}
                                </h1>

                                <RoleBadge
                                    role={user.isRole}
                                    labels={{
                                        developer: t("role.developer"),
                                    }}
                                />

                                <p className="subsite-header__description">{desc}</p>

                                <div className="subsite-header__cols">
                                    <div className="subsite-header__date-created">{t("joined")} {formatDate(user.created_at, locale)}</div>
                                </div>

                                <div className="subsite-followers">
                                    <Tooltip content={t("publishedProjectsTooltip")}>
                                        <button type="button" className="subsite-followers__item subsite-followers__item--button subsite-followers__item--disabled" disabled>
                                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-box-icon lucide-box" aria-hidden="true">
                                                <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"></path>
                                                <path d="m3.3 7 8.7 5 8.7-5"></path>
                                                <path d="M12 22V12"></path>
                                            </svg>

                                            <span>{formatFullNumber(publishedProjectsCount, locale)}</span>
                                            
                                            {t("projectsLabel", { count: publishedProjectsCount })}
                                        </button>
                                    </Tooltip>

                                    <Tooltip content={t("downloadsTooltip")}>
                                        <button type="button" className="subsite-followers__item subsite-followers__item--button subsite-followers__item--disabled" disabled>
                                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-download-icon lucide-download" aria-hidden="true">
                                                <path d="M12 15V3"></path>
                                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                                <path d="m7 10 5 5 5-5"></path>
                                            </svg>

                                            <span>{formatFullNumber(authorDownloadsCount, locale)}</span>
                                            
                                            {t("downloadsLabel", { count: authorDownloadsCount })}
                                        </button>
                                    </Tooltip>

                                    <button type="button" className={`subsite-followers__item subsite-followers__item--button ${countSubs < 1 ? "subsite-followers__item--disabled" : ""}`} onClick={() => handleOpenFollowModal("subscribers")} disabled={countSubs < 1}>
                                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-users-icon lucide-users" aria-hidden="true">
                                            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
                                            <path d="M16 3.128a4 4 0 0 1 0 7.744"></path>
                                            <path d="M22 21v-2a4 4 0 0 0-3-3.87"></path>
                                            <circle cx="9" cy="7" r="4"></circle>
                                        </svg>

                                        <span>{formatFullNumber(countSubs, locale)}</span>
                                        
                                        {t("subscribersLabel", { count: countSubs })}
                                    </button>

                                    <button type="button" className={`subsite-followers__item subsite-followers__item--button ${countUserSubs < 1 ? "subsite-followers__item--disabled" : ""}`} onClick={() => handleOpenFollowModal("subscriptions")} disabled={countUserSubs < 1}>
                                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-user-round-plus-icon lucide-user-round-plus" aria-hidden="true">
                                            <path d="M2 21a8 8 0 0 1 13.292-6"></path>
                                            <circle cx="10" cy="8" r="5"></circle>
                                            <path d="M19 16v6"></path>
                                            <path d="M22 19h-6"></path>
                                        </svg>

                                        <span>{formatFullNumber(countUserSubs, locale)}</span>
                                        
                                        {t("subscriptionsLabel", { count: countUserSubs })}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {(user?.social_links?.discord || user?.social_links?.x || user?.social_links?.telegram || user?.social_links?.youtube) && (
                            <div className="content content--padding">
                                <h2>{t("linksTitle")}</h2>

                                <ul className="links-list">
                                    {user?.social_links?.discord && (
                                        <li>
                                            <a href={getSafeExternalUrl(user?.social_links?.discord)} target="_blank" rel="noopener noreferrer">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="71" height="55" fill="none" viewBox="0 0 71 55" className="shrink" aria-hidden="true"><g clipPath="url(#a)"><path fill="currentColor" d="M60.105 4.898A58.6 58.6 0 0 0 45.653.415a.22.22 0 0 0-.233.11 41 41 0 0 0-1.8 3.697c-5.456-.817-10.885-.817-16.23 0-.485-1.164-1.201-2.587-1.828-3.697a.23.23 0 0 0-.233-.11 58.4 58.4 0 0 0-14.451 4.483.2.2 0 0 0-.095.082C1.578 18.73-.944 32.144.293 45.39a.24.24 0 0 0 .093.167c6.073 4.46 11.955 7.167 17.729 8.962a.23.23 0 0 0 .249-.082 42 42 0 0 0 3.627-5.9.225.225 0 0 0-.123-.312 39 39 0 0 1-5.539-2.64.228.228 0 0 1-.022-.378c.372-.279.744-.569 1.1-.862a.22.22 0 0 1 .23-.03c11.619 5.304 24.198 5.304 35.68 0a.22.22 0 0 1 .233.027c.356.293.728.586 1.103.865a.228.228 0 0 1-.02.378 36.4 36.4 0 0 1-5.54 2.637.227.227 0 0 0-.121.315 47 47 0 0 0 3.624 5.897.225.225 0 0 0 .249.084c5.801-1.794 11.684-4.502 17.757-8.961a.23.23 0 0 0 .092-.164c1.48-15.315-2.48-28.618-10.497-40.412a.18.18 0 0 0-.093-.084m-36.38 32.427c-3.497 0-6.38-3.211-6.38-7.156s2.827-7.156 6.38-7.156c3.583 0 6.438 3.24 6.382 7.156 0 3.945-2.827 7.156-6.381 7.156m23.593 0c-3.498 0-6.38-3.211-6.38-7.156s2.826-7.156 6.38-7.156c3.582 0 6.437 3.24 6.38 7.156 0 3.945-2.798 7.156-6.38 7.156"></path></g><defs><clipPath id="a"><path fill="#fff" d="M0 0h71v55H0z"></path></clipPath></defs></svg>
                                                
                                                {tLinks("fields.discord")}
                                                
                                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>
                                            </a>
                                        </li>
                                    )}

                                    {user?.social_links?.x && (
                                        <li>
                                            <a href={getSafeExternalUrl(user?.social_links?.x)} target="_blank" rel="noopener noreferrer">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
                                                    <path fill="currentColor" d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z"></path>
                                                </svg>

                                                {tLinks("fields.twitter")}

                                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>
                                            </a>
                                        </li>
                                    )}

                                    {user?.social_links?.telegram && (
                                        <li>
                                            <a href={getSafeExternalUrl(user?.social_links?.telegram)} target="_blank" rel="noopener noreferrer">
                                                <svg width="24" height="24" viewBox="0 0 32 32" version="1.1" xmlns="http://www.w3.org/2000/svg">
                                                    <path d="M22.122 10.040c0.006-0 0.014-0 0.022-0 0.209 0 0.403 0.065 0.562 0.177l-0.003-0.002c0.116 0.101 0.194 0.243 0.213 0.403l0 0.003c0.020 0.122 0.031 0.262 0.031 0.405 0 0.065-0.002 0.129-0.007 0.193l0-0.009c-0.225 2.369-1.201 8.114-1.697 10.766-0.21 1.123-0.623 1.499-1.023 1.535-0.869 0.081-1.529-0.574-2.371-1.126-1.318-0.865-2.063-1.403-3.342-2.246-1.479-0.973-0.52-1.51 0.322-2.384 0.221-0.23 4.052-3.715 4.127-4.031 0.004-0.019 0.006-0.040 0.006-0.062 0-0.078-0.029-0.149-0.076-0.203l0 0c-0.052-0.034-0.117-0.053-0.185-0.053-0.045 0-0.088 0.009-0.128 0.024l0.002-0.001q-0.198 0.045-6.316 4.174c-0.445 0.351-1.007 0.573-1.619 0.599l-0.006 0c-0.867-0.105-1.654-0.298-2.401-0.573l0.074 0.024c-0.938-0.306-1.683-0.467-1.619-0.985q0.051-0.404 1.114-0.827 6.548-2.853 8.733-3.761c1.607-0.853 3.47-1.555 5.429-2.010l0.157-0.031zM15.93 1.025c-8.302 0.020-15.025 6.755-15.025 15.060 0 8.317 6.742 15.060 15.060 15.060s15.060-6.742 15.060-15.060c0-8.305-6.723-15.040-15.023-15.060h-0.002q-0.035-0-0.070 0z" fill="currentColor"></path>
                                                </svg>

                                                {tLinks("fields.telegram")}

                                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>
                                            </a>
                                        </li>
                                    )}

                                    {user?.social_links?.youtube && (
                                        <li>
                                            <a href={getSafeExternalUrl(user?.social_links?.youtube)} target="_blank" rel="noopener noreferrer">
                                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                    <path d="M9.6 15.4988V8.50128L15.84 12L9.6 15.4988Z" fill="var(--theme-color-background-content)"></path>
                                                    <path d="M23.4937 6.38795C23.3571 5.89505 23.0897 5.44564 22.7181 5.08471C22.3466 4.72377 21.884 4.46396 21.3766 4.33129C19.5082 3.84003 12 3.84003 12 3.84003C12 3.84003 4.49183 3.84003 2.62336 4.33129C2.11599 4.46396 1.6534 4.72377 1.28186 5.08471C0.910331 5.44564 0.642899 5.89505 0.506332 6.38795C0.157447 8.23915 -0.0118575 10.1181 0.00064491 12C-0.0118575 13.882 0.157447 15.7609 0.506332 17.6121C0.642899 18.105 0.910331 18.5544 1.28186 18.9153C1.6534 19.2763 2.11599 19.5361 2.62336 19.6688C4.49183 20.16 12 20.16 12 20.16C12 20.16 19.5082 20.16 21.3766 19.6688C21.884 19.5361 22.3466 19.2763 22.7181 18.9153C23.0897 18.5544 23.3571 18.105 23.4937 17.6121C23.8426 15.7609 24.0119 13.882 23.9994 12C24.0119 10.1181 23.8426 8.23915 23.4937 6.38795ZM9.60013 15.4972V8.50288L15.8312 12L9.60013 15.4972Z" fill="currentColor"></path>
                                                </svg>

                                                {tLinks("fields.youtube")}

                                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>
                                            </a>
                                        </li>
                                    )}
                                </ul>
                            </div>
                        )}

                        {organizations.length > 0 && (
                            <div className="content content--padding">
                                <h2>{t("organizationsTitle")}</h2>
                                
                                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                                    {organizations.map((organization) => (
                                        <Tooltip key={organization.id} content={organization.name}>
                                            <Link href={`/organization/${organization.slug}`} className="button--active-transform" style={{ display: "inline-flex" }}>
                                                <img src={organization.icon_url} alt={organization.name} style={{ width: "34px", height: "34px", borderRadius: "8px", objectFit: "cover" }} />
                                            </Link>
                                        </Tooltip>
                                    ))}
                                </div>
                            </div>
                        )}

                        <ImageLightbox isOpen={lightboxOpen} image={lightboxImage} onClose={closeLightbox} dialogLabel={t("lightboxLabel")} closeLabel={t("close")} openInNewTabLabel={t("openInNewTab")} fallbackAlt={authorTitle} />
                    </div>

                    <div className="browse-content">
                        {projects.length > 0 ? (
                            <div className="browse-project-list">
                                {projects.map((project) => (
                                    <ProjectCard key={project.id} project={project} />
                                ))}
                            </div>
                        ) : (
                            <div className="subsite-empty-feed">
                                <p className="subsite-empty-feed__title">{t("noProjects")}</p>
                            </div>
                        )}

                        {totalPages > 1 && (
                            <div className="pagination-controls">
                                {currentPage === 1 ? (
                                    <button className="button button--size-m button--type-secondary" disabled aria-disabled="true">
                                        {t("previous")}
                                    </button>
                                ) : (
                                    <Link className="button button--size-m button--type-secondary" href={currentPage - 1 === 1 ? `/user/${user.slug}` : `/user/${user.slug}?page=${currentPage - 1}`}>
                                        {t("previous")}
                                    </Link>
                                )}

                                {getPageButtons()}

                                {currentPage === totalPages ? (
                                    <button className="button button--size-m button--type-secondary" disabled aria-disabled="true">
                                        {t("next")}
                                    </button>
                                ) : (
                                    <Link className="button button--size-m button--type-secondary" href={`/user/${user.slug}?page=${currentPage + 1}`}>
                                        {t("next")}
                                    </Link>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <ProfileSubscriptionsModal
                isOpen={Boolean(activeFollowModal)}
                onRequestClose={() => setActiveFollowModal(null)}
                username={user.slug}
                type={activeFollowModal}
            />

            <Modal closeTimeoutMS={150} isOpen={isVerifiedModalOpen} onRequestClose={() => setIsVerifiedModalOpen(false)} className="modal active" overlayClassName="modal-overlay">
                <div className="modal-window">
                    <div className="modal-window__header">
                        <button className="icon-button modal-window__close" type="button" onClick={() => setIsVerifiedModalOpen(false)} aria-label={t("close")}>
                            <svg className="icon icon--cross" height="24" width="24">
                                <path fillRule="evenodd" clipRule="evenodd" d="M5.293 5.293a1 1 0 0 1 1.414 0L12 10.586l5.293-5.293a1 1 0 0 1 1.414 1.414L13.414 12l5.293 5.293a1 1 0 0 1-1.414 1.414L12 13.414l-5.293 5.293a1 1 0 0 1-1.414-1.414L10.586 12 5.293 6.707a1 1 0 0 1 0-1.414Z"></path>
                            </svg>
                        </button>
                    </div>

					<div className="modal-window__content">
						<div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
							<img src="/badges/creator.webp" alt={t("verifiedModal.creatorBadgeAlt")} style={{ width: "72px" }} />
							
                            <p style={{ margin: "0px", textAlign: "center" }}>{t("verifiedModal.creatorBadgeText")}</p>
							
                            <Link href="/news/creator-badge-launch" className="button button--size-xl button--type-minimal button--active-transform" style={{ width: "100%" }}>
								{t("verifiedModal.learnMore")}
							</Link>
						</div>
					</div>
                </div>
            </Modal>

            <Modal closeTimeoutMS={150} isOpen={isModifoldVerifiedModalOpen} onRequestClose={() => setIsModifoldVerifiedModalOpen(false)} className="modal active" overlayClassName="modal-overlay">
                <div className="modal-window">
                    <div className="modal-window__header">
                        <button className="icon-button modal-window__close" type="button" onClick={() => setIsModifoldVerifiedModalOpen(false)} aria-label={t("close")}>
                            <svg className="icon icon--cross" height="24" width="24">
                                <path fillRule="evenodd" clipRule="evenodd" d="M5.293 5.293a1 1 0 0 1 1.414 0L12 10.586l5.293-5.293a1 1 0 0 1 1.414 1.414L13.414 12l5.293 5.293a1 1 0 0 1-1.414 1.414L12 13.414l-5.293 5.293a1 1 0 0 1-1.414-1.414L10.586 12 5.293 6.707a1 1 0 0 1 0-1.414Z"></path>
                            </svg>
                        </button>
                    </div>

                    <div className="modal-window__content">
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
                            <svg width="72" height="72" viewBox="0 0 128 128" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Verified by Modifold">
                                <path d="M56.6424 5.64827C60.6427 0.783909 68.0894 0.783909 72.0897 5.64827L82.8299 18.7088C84.696 20.9778 87.4657 22.311 90.4032 22.3553L107.311 22.6092C113.608 22.7042 118.251 28.527 116.942 34.6873L113.428 51.2274C112.817 54.1011 113.502 57.0975 115.299 59.4217L125.641 72.7996C129.493 77.782 127.836 85.0416 122.204 87.8592L107.081 95.4246C104.453 96.739 102.536 99.1419 101.84 101.996L97.8299 118.423C96.3363 124.541 89.6267 127.773 83.9119 125.126L68.5692 118.018C65.9033 116.784 62.8288 116.784 60.1629 118.018L44.8201 125.126C39.1054 127.773 32.3958 124.541 30.9022 118.423L26.8924 101.996C26.1956 99.1419 24.2787 96.739 21.6512 95.4246L6.52816 87.8592C0.896047 85.0416 -0.761059 77.782 3.09066 72.7996L13.4344 59.4217C15.2311 57.0976 15.915 54.1009 15.3045 51.2274L11.7899 34.6873C10.4809 28.5269 15.1245 22.7039 21.4217 22.6092L38.3289 22.3553C41.2665 22.3111 44.0361 20.977 45.9022 18.7078L56.6424 5.64827ZM65.1248 26.1942C64.6554 25.9221 64.0748 25.9221 63.6053 26.1942L28.7713 46.3856C28.3086 46.6538 28.0243 47.1465 28.0243 47.6785V86.0145C28.0244 86.549 28.3111 87.0431 28.7772 87.3104L63.6121 107.281C64.0783 107.548 64.6528 107.548 65.119 107.281L99.953 87.3104C100.419 87.0431 100.707 86.549 100.707 86.0145V47.6785C100.707 47.1465 100.422 46.6538 99.9588 46.3856L65.1248 26.1942ZM96.6912 49.0633V84.6336L64.3651 103.224L32.0399 84.6336V49.0633L64.3651 30.243L96.6912 49.0633ZM35.7537 50.9051V82.9071L64.3651 99.0799L92.9764 82.9071V50.9051L64.3651 34.3866L35.7537 50.9051ZM62.8582 68.1151V94.245L39.5584 81.0076V54.992L62.8582 68.1151ZM89.4041 80.9696L66.2196 94.1307V68.1532L89.4041 54.8768V80.9696ZM56.9461 87.5692L60.4237 89.5457V85.3817L56.9461 83.4256V87.5692ZM68.5379 85.3817V89.5457L72.0164 87.5692V83.4246L68.5379 85.3817ZM41.993 79.2811L45.5858 81.2381V77.0936L41.993 75.1375V79.2811ZM83.3758 77.0936V81.2381L86.9696 79.2811V75.1366L83.3758 77.0936ZM47.6727 75.2518L54.1639 78.8211V71.1082L47.6727 67.5399V75.2518ZM74.7977 71.1082V78.8201L81.2899 75.2518V67.5399L74.7977 71.1082ZM56.9461 72.4891L60.5399 74.4461V70.0721L56.9461 68.1151V72.4891ZM68.4227 70.0721V74.4461L72.0164 72.4891V68.1151L68.4227 70.0721ZM41.993 64.201L45.5858 66.158V62.0145L41.993 60.0575V64.201ZM83.3758 62.0145V66.158L86.9696 64.201V60.0575L83.3758 62.0145Z" fill="#307df0"/>
                            </svg>
                            
                            <p style={{ margin: 0, textAlign: "center" }}>{t("verifiedModal.officialBadgeText")}</p>
                        </div>
                    </div>
                </div>
            </Modal>
        </>
    );
}