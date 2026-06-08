"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import ProjectCard from "@/components/project/ProjectCard";
import { useAuth } from "../providers/AuthProvider";
import ImageLightbox, { useImageLightbox } from "@/components/ui/ImageLightbox";
import UserName from "@/components/ui/UserName";
import Tooltip from "@/components/ui/Tooltip";

export default function OrganizationPage({ organization, members = [], projects = [], my_permissions = null }) {
    const t = useTranslations("Organizations");
    const tLinks = useTranslations("Organizations.settings.links");
    const locale = useLocale();
    const { isLoggedIn, user } = useAuth();
    const { lightboxOpen, lightboxImage, closeLightbox, getLightboxTriggerProps } = useImageLightbox();
    const canEditOrganization = Boolean(
        isLoggedIn && (
            my_permissions?.is_owner ||
            my_permissions?.organization_permissions?.includes("organization_edit_details") ||
            (user?.id && Number(user.id) === Number(organization?.owner_user_id))
        )
    );

    if(!organization) {
        return null;
    }

    const createdAtDate = Number(organization.created_at) > 0 ? new Date(Number(organization.created_at) * 1000) : null;
    const formattedCreatedAt = createdAtDate ? createdAtDate.toLocaleString(locale || undefined, {
        day: "numeric",
        month: "short",
    }) : null;

    return (
        <>
            <div className="layout">
                <div className="browse-page">
                    <div className="subsite-content">
                        <div className="subsite-header">
                            <div className="subsite-header__padding">
                                <div className="subsite-header__header">
                                    <div className="subsite-avatar subsite-header__avatar" style={{ borderRadius: "12px" }}>
                                        <div className="andropov-media andropov-media--rounded andropov-media--bordered andropov-media--cropped andropov-image andropov-image--zoom subsite-avatar__image" style={{ aspectRatio: "1.5 / 1", maxWidth: "none", borderRadius: "12px" }} aria-label={t("page.openAvatar")} {...getLightboxTriggerProps({ url: organization.icon_url || "https://media.modifold.com/static/no-project-icon.svg", title: organization.name })}>
                                            <img className="magnify" src={organization.icon_url || "https://media.modifold.com/static/no-project-icon.svg"} alt={organization.name} />
                                        </div>
                                    </div>

                                    {canEditOrganization && (
                                        <div className="subsite-header__controls">
                                            <Link href={`/organization/${organization.slug}/settings`} className="button button--size-m button--type-minimal button--active-transform">
                                                {t("page.edit")}
                                            </Link>
                                        </div>
                                    )}
                                </div>

                                <h1 className="subsite-header__name">{organization.name}</h1>
                                
                                <span className="badge--developer" style={{ width: "fit-content", marginBottom: "8px" }}>
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-building2-icon lucide-building-2">
                                        <path d="M10 12h4"></path>
                                        <path d="M10 8h4"></path>
                                        <path d="M14 21v-3a2 2 0 0 0-4 0v3"></path>
                                        <path d="M6 10H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-2"></path>
                                        <path d="M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16"></path>
                                    </svg>

                                    {t("page.organizationBadge")}
                                </span>
                                
                                <p className="subsite-header__description">{organization.summary}</p>

                                {formattedCreatedAt && (
                                    <div className="subsite-header__cols">
                                        <div className="subsite-header__date-created">{t("page.dateCreated", { date: formattedCreatedAt })}</div>
                                    </div>
                                )}
                                
                                <div className="subsite-followers">
                                    <div className="subsite-followers__item">
                                        <span>{members.length}</span> {t("page.membersCount", { count: members.length })}
                                    </div>

                                    <div className="subsite-followers__item">
                                        <span>{projects.length}</span> {t("page.projectsCount", { count: projects.length })}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="content content--padding">
                            <h2>{t("page.membersTitle")}</h2>
                            
                            <div style={{ display: "grid", gap: "10px" }}>
                                {members.map((member) => {
                                    const isOwnerMember = Number(member.user_id) === Number(organization.owner_user_id);

                                    return (
                                        <div key={member.user_id} className="author author-card" style={{ "--1ebedaf6": "40px" }}>
                                            <Link href={`/user/${member.slug}`} className="author__avatar button--active-transform">
                                                <div className="andropov-media andropov-media--rounded andropov-media--bordered andropov-media--loaded andropov-media--has-preview andropov-image" style={{ aspectRatio: "1.77778 / 1", width: "40px", height: "40px", maxWidth: "none" }}>
                                                    <img src={member.avatar || "https://media.modifold.com/static/no-project-icon.svg"} className="magnify" alt={member.username} />
                                                </div>
                                            </Link>

                                            <div className="author__main">
                                                <Link href={`/user/${member.slug}`} className="author__name">
                                                    <UserName user={member} />
                                                </Link>
                                            </div>

                                            <div className="author__details" style={{ display: "flex", alignItems: "center", overflow: "visible" }}>
                                                <span>{member.role}</span>

                                                {isOwnerMember && (
                                                    <Tooltip content={t("page.organizationOwnerTooltip")}>
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" className="lucide lucide-crown" viewBox="0 0 24 24" style={{ color: "#e08325", verticalAlign: "middle", fill: "none" }}>
                                                            <path d="m2 4 3 12h14l3-12-6 7-4-7-4 7z"></path>
                                                            <path d="M5 20h14"></path>
                                                        </svg>
                                                    </Tooltip>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {(organization.discord_url || organization.website_url || organization.twitter_url || organization.bluesky_url || organization.telegram_url || organization.youtube_url) && (
                            <div className="content content--padding">
                                <h2>{t("settings.navLinks")}</h2>

                                <ul className="links-list">
                                    {organization.discord_url && (
                                        <li>
                                            <a href={organization.discord_url} target="_blank" rel="noopener noreferrer">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="71" height="55" fill="none" viewBox="0 0 71 55" className="shrink" aria-hidden="true"><g clipPath="url(#a)"><path fill="currentColor" d="M60.105 4.898A58.6 58.6 0 0 0 45.653.415a.22.22 0 0 0-.233.11 41 41 0 0 0-1.8 3.697c-5.456-.817-10.885-.817-16.23 0-.485-1.164-1.201-2.587-1.828-3.697a.23.23 0 0 0-.233-.11 58.4 58.4 0 0 0-14.451 4.483.2.2 0 0 0-.095.082C1.578 18.73-.944 32.144.293 45.39a.24.24 0 0 0 .093.167c6.073 4.46 11.955 7.167 17.729 8.962a.23.23 0 0 0 .249-.082 42 42 0 0 0 3.627-5.9.225.225 0 0 0-.123-.312 39 39 0 0 1-5.539-2.64.228.228 0 0 1-.022-.378c.372-.279.744-.569 1.1-.862a.22.22 0 0 1 .23-.03c11.619 5.304 24.198 5.304 35.68 0a.22.22 0 0 1 .233.027c.356.293.728.586 1.103.865a.228.228 0 0 1-.02.378 36.4 36.4 0 0 1-5.54 2.637.227.227 0 0 0-.121.315 47 47 0 0 0 3.624 5.897.225.225 0 0 0 .249.084c5.801-1.794 11.684-4.502 17.757-8.961a.23.23 0 0 0 .092-.164c1.48-15.315-2.48-28.618-10.497-40.412a.18.18 0 0 0-.093-.084m-36.38 32.427c-3.497 0-6.38-3.211-6.38-7.156s2.827-7.156 6.38-7.156c3.583 0 6.438 3.24 6.382 7.156 0 3.945-2.827 7.156-6.381 7.156m23.593 0c-3.498 0-6.38-3.211-6.38-7.156s2.826-7.156 6.38-7.156c3.582 0 6.437 3.24 6.38 7.156 0 3.945-2.798 7.156-6.38 7.156"></path></g><defs><clipPath id="a"><path fill="#fff" d="M0 0h71v55H0z"></path></clipPath></defs></svg>

                                                {tLinks("fields.discord")}

                                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>
                                            </a>
                                        </li>
                                    )}

                                    {organization.website_url && (
                                        <li>
                                            <a href={organization.website_url} target="_blank" rel="noopener noreferrer">
                                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                    <path fillRule="evenodd" clipRule="evenodd" d="M9.11765 20.5956C9.34707 21.0256 9.5768 21.4131 9.7964 21.7564C7.46327 21.2317 5.43875 19.8916 4.03784 18.0511C4.96241 17.5304 6.1466 16.9907 7.57021 16.5957C7.97483 18.1827 8.54565 19.5231 9.11765 20.5956ZM10.8824 19.6544C10.3855 18.7228 9.88747 17.5593 9.52867 16.1808C10.3011 16.0661 11.1256 16 12.0001 16C12.8745 16 13.6991 16.0661 14.4713 16.1807C14.1125 17.5593 13.6145 18.7228 13.1176 19.6544C12.7192 20.4015 12.3223 20.9979 12 21.4343C11.6777 20.9979 11.2808 20.4015 10.8824 19.6544ZM9 12C9 12.7788 9.0524 13.518 9.1448 14.2159C10.0359 14.0792 10.9885 14 12.0001 14C13.0116 14 13.9643 14.0791 14.8552 14.2159C14.9476 13.5179 15 12.7788 15 12C15 11.2212 14.9476 10.4821 14.8552 9.78413C13.9643 9.9208 13.0116 10 12.0001 10C10.9885 10 10.0359 9.9208 9.1448 9.78413C9.0524 10.482 9 11.2212 9 12ZM7.18251 9.37173C7.06636 10.1971 7 11.0739 7 12C7 12.9261 7.06636 13.8029 7.18251 14.6283C5.48451 15.0841 4.07843 15.7269 2.99099 16.3455C2.35597 15.0315 2 13.5573 2 12C2 10.4427 2.35597 8.96859 2.99097 7.65451C4.07829 8.27296 5.4844 8.91581 7.18251 9.37173ZM9.52867 7.81927C10.3011 7.93389 11.1256 8 12.0001 8C12.8745 8 13.6991 7.93391 14.4713 7.81929C14.1125 6.44073 13.6145 5.27724 13.1176 4.3456C12.7192 3.59859 12.3223 3.00208 12 2.56576C11.6777 3.00208 11.2808 3.59859 10.8824 4.34557C10.3855 5.27721 9.88747 6.44071 9.52867 7.81927ZM16.8175 9.37187C16.9336 10.1972 17 11.074 17 12C17 12.9261 16.9336 13.8028 16.8175 14.6281C18.5155 15.0841 19.9216 15.7269 21.0091 16.3455C21.644 15.0313 22 13.5572 22 12C22 10.4428 21.644 8.96863 21.0091 7.65457C19.9217 8.27303 18.5156 8.91587 16.8175 9.37187ZM19.9621 5.94904C19.0375 6.46975 17.8533 7.0094 16.4299 7.40437C16.0252 5.81739 15.4544 4.47692 14.8824 3.40443C14.6529 2.97436 14.4232 2.587 14.2036 2.2436C16.5368 2.76831 18.5613 4.10848 19.9621 5.94904ZM7.5702 7.40433C6.14668 7.00935 4.96253 6.46969 4.03785 5.94897C5.43875 4.10845 7.46327 2.76831 9.79627 2.2436C9.5768 2.587 9.34707 2.97435 9.11764 3.4044C8.54565 4.47689 7.97483 5.81735 7.5702 7.40433ZM16.4299 16.5956C16.0252 18.1827 15.4544 19.5231 14.8824 20.5956C14.6529 21.0256 14.4232 21.4131 14.2036 21.7564C16.5368 21.2317 18.5613 19.8915 19.9623 18.0509C19.0376 17.5303 17.8535 16.9907 16.4299 16.5956ZM12 24C18.6275 24 24 18.6275 24 12C24 5.37259 18.6275 0 12 0C5.37259 0 0 5.37259 0 12C0 18.6275 5.37259 24 12 24Z" fill="currentColor"/>
                                                </svg>

                                                {tLinks("fields.website")}

                                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>
                                            </a>
                                        </li>
                                    )}

                                    {organization.twitter_url && (
                                        <li>
                                            <a href={organization.twitter_url} target="_blank" rel="noopener noreferrer">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
                                                    <path fill="currentColor" d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z"></path>
                                                </svg>

                                                {tLinks("fields.twitter")}

                                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>
                                            </a>
                                        </li>
                                    )}

                                    {organization.bluesky_url && (
                                        <li>
                                            <a href={organization.bluesky_url} target="_blank" rel="noopener noreferrer">
                                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                    <g clip-path="url(#clip0_1382_10)">
                                                        <path d="M1.82811 1.94059C1.19061 2.11871 0.885924 2.43746 0.670299 3.16402C0.553111 3.56246 0.557799 4.80465 0.674986 6.18746C0.684361 6.27652 0.707799 6.52027 0.721861 6.72652C0.740611 6.93277 0.764049 7.17652 0.773424 7.26559C0.782799 7.35465 0.801549 7.5984 0.820299 7.80465C0.848424 8.1984 0.928111 8.94371 0.960924 9.14059C0.970299 9.20621 0.989049 9.38434 1.0078 9.53902C1.03592 9.78746 1.06874 9.9984 1.14374 10.3406C1.1953 10.5937 1.43905 11.1187 1.66405 11.4656C2.1703 12.2484 2.98124 12.8812 3.86717 13.1953C3.99842 13.2375 4.14374 13.2937 4.1953 13.3171C4.33592 13.3781 5.04374 13.5328 5.36717 13.575C5.52186 13.5937 5.89686 13.6125 6.19686 13.6125C6.49686 13.6171 6.73124 13.6312 6.71249 13.6453C6.68436 13.664 6.4078 13.725 5.78905 13.8468C5.73749 13.8562 5.56874 13.8984 5.41405 13.9453C5.25936 13.9875 5.07186 14.039 4.99217 14.0578C4.7578 14.1234 4.14842 14.3765 3.84374 14.5406C3.41717 14.7703 3.0328 15.0984 2.81717 15.4218C2.5828 15.7734 2.53124 15.9468 2.49842 16.439C2.44217 17.2828 2.93436 18.3656 3.95155 19.6312C4.99217 20.9296 6.02342 21.7406 7.05936 22.0875C7.47186 22.2234 8.15155 22.2328 8.5078 22.1062C9.35155 21.8062 10.0687 21.0328 10.725 19.7109C11.0859 18.9843 11.6109 17.5828 11.8828 16.5984C11.9719 16.2843 12.0187 16.2421 12.0656 16.439C12.1078 16.6218 12.1922 16.9078 12.4922 17.925C13.1859 20.2406 13.9219 21.4593 14.9109 21.9093C15.2578 22.0687 15.4219 22.0968 15.9375 22.0921C16.4437 22.0875 16.8844 21.9656 17.4609 21.6656C17.8922 21.4406 18.7125 20.9109 18.8437 20.7656C18.8578 20.7515 18.9609 20.6671 19.0781 20.5734C19.3219 20.3765 19.7859 19.9031 20.039 19.5937C20.1328 19.4765 20.2453 19.3406 20.2875 19.289C20.4187 19.1343 20.8594 18.45 20.8594 18.4031C20.8594 18.3796 20.8875 18.3234 20.925 18.2859C20.9625 18.2437 21.0562 18.0187 21.1406 17.789C21.6469 16.3406 21.0797 15.1734 19.4765 14.3812C18.8672 14.0765 18.1078 13.8281 17.4375 13.7062C17.0953 13.6406 17.1844 13.6171 17.7562 13.6125C18.9469 13.6078 19.95 13.364 20.85 12.8625C21.9797 12.2296 22.8234 11.0062 22.9453 9.82027C22.964 9.64215 22.9828 9.48277 22.9922 9.46871C23.0015 9.44527 23.0156 9.33746 23.0859 8.68121C23.1 8.5734 23.1187 8.39527 23.1328 8.28277C23.1422 8.17496 23.1656 7.9359 23.1844 7.75777C23.1984 7.57496 23.2172 7.35465 23.2265 7.26559C23.2359 7.17652 23.2594 6.90934 23.2734 6.67965C23.2922 6.44527 23.3109 6.18277 23.3203 6.09371C23.414 5.13746 23.4422 3.84371 23.3812 3.47809C23.2594 2.7609 23.0062 2.32027 22.5937 2.10934C21.6422 1.62184 20.475 1.92184 18.764 3.08902C18.15 3.5109 18.0047 3.6234 17.6015 3.9609C16.1062 5.22652 14.4 7.17184 13.0687 9.14059C12.6422 9.76871 12.0469 10.7531 12.0469 10.8281C12.0469 10.9359 11.9625 10.8609 11.864 10.6593C11.7375 10.3875 11.2312 9.57652 10.8797 9.07027C10.5797 8.63434 9.89061 7.68746 9.8203 7.61246C9.79686 7.58434 9.72186 7.49059 9.65624 7.40621C9.59061 7.32184 9.51561 7.22809 9.49217 7.19996C9.46405 7.17184 9.30936 6.98434 9.1453 6.77809C8.56405 6.06559 7.41092 4.85621 6.74999 4.26559C6.66092 4.1859 6.54374 4.08277 6.49217 4.0359C5.4703 3.12652 3.76405 2.1234 2.9203 1.94527C2.65311 1.88434 2.03436 1.88434 1.82811 1.94059Z" fill="currentColor"/>
                                                    </g>
                                                    <defs>
                                                        <clipPath id="clip0_1382_10">
                                                            <rect width="24" height="24" fill="white"/>
                                                        </clipPath>
                                                    </defs>
                                                </svg>

                                                {tLinks("fields.bluesky")}

                                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>
                                            </a>
                                        </li>
                                    )}

                                    {organization.telegram_url && (
                                        <li>
                                            <a href={organization.telegram_url} target="_blank" rel="noopener noreferrer">
                                                <svg width="24" height="24" viewBox="0 0 32 32" version="1.1" xmlns="http://www.w3.org/2000/svg">
                                                    <path d="M22.122 10.040c0.006-0 0.014-0 0.022-0 0.209 0 0.403 0.065 0.562 0.177l-0.003-0.002c0.116 0.101 0.194 0.243 0.213 0.403l0 0.003c0.020 0.122 0.031 0.262 0.031 0.405 0 0.065-0.002 0.129-0.007 0.193l0-0.009c-0.225 2.369-1.201 8.114-1.697 10.766-0.21 1.123-0.623 1.499-1.023 1.535-0.869 0.081-1.529-0.574-2.371-1.126-1.318-0.865-2.063-1.403-3.342-2.246-1.479-0.973-0.52-1.51 0.322-2.384 0.221-0.23 4.052-3.715 4.127-4.031 0.004-0.019 0.006-0.040 0.006-0.062 0-0.078-0.029-0.149-0.076-0.203l0 0c-0.052-0.034-0.117-0.053-0.185-0.053-0.045 0-0.088 0.009-0.128 0.024l0.002-0.001q-0.198 0.045-6.316 4.174c-0.445 0.351-1.007 0.573-1.619 0.599l-0.006 0c-0.867-0.105-1.654-0.298-2.401-0.573l0.074 0.024c-0.938-0.306-1.683-0.467-1.619-0.985q0.051-0.404 1.114-0.827 6.548-2.853 8.733-3.761c1.607-0.853 3.47-1.555 5.429-2.010l0.157-0.031zM15.93 1.025c-8.302 0.020-15.025 6.755-15.025 15.060 0 8.317 6.742 15.060 15.060 15.060s15.060-6.742 15.060-15.060c0-8.305-6.723-15.040-15.023-15.060h-0.002q-0.035-0-0.070 0z" fill="currentColor"></path>
                                                </svg>

                                                {tLinks("fields.telegram")}

                                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>
                                            </a>
                                        </li>
                                    )}

                                    {organization.youtube_url && (
                                        <li>
                                            <a href={organization.youtube_url} target="_blank" rel="noopener noreferrer">
                                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                    <path d="M9.6 15.4988V8.50128L15.84 12L9.6 15.4988Z" fill="white"></path>
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
                    </div>

                    <div className="browse-content">
                        {projects.length > 0 ? (
                            <div className="browse-project-list">
                                {projects.map((project) => (
                                    <ProjectCard
                                        key={project.id}
                                        project={{
                                            ...project,
                                            owner: {
                                                username: organization.name,
                                                slug: organization.slug,
                                                avatar: organization.icon_url || "https://media.modifold.com/static/no-project-icon.svg",
                                                type: "organization",
                                                profile_url: `/organization/${organization.slug}`,
                                            },
                                        }}
                                    />
                                ))}
                            </div>
                        ) : (
                            <div className="subsite-empty-feed">
                                <p className="subsite-empty-feed__title">{t("page.emptyProjects")}</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <ImageLightbox isOpen={lightboxOpen} image={lightboxImage} onClose={closeLightbox} dialogLabel={t("page.lightboxLabel")} closeLabel={t("page.close")} openInNewTabLabel={t("page.openInNewTab")} fallbackAlt={organization.name} />
        </>
    );
}