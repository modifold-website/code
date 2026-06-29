"use client";

import { Fragment, useState, useRef, useEffect } from "react";
import { useAuth } from "../providers/AuthProvider";
import axios from "axios";
import { toast } from "react-toastify";
import Link from "next/link";
import ProjectCard from "../project/ProjectCard";
import { useTranslations } from "next-intl";
import UserName from "../ui/UserName";
import Modal from "react-modal";
import ImageLightbox, { useImageLightbox } from "../ui/ImageLightbox";
import RoleBadge from "../ui/RoleBadge";
import ProfileSubscriptionsModal from "@/modal/ProfileSubscriptionsModal";
import ProfileAchievements from "@/components/ui/ProfileAchievements";
import ProfileLinks from "@/components/ui/ProfileLinks";
import ProfileProjectFeedToolbar from "@/components/ui/ProfileProjectFeedToolbar";
import ProfileStats from "@/components/ui/ProfileStats";

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

const getProjectDownloadsTotal = (projects) => projects.reduce((sum, project) => sum + Math.max(0, Number(project?.downloads) || 0), 0);

export default function ProfilePage({ user, isBanned, isSubscribed: initialSubscribed, subscriptionId: initialSubId, authToken, projects = [], totalProjects = null, totalDownloads = null, organizations = [], achievements = [], currentPage = 1, totalPages = 1, currentSort = "downloads" }) {
    const t = useTranslations("ProfilePage");
    const { isLoggedIn, user: currentUser } = useAuth();
    const [isSubscribed, setIsSubscribed] = useState(initialSubscribed);
    const [subscriptionId, setSubscriptionId] = useState(initialSubId);
    const [isPopoverOpen, setIsPopoverOpen] = useState(false);
    const [isVerifiedModalOpen, setIsVerifiedModalOpen] = useState(false);
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
    const hasSocialLinks = Boolean(
        getSafeExternalUrl(user?.social_links?.discord) ||
        getSafeExternalUrl(user?.social_links?.x) ||
        getSafeExternalUrl(user?.social_links?.telegram) ||
        getSafeExternalUrl(user?.social_links?.youtube)
    );
    const hasSidebar = (!isBanned && achievements.length > 0) || hasSocialLinks || organizations.length > 0;

    return (
        <>
            <div className="layout profile-layout">
                <div className={`profile-page ${hasSidebar ? "" : "profile-page--single"}`}>
                    <main className="profile-page__main">
                        <section className="profile-hero">
                            <img src="https://pbs.twimg.com/profile_banners/2009739561224867840/1781040806/1500x500" className="profile-hero__cover" aria-hidden="true" />

                            <div className="profile-hero__body">
                                <div className="profile-hero__topline">
                                    <div className="subsite-avatar profile-hero__avatar">
                                        <div className="andropov-media andropov-media--rounded andropov-media--bordered andropov-media--cropped andropov-image andropov-image--zoom subsite-avatar__image" aria-label={t("openAvatar")} {...getLightboxTriggerProps({ url: authorAva, title: authorTitle })}>
                                            <img className="magnify" src={authorAva} alt={authorTitle} />
                                        </div>
                                    </div>

                                    {isLoggedIn && (
                                        <div className="profile-page-actions">
                                            {currentUser.id === user.id ? (
                                                <Link href="/settings" className="button button--size-l button--type-secondary button--active-transform">{t("edit")}</Link>
                                            ) : (
                                                <button className={`button button--size-l ${isSubscribed ? "button--type-secondary" : "button--type-primary"}`} type="button" onClick={handleSubscribe}>
                                                    {isSubscribed ? t("subscribed") : t("subscribe")}
                                                </button>
                                            )}

                                            {!isOwnProfile && (
                                                <div className="profile-page-actions__more">
                                                    <button ref={buttonRef} className="icon-button content__etc" type="button" onClick={togglePopover} aria-label={t("moreActionsAria")}>
                                                        <svg viewBox="0 0 24 24" className="icon icon--dots" height="24" width="24">
                                                            <path fillRule="evenodd" clipRule="evenodd" d="M5 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM19 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" fill="currentColor" />
                                                        </svg>
                                                    </button>

                                                    {isPopoverOpen && (
                                                        <div id="popover-overlay" className="popover-overlay">
                                                            <div ref={popoverRef} className="popover profile-page-actions__popover" tabIndex={0}>
                                                                <div className="popover__scrollable">
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

                                <div className="profile-hero__identity">
                                    <h1 className="profile-hero__name">
                                        <UserName showVerifiedIcon={false} user={isBanned ? { username: authorTitle } : user} />

                                        {user.isVerified === 1 && (
                                            <button className="profile-hero__verified" type="button" onClick={() => setIsVerifiedModalOpen(true)} aria-label={t("verifiedModal.creatorBadgeAlt")}>
                                                <img src="/badges/creator.webp" alt="" />
                                            </button>
                                        )}
                                    </h1>

                                    <RoleBadge
                                        role={user.isRole}
                                        labels={{
                                            developer: t("role.developer"),
                                        }}
                                    />
                                </div>

                                <p className="profile-hero__description">{desc}</p>

                                <ProfileStats
                                    projectsCount={publishedProjectsCount}
                                    downloadsCount={authorDownloadsCount}
                                    subscribersCount={countSubs}
                                    subscriptionsCount={countUserSubs}
                                    timestamp={user.created_at}
                                    onOpenFollowModal={handleOpenFollowModal}
                                />
                            </div>
                        </section>

                        <section className="profile-project-feed">
                            <ProfileProjectFeedToolbar username={user.slug} currentPage={currentPage} totalPages={totalPages} currentSort={currentSort} />

                            {projects.length > 0 ? (
                                <div className="browse-project-list">
                                    {projects.map((project) => (
                                        <ProjectCard key={project.id} project={project} />
                                    ))}
                                </div>
                            ) : (
                                <div className="content content--padding subsite-empty-feed">
                                    <p className="subsite-empty-feed__title">{t("noProjects")}</p>
                                </div>
                            )}
                        </section>
                    </main>

                    {hasSidebar && (
                        <aside className="profile-page__aside">
                            <ProfileAchievements achievements={achievements} isBanned={isBanned} />

                            <ProfileLinks socialLinks={user?.social_links} />

                            {organizations.length > 0 && (
                                <section className="content content--padding profile-sidebar-card">
                                    <h2>{t("organizationsTitle")}</h2>

                                    <div className="profile-organization-list">
                                        {organizations.map((organization) => (
                                            <Link key={organization.id} href={`/organization/${organization.slug}`} className="profile-organization-item button--active-transform">
                                                <img src={organization.icon_url} alt={organization.name} />
                                                <span>{organization.name}</span>
                                            </Link>
                                        ))}
                                    </div>
                                </section>
                            )}
                        </aside>
                    )}
                </div>
            </div>

            <ImageLightbox isOpen={lightboxOpen} image={lightboxImage} onClose={closeLightbox} dialogLabel={t("lightboxLabel")} closeLabel={t("close")} openInNewTabLabel={t("openInNewTab")} fallbackAlt={authorTitle} />

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
        </>
    );
}