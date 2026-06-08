"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import UserName from "./UserName";
import { getCookieValue, isDeveloperModeEnabledFromCookieValue } from "@/utils/featureFlags";

export default function UserSettingsSidebar({ user, labels, profileIconAlt, mode = "all", isFeatureFlagsVisible = false }) {
    const pathname = usePathname();
    const isActive = (href) => pathname === href;
    const showDashboard = mode === "all" || mode === "dashboard";
    const showSettings = mode === "all" || mode === "settings";
    const showPublicSettings = mode === "public-settings";
    const [isFeatureFlagsVisibleOnClient, setIsFeatureFlagsVisibleOnClient] = useState(isFeatureFlagsVisible);
    const isFlagsPage = isActive("/settings/flags");
    const shouldShowFeatureFlags = isFlagsPage || isFeatureFlagsVisible || isFeatureFlagsVisibleOnClient;

    useEffect(() => {
        const featureFlagsCookieValue = getCookieValue(document.cookie, "featureFlags");
        setIsFeatureFlagsVisibleOnClient(isDeveloperModeEnabledFromCookieValue(featureFlagsCookieValue));
    }, []);

    return (
        <div className="sidebar">
            <div className="sidebar__main">
                {!showPublicSettings && (
                    <Link href={`/user/${user?.slug || ""}`} scroll={false} className="sidebar-item sidebar-item--profile" data-ripple>
                        <img src={user?.avatar || "https://media.modifold.com/static/no-project-icon.svg"} alt={profileIconAlt} className="icon" width="28" height="28" style={{ borderRadius: "100px" }} />

                        <UserName user={user} />
                    </Link>
                )}

                {!showPublicSettings && (showDashboard || showSettings) && (
                    <div className="sidebar-separator-view _theme_default _size_s"></div>
                )}

                {showDashboard && !showPublicSettings && (
                    <>
                        <Link href="/dashboard" scroll={false} className={`sidebar-item ${isActive("/dashboard") ? "sidebar-item--active" : ""}`} data-ripple>
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon lucide lucide-box-icon lucide-box">
                                <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
                                <path d="m3.3 7 8.7 5 8.7-5" />
                                <path d="M12 22V12" />
                            </svg>

                            {labels.projects}
                        </Link>

                        <Link href="/dashboard/organizations" scroll={false} className={`sidebar-item ${isActive("/dashboard/organizations") ? "sidebar-item--active" : ""}`} data-ripple>
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon lucide lucide-building2-icon lucide-building-2">
                                <path d="M10 12h4"></path>
                                <path d="M10 8h4"></path>
                                <path d="M14 21v-3a2 2 0 0 0-4 0v3"></path>
                                <path d="M6 10H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-2"></path>
                                <path d="M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16"></path>
                            </svg>

                            {labels.organizations}
                        </Link>

                        <Link href="/dashboard/jams" scroll={false} className={`sidebar-item ${isActive("/dashboard/jams") ? "sidebar-item--active" : ""}`} data-ripple>
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon lucide lucide-trophy-icon lucide-trophy">
                                <path d="M10 14.66v1.626a2 2 0 0 1-.976 1.696A5 5 0 0 0 7 21.978"/>
                                <path d="M14 14.66v1.626a2 2 0 0 0 .976 1.696A5 5 0 0 1 17 21.978"/>
                                <path d="M18 9h1.5a1 1 0 0 0 0-5H18"/>
                                <path d="M4 22h16"/>
                                <path d="M6 9a6 6 0 0 0 12 0V3a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1z"/>
                                <path d="M6 9H4.5a1 1 0 0 1 0-5H6"/>
                            </svg>

                            {labels.jams}
                        </Link>

                        <Link href="/dashboard/likes" scroll={false} className={`sidebar-item ${isActive("/dashboard/likes") ? "sidebar-item--active" : ""}`} data-ripple>
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon lucide lucide-heart-icon lucide-heart">
                                <path d="M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5" />
                            </svg>

                            {labels.likes}
                        </Link>

                        <Link href="/notifications" scroll={false} className={`sidebar-item ${isActive("/notifications") ? "sidebar-item--active" : ""}`} data-ripple>
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon lucide lucide-bell-icon lucide-bell">
                                <path d="M10.268 21a2 2 0 0 0 3.464 0" />
                                <path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326" />
                            </svg>

                            {labels.notifications}
                        </Link>
                    </>
                )}

                {showDashboard && showSettings && !showPublicSettings && (
                    <div className="sidebar-separator-view _theme_default _size_s"></div>
                )}

                {showSettings && !showPublicSettings && (
                    <>
                        <Link href="/settings" scroll={false} className={`sidebar-item ${isActive("/settings") ? "sidebar-item--active" : ""}`} data-ripple>
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon lucide lucide-user-icon lucide-user">
                                <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/>
                                <circle cx="12" cy="7" r="4"/>
                            </svg>

                            {labels.profile}
                        </Link>

                        <Link href="/settings/appearance" scroll={false} className={`sidebar-item ${isActive("/settings/appearance") ? "sidebar-item--active" : ""}`} data-ripple>
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon lucide lucide-palette-icon lucide-palette">
                                <path d="M12 22a1 1 0 0 1 0-20 10 9 0 0 1 10 9 5 5 0 0 1-5 5h-2.25a1.75 1.75 0 0 0-1.4 2.8l.3.4a1.75 1.75 0 0 1-1.4 2.8z"/>
                                <circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/>
                                <circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/>
                                <circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/>
                                <circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/>
                            </svg>

                            {labels.appearance}
                        </Link>

                        <Link href="/settings/language" scroll={false} className={`sidebar-item ${isActive("/settings/language") ? "sidebar-item--active" : ""}`} data-ripple>
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon lucide lucide-languages-icon lucide-languages">
                                <path d="m5 8 6 6"/>
                                <path d="m4 14 6-6 2-3"/>
                                <path d="M2 5h12"/>
                                <path d="M7 2h1"/>
                                <path d="m22 22-5-10-5 10"/>
                                <path d="M14 18h6"/>
                            </svg>

                            {labels.language}
                        </Link>
                        
                        {shouldShowFeatureFlags && (
                            <Link href="/settings/flags" scroll={false} className={`sidebar-item ${isFlagsPage ? "sidebar-item--active" : ""}`} data-ripple>
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon lucide lucide-toggle-right-icon lucide-toggle-right">
                                    <circle cx="15" cy="12" r="3"/>
                                    <rect width="20" height="14" x="2" y="5" rx="7"/>
                                </svg>

                                {labels.featureFlags}
                            </Link>
                        )}

                        <Link href="/settings/account-security" scroll={false} className={`sidebar-item ${isActive("/settings/account-security") ? "sidebar-item--active" : ""}`} data-ripple>
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon lucide lucide-shield-icon lucide-shield">
                                <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>
                            </svg>

                            {labels.accountSecurity}
                        </Link>

                        <Link href="/settings/api" scroll={false} className={`sidebar-item ${isActive("/settings/api") ? "sidebar-item--active" : ""}`} data-ripple>
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon lucide lucide-braces-icon lucide-braces">
                                <path d="M8 3H7a2 2 0 0 0-2 2v5a2 2 0 0 1-2 2 2 2 0 0 1 2 2v5c0 1.1.9 2 2 2h1"/>
                                <path d="M16 21h1a2 2 0 0 0 2-2v-5c0-1.1.9-2 2-2a2 2 0 0 1-2-2V5a2 2 0 0 0-2-2h-1"/>
                            </svg>

                            {labels.apiTokens}
                        </Link>

                        <Link href="/settings/creator-badge" scroll={false} className={`sidebar-item ${(isActive("/settings/creator-badge") || isActive("/settings/verification")) ? "sidebar-item--active" : ""}`} data-ripple>
                            <img src="/badges/creator.webp" style={{ width: "24px", marginRight: "12px" }} />

                            {labels.verification}
                        </Link>
                    </>
                )}

                {showPublicSettings && (
                    <>
                        <Link href="/settings/appearance" scroll={false} className={`sidebar-item ${isActive("/settings/appearance") ? "sidebar-item--active" : ""}`} data-ripple>
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon lucide lucide-palette-icon lucide-palette">
                                <path d="M12 22a1 1 0 0 1 0-20 10 9 0 0 1 10 9 5 5 0 0 1-5 5h-2.25a1.75 1.75 0 0 0-1.4 2.8l.3.4a1.75 1.75 0 0 1-1.4 2.8z"/>
                                <circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/>
                                <circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/>
                                <circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/>
                                <circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/>
                            </svg>

                            {labels.appearance}
                        </Link>

                        <Link href="/settings/language" scroll={false} className={`sidebar-item ${isActive("/settings/language") ? "sidebar-item--active" : ""}`} data-ripple>
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon lucide lucide-languages-icon lucide-languages">
                                <path d="m5 8 6 6"/>
                                <path d="m4 14 6-6 2-3"/>
                                <path d="M2 5h12"/>
                                <path d="M7 2h1"/>
                                <path d="m22 22-5-10-5 10"/>
                                <path d="M14 18h6"/>
                            </svg>

                            {labels.language}
                        </Link>

                        {shouldShowFeatureFlags && (
                            <Link href="/settings/flags" scroll={false} className={`sidebar-item ${isFlagsPage ? "sidebar-item--active" : ""}`} data-ripple>
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon lucide lucide-toggle-right-icon lucide-toggle-right">
                                    <circle cx="15" cy="12" r="3"/>
                                    <rect width="20" height="14" x="2" y="5" rx="7"/>
                                </svg>

                                {labels.featureFlags}
                            </Link>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}