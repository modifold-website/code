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
const PROFILE_IMAGE_MAX_SIZE = 10 * 1024 * 1024;

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

const isAllowedProfileImageFile = (file) => file?.type === "image/jpeg" || file?.type === "image/png" || file?.type === "image/webp" || file?.type === "image/gif";

export default function ProfilePage({ user, isBanned, isSubscribed: initialSubscribed, subscriptionId: initialSubId, authToken, projects = [], totalProjects = null, totalDownloads = null, organizations = [], achievements = [], currentPage = 1, totalPages = 1, currentSort = "downloads" }) {
    const t = useTranslations("ProfilePage");
    const { isLoggedIn, user: currentUser, setUser } = useAuth();
    const [profileUser, setProfileUser] = useState(user);
    const [isSubscribed, setIsSubscribed] = useState(initialSubscribed);
    const [subscriptionId, setSubscriptionId] = useState(initialSubId);
    const [isPopoverOpen, setIsPopoverOpen] = useState(false);
    const [isVerifiedModalOpen, setIsVerifiedModalOpen] = useState(false);
    const [activeFollowModal, setActiveFollowModal] = useState(null);
    const [uploadingProfileImage, setUploadingProfileImage] = useState(null);
    const popoverRef = useRef(null);
    const buttonRef = useRef(null);
    const avatarInputRef = useRef(null);
    const coverInputRef = useRef(null);
    const { lightboxOpen, lightboxImage, closeLightbox, getLightboxTriggerProps } = useImageLightbox();

    useEffect(() => {
        setActiveFollowModal(null);
    }, [user.slug]);

    useEffect(() => {
        setProfileUser(user);
    }, [user]);

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
                const res = await axios.post(`${process.env.NEXT_PUBLIC_API_BASE}/subscriptions`, { userId: profileUser.id }, { headers: { Authorization: `Bearer ${authToken}` } });
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

    const handleProfileImageChange = async (field, event) => {
        if(uploadingProfileImage) {
            return;
        }

        const file = event.target.files?.[0] || null;
        event.target.value = "";

        if(!file) {
            return;
        }

        if(!isAllowedProfileImageFile(file)) {
            toast.error(t("errors.invalidImageType"));
            return;
        }

        if(file.size > PROFILE_IMAGE_MAX_SIZE) {
            toast.error(t("errors.profileImageTooLarge"));
            return;
        }

        if(!authToken) {
            toast.error(t("errors.profileImageUpload"));
            return;
        }

        const data = new FormData();
        data.append(field, file);

        try {
            setUploadingProfileImage(field);
            const res = await axios.put(`${process.env.NEXT_PUBLIC_API_BASE}/users/me`, data, {
                headers: { Authorization: `Bearer ${authToken}` },
            });
            const updatedUser = res.data || {};

            setProfileUser((prev) => ({ ...prev, ...updatedUser }));
            setUser((prev) => ({ ...prev, ...updatedUser }));
            toast.success(t(field === "cover" ? "coverUploadSuccess" : "avatarUploadSuccess"));
        } catch (err) {
            toast.error(err.response?.data?.message || t("errors.profileImageUpload"));
        } finally {
            setUploadingProfileImage(null);
        }
    };

    const handleOpenFollowModal = (type) => {
        const count = type === "subscribers" ? countSubs : countUserSubs;
        if(count < 1) {
            return;
        }

        setActiveFollowModal(type);
    };

    const authorAva = isBanned ? "https://leonardo.osnova.io/8e95d9d3-932c-5f85-8b53-43da2e8ccaeb/-/format/webp/" : profileUser.avatar || "https://cdn.modifold.com/default_avatar.png";
    const authorCover = isBanned ? null : profileUser.cover || null;
    const authorTitle = isBanned ? t("accountFrozen") : profileUser.username;
    const profileDescription = typeof profileUser.description === "string" ? profileUser.description.trim() : "";
    const desc = isBanned ? null : (renderDescription(profileDescription) || t("defaultDescription"));

    const countSubs = profileUser.subscribers || 0;
    const countUserSubs = profileUser.subscriptions || 0;
    const publishedProjectsCount = Math.max(0, Number(totalProjects ?? projects.length) || 0);
    const authorDownloadsCount = Math.max(0, Number(totalDownloads ?? getProjectDownloadsTotal(projects)) || 0);

    const isOwnProfile = isLoggedIn && profileUser.id === currentUser?.id;
    const hasSocialLinks = Boolean(
        getSafeExternalUrl(profileUser?.social_links?.discord) ||
        getSafeExternalUrl(profileUser?.social_links?.x) ||
        getSafeExternalUrl(profileUser?.social_links?.telegram) ||
        getSafeExternalUrl(profileUser?.social_links?.youtube)
    );
    const hasSidebar = (!isBanned && achievements.length > 0) || hasSocialLinks || organizations.length > 0;

    return (
        <>
            <div className="layout profile-layout">
                <input ref={avatarInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(event) => handleProfileImageChange("avatar", event)} style={{ display: "none" }} />
                <input ref={coverInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(event) => handleProfileImageChange("cover", event)} style={{ display: "none" }} />

                <div className={`profile-page ${hasSidebar ? "" : "profile-page--single"}`}>
                    <main className="profile-page__main">
                        <section className="profile-hero">
                            <div className="profile-hero__cover-wrap">
                                {authorCover ? (
                                    <img src={authorCover} className="profile-hero__cover" aria-hidden="true" />
                                ) : (
                                    <div className="profile-hero__cover" aria-hidden="true" />
                                )}

                                {isOwnProfile && (
                                    <div className="profile-hero__new-badge">{t("newProfileBadge")}</div>
                                )}

                                {isOwnProfile && (
                                    <button className={`button button--size-m button--type-minimal button--with-icon subsite-cover-editor__centered ${authorCover ? "subsite-cover-editor__centered--hidden" : ""}`} type="button" onClick={() => coverInputRef.current?.click()}>
                                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-image-icon lucide-image">
                                            <rect width="18" height="18" x="3" y="3" rx="2" ry="2"></rect>
                                            <circle cx="9" cy="9" r="2"></circle>
                                            <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"></path>
                                        </svg>
                                        
                                        {t(authorCover ? "editCover" : "addCover")}
                                    </button>
                                )}
                            </div>

                            <div className="profile-hero__body">
                                <div className="profile-hero__topline">
                                    <div className="subsite-avatar profile-hero__avatar">
                                        <div className="andropov-media andropov-media--rounded andropov-media--bordered andropov-media--cropped andropov-image andropov-image--zoom subsite-avatar__image" aria-label={t("openAvatar")} {...getLightboxTriggerProps({ url: authorAva, title: authorTitle })}>
                                            <img className="magnify" src={authorAva} alt={authorTitle} />
                                        </div>

                                        {isOwnProfile && (
                                            <div className="subsite-avatar__overlay" aria-label={t("uploadAvatar")} onClick={() => avatarInputRef.current?.click()} role="button" tabIndex={0} onKeyDown={(event) => {
                                                if(event.key === "Enter" || event.key === " ") {
                                                    event.preventDefault();
                                                    avatarInputRef.current?.click();
                                                }
                                            }}>
                                                <svg className="icon icon--image" width="40" height="40" viewBox="0 0 24 24">
                                                    <path d="M8 9.5a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0Z"></path>
                                                    <path fillRule="evenodd" clipRule="evenodd" d="M7 3a4 4 0 0 0-4 4v10a4 4 0 0 0 4 4h10a4 4 0 0 0 4-4V7a4 4 0 0 0-4-4H7ZM5 7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v5.252l-1.478-1.477a2 2 0 0 0-3.014.214L8.5 19H7a2 2 0 0 1-2-2V7Zm11.108 5.19L19 15.08V17a2 2 0 0 1-2 2h-6l5.108-6.81Z"></path>
                                                </svg>
                                            </div>
                                        )}
                                    </div>

                                    {isLoggedIn && (
                                        <div className="profile-page-actions">
                                            {currentUser?.id === profileUser.id ? (
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

                                        {profileUser.isVerified === 1 && (
                                            <button className="profile-hero__verified" type="button" onClick={() => setIsVerifiedModalOpen(true)} aria-label={t("verifiedModal.creatorBadgeAlt")}>
                                                <img src="/badges/creator.webp" alt="" />
                                            </button>
                                        )}
                                    </h1>

                                    <RoleBadge
                                        role={profileUser.isRole}
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
                                    timestamp={profileUser.created_at}
                                    onOpenFollowModal={handleOpenFollowModal}
                                />
                            </div>
                        </section>

                        <section className="profile-project-feed">
                            <ProfileProjectFeedToolbar username={profileUser.slug} currentPage={currentPage} totalPages={totalPages} currentSort={currentSort} />

                            {projects.length > 0 ? (
                                <>
                                    <div className="browse-project-list">
                                        {projects.map((project) => (
                                            <ProjectCard key={project.id} project={project} />
                                        ))}
                                    </div>

                                    <ProfileProjectFeedToolbar username={profileUser.slug} currentPage={currentPage} totalPages={totalPages} currentSort={currentSort} showSort={false} className="profile-project-feed__controls--bottom" />
                                </>
                            ) : (
                                <div className="content content--padding subsite-empty-feed">
                                    <p className="subsite-empty-feed__title">{t("noProjects")}</p>
                                </div>
                            )}
                        </section>
                    </main>

                    {hasSidebar && (
                        <aside className="profile-page__aside">
                            <ProfileLinks socialLinks={user?.social_links} />

                            <ProfileAchievements achievements={achievements} isBanned={isBanned} />

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
                username={profileUser.slug}
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