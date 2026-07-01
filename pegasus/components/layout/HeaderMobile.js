"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useAuth } from "../providers/AuthProvider";
import LoginModal from "../../modal/LoginModal";
import ProfileBadgeIcon from "@/components/ui/ProfileBadgeIcon";
import { getProfileBadgeCode } from "@/utils/profileBadges";

export default function HeaderMobile({ authToken }) {
    const t = useTranslations("Header");
    const pathname = usePathname();
    const { isLoggedIn, user, logout } = useAuth();
    const [loginModalOpen, setLoginModalOpen] = useState(false);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const [animatingItem, setAnimatingItem] = useState(null);
    const [pendingActiveItem, setPendingActiveItem] = useState(null);
    const [theme, setThemeState] = useState("system");
    const menuRef = useRef(null);
    const buttonRef = useRef(null);
    const activeProfileBadgeCode = getProfileBadgeCode(user);

    const applyTheme = (nextTheme) => {
        const resolvedTheme = nextTheme === "system" ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : nextTheme === "dark" ? "dark" : "light";

        document.body.classList.remove("light", "dark", "system");
        document.body.classList.add(resolvedTheme);
        document.body.dataset.themePreference = nextTheme;
    };

    useEffect(() => {
        const cookies = document.cookie.split("; ").reduce((acc, cookie) => {
            const [rawName, ...rest] = cookie.split("=");
            const name = rawName?.trim();
            if(!name) {
                return acc;
            }

            acc[name] = decodeURIComponent(rest.join("=") || "");
            return acc;
        }, {});

        const themeFromDataset = document.body?.dataset?.themePreference;
        const savedTheme = cookies.theme === "dark" || cookies.theme === "light" || cookies.theme === "system" ? cookies.theme : themeFromDataset === "dark" || themeFromDataset === "light" || themeFromDataset === "system" ? themeFromDataset : "light";

        setThemeState(savedTheme);
        applyTheme(savedTheme);
    }, []);

    useEffect(() => {
        if(!isLoggedIn) {
            setUnreadCount(0);
            return;
        }

        let isMounted = true;
        let intervalId = null;
        const getToken = () => authToken || localStorage.getItem("authToken");

        const fetchUnreadCount = async () => {
            const token = getToken();
            if(!token) {
                return;
            }

            try {
                const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE}/notifications/unread-count`, {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        Accept: "application/json",
                    },
                });

                if(!response.ok) {
                    return;
                }

                const data = await response.json();
                if(isMounted) {
                    setUnreadCount(Number(data?.unreadCount || 0));
                }
            } catch (error) {
                console.error("Error fetching unread notifications count:", error);
            }
        };

        const handleUnreadUpdate = (event) => {
            const nextCount = Number(event?.detail?.unreadCount);
            if(Number.isFinite(nextCount)) {
                setUnreadCount(Math.max(0, nextCount));
            } else {
                fetchUnreadCount();
            }
        };

        fetchUnreadCount();
        intervalId = setInterval(fetchUnreadCount, 60000);
        window.addEventListener("notifications:updated", handleUnreadUpdate);

        return () => {
            isMounted = false;
            if(intervalId) {
                clearInterval(intervalId);
            }

            window.removeEventListener("notifications:updated", handleUnreadUpdate);
        };
    }, [isLoggedIn, authToken]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if(isMenuOpen && menuRef.current && !menuRef.current.contains(event.target) && buttonRef.current && !buttonRef.current.contains(event.target)) {
                closeAccountMenu();
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [isMenuOpen]);

    useEffect(() => {
        if(pathname === "/" && pendingActiveItem === "home") {
            setPendingActiveItem(null);
        }

        if(pathname === "/mods" && pendingActiveItem === "mods") {
            setPendingActiveItem(null);
        }

        if(pathname === "/notifications" && pendingActiveItem === "notifications") {
            setPendingActiveItem(null);
        }

        if(pathname === "/settings" && pendingActiveItem === "account") {
            setPendingActiveItem(null);
        }
    }, [pathname, pendingActiveItem]);

    useEffect(() => {
        if(theme !== "system") {
            return;
        }

        const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
        const handleChange = () => applyTheme("system");
        mediaQuery.addEventListener("change", handleChange);

        return () => {
            mediaQuery.removeEventListener("change", handleChange);
        };
    }, [theme]);

    const closeAccountMenu = () => {
        setIsMenuOpen(false);
        if(pendingActiveItem === "account") {
            setPendingActiveItem(null);
        }
    };

    const setTheme = (newTheme) => {
        document.cookie = `theme=${newTheme}; path=/; max-age=31536000; samesite=lax`;
        setThemeState(newTheme);
        applyTheme(newTheme);
    };

    const cycleTheme = () => {
        if(theme === "light") {
            setTheme("dark");
            return;
        }

        if(theme === "dark") {
            setTheme("system");
            return;
        }

        setTheme("light");
    };

    const themeLabel = theme === "dark" ? t("theme.dark") : theme === "system" ? t("theme.system") : t("theme.light");

    const toggleAccountMenu = () => {
        setIsMenuOpen((prev) => {
            const nextValue = !prev;
            if(!nextValue && pendingActiveItem === "account") {
                setPendingActiveItem(null);
            }

            return nextValue;
        });
    };

    const triggerTabAnimation = (itemKey) => {
        setAnimatingItem(itemKey);
    };

    const activateTab = (itemKey) => {
        setPendingActiveItem(itemKey);
        triggerTabAnimation(itemKey);
    };

    const handleTabAnimationEnd = (itemKey) => {
        if(animatingItem === itemKey) {
            setAnimatingItem(null);
        }
    };

    const unreadLabel = unreadCount > 99 ? "99+" : String(unreadCount);
    const isActive = (href) => pathname === href;
    const isItemActive = (itemKey, href) => {
        if(pendingActiveItem !== null) {
            return pendingActiveItem === itemKey;
        }

        return isActive(href);
    };

    return (
        <>
            <div className="header-mobile">
                <div className="bar bar--bottom">
                    <div className={`tabbar ${animatingItem ? "tabbar--animating" : ""}`}>
                        <Link href="/" className={`tabbar__item ${isItemActive("home", "/") ? "tabbar__item--active" : ""} ${animatingItem === "home" ? "tabbar__item--animating" : ""}`} onPointerDown={() => activateTab("home")} aria-label={t("home")} data-ripple="center">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="tabbar__icon" onAnimationEnd={() => handleTabAnimationEnd("home")}>
                                <path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/>
                                <path d="M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                            </svg>
                        </Link>

                        <Link href="/mods" className={`tabbar__item ${isItemActive("mods", "/mods") ? "tabbar__item--active" : ""} ${animatingItem === "mods" ? "tabbar__item--animating" : ""}`} onPointerDown={() => activateTab("mods")} aria-label={t("mods")} data-ripple="center">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="tabbar__icon" onAnimationEnd={() => handleTabAnimationEnd("mods")}>
                                <path d="m21 21-4.34-4.34"/>
                                <circle cx="11" cy="11" r="8"/>
                            </svg>
                        </Link>

                        {isLoggedIn && (
                            <Link href="/notifications" className={`tabbar__item ${isItemActive("notifications", "/notifications") ? "tabbar__item--active" : ""} ${animatingItem === "notifications" ? "tabbar__item--animating" : ""}`} onPointerDown={() => activateTab("notifications")} aria-label={t("notifications")} data-ripple="center">
                                {unreadCount > 0 && (
                                    <div className="tabbar__counter counter-label">{unreadLabel}</div>
                                )}

                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="tabbar__icon" onAnimationEnd={() => handleTabAnimationEnd("notifications")}>
                                    <path d="M10.268 21a2 2 0 0 0 3.464 0"/>
                                    <path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326"/>
                                </svg>
                            </Link>
                        )}

                        {isLoggedIn ? (
                            <>
                                <button type="button" ref={buttonRef} className={`tabbar__item ${isItemActive("account", "/settings") ? "tabbar__item--active" : ""} ${animatingItem === "account" ? "tabbar__item--animating" : ""}`} onPointerDown={() => activateTab("account")} onClick={toggleAccountMenu} aria-label={t("myProfile")} data-ripple="center">
                                    <div data-loaded="true" className="andropov-media andropov-media--rounded andropov-media--bordered andropov-media--has-preview tabbar__icon tabbar__avatar andropov-image" style={{ aspectRatio: "1 / 1", width: "28px", height: "28px", maxWidth: "none", "--background-color": "var(--theme-color-background)" }} onAnimationEnd={() => handleTabAnimationEnd("account")}>
                                        <Image width={28} height={28} src={user?.avatar} alt="" loading="lazy" unoptimized />
                                    </div>
                                </button>
                            </>
                        ) : (
                            <button type="button" className={`tabbar__item ${animatingItem === "login" ? "tabbar__item--animating" : ""}`} onPointerDown={() => triggerTabAnimation("login")} onClick={() => setLoginModalOpen(true)} aria-label={t("login")} data-ripple="center">
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="tabbar__icon">
                                    <path d="m10 17 5-5-5-5"/>
                                    <path d="M15 12H3"/>
                                    <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
                                </svg>
                            </button>
                        )}
                    </div>

                    {isLoggedIn && (
                        <div className={`bubble account-menu-root user-menu header-mobile__menu ${isMenuOpen ? "open" : ""}`} ref={menuRef}>
                            <div className="account-menu">
                                <div className="account-menu__title">{t("myProfile")}</div>

                                <Link href={`/user/${user?.slug}`} className="account-menu__user-card button--active-transform" onClick={closeAccountMenu}>
                                    <div className="andropov-media--cropped andropov-media andropov-media--rounded andropov-media--bordered andropov-image account-menu__avatar" style={{ aspectRatio: "480 / 320", width: "34px", height: "34px", maxWidth: "none", maxHeight: "none", backgroundColor: "var(--theme-color-background)" }}>
                                        <Image width={34} height={34} src={user?.avatar} alt="" unoptimized />
                                    </div>

                                    <div className="account-menu__name">
                                        <div className="account-menu__name-label">{user?.username}</div>
                                    
                                        {activeProfileBadgeCode && (
                                            <ProfileBadgeIcon badge={activeProfileBadgeCode} alt="" style={{ width: "18px", pointerEvents: "none" }} />
                                        )}
                                    </div>
                                </Link>

                                <div className="account-menu__section">
                                    {(user?.isRole === "admin" || user?.isRole === "moderator") && (
                                        <div className="account-action">
                                            <Link href="/moderation" className="account-action__wrapper button--active-transform" onClick={closeAccountMenu}>
                                                <svg style={{ fill: "none", color: "#ffa347" }} className="icon icon--settings account-action__icon" height="24" width="24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="m3 6 3 1m0 0-3 9a5 5 0 0 0 6.001 0M6 7l3 9M6 7l6-2m6 2 3-1m-3 1-3 9a5 5 0 0 0 6.001 0M18 7l3 9m-3-9-6-2m0-2v2m0 16V5m0 16H9m3 0h3"></path>
                                                </svg>

                                                <span>{t("moderation")}</span>
                                            </Link>
                                        </div>
                                    )}

                                    <div className="account-action">
                                        <Link href="/dashboard" className="account-action__wrapper button--active-transform" onClick={closeAccountMenu}>
                                            <svg style={{ fill: "none" }} className="icon icon--settings account-action__icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
                                                <path d="m3.3 7 8.7 5 8.7-5" />
                                                <path d="M12 22V12" />
                                            </svg>

                                            <span>{t("projects")}</span>
                                        </Link>
                                    </div>

                                    <div className="account-action">
                                        <Link href="/dashboard/organizations" className="account-action__wrapper button--active-transform" onClick={closeAccountMenu}>
                                            <svg style={{ fill: "none" }} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon icon--settings account-action__icon">
                                                <path d="M10 12h4"></path>
                                                <path d="M10 8h4"></path>
                                                <path d="M14 21v-3a2 2 0 0 0-4 0v3"></path>
                                                <path d="M6 10H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-2"></path>
                                                <path d="M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16"></path>
                                            </svg>

                                            <span>{t("organizations")}</span>
                                        </Link>
                                    </div>

                                    <div className="account-action">
                                        <Link href="/dashboard/likes" className="account-action__wrapper button--active-transform" onClick={closeAccountMenu}>
                                            <svg style={{ fill: "none" }} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon icon--settings account-action__icon">
                                                <path d="M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5"></path>
                                            </svg>

                                            <span>{t("likes")}</span>
                                        </Link>
                                    </div>

                                    <div className="account-action">
                                        <Link href="/notifications" className="account-action__wrapper button--active-transform" onClick={closeAccountMenu}>
                                            <svg className="icon icon--settings account-action__icon" height="24" width="24" viewBox="0 0 24 24">
                                                <path d="M5 10a7 7 0 0 1 14 0v3.764l1.532 3.065A1.5 1.5 0 0 1 19.191 19H15a3 3 0 0 1-6 0H4.809a1.5 1.5 0 0 1-1.342-2.17L5 13.763V10Zm6 9a1 1 0 1 0 2 0h-2Zm1-14a5 5 0 0 0-5 5v4a1 1 0 0 1-.106.447L5.618 17H18.38l-1.276-2.553A1 1 0 0 1 17 14v-4a5 5 0 0 0-5-5Z"></path>
                                            </svg>

                                            <span>{t("notifications")}</span>

                                            {unreadCount > 0 && (
                                                <div className="account-menu--bell__unread-count counter-label">{unreadLabel}</div>
                                            )}
                                        </Link>
                                    </div>

                                    <div className="account-action">
                                        <div onClick={cycleTheme} className="account-action__wrapper button--active-transform">
                                            {theme === "light" && (
                                                <svg style={{ fill: "none" }} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon account-action__icon lucide lucide-sun-icon lucide-sun">
                                                    <circle cx="12" cy="12" r="4"/>
                                                    <path d="M12 2v2"/>
                                                    <path d="M12 20v2"/>
                                                    <path d="m4.93 4.93 1.41 1.41"/>
                                                    <path d="m17.66 17.66 1.41 1.41"/>
                                                    <path d="M2 12h2"/>
                                                    <path d="M20 12h2"/>
                                                    <path d="m6.34 17.66-1.41 1.41"/>
                                                    <path d="m19.07 4.93-1.41 1.41"/>
                                                </svg>
                                            )}

                                            {theme === "dark" && (
                                                <svg style={{ fill: "none" }} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon account-action__icon lucide lucide-moon-icon lucide-moon">
                                                    <path d="M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401"/>
                                                </svg>
                                            )}

                                            {theme === "system" && (
                                                <svg style={{ fill: "none" }} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon account-action__icon lucide lucide-sun-moon-icon lucide-sun-moon">
                                                    <path d="M12 2v2"/>
                                                    <path d="M14.837 16.385a6 6 0 1 1-7.223-7.222c.624-.147.97.66.715 1.248a4 4 0 0 0 5.26 5.259c.589-.255 1.396.09 1.248.715"/>
                                                    <path d="M16 12a4 4 0 0 0-4-4"/>
                                                    <path d="m19 5-1.256 1.256"/>
                                                    <path d="M20 12h2"/>
                                                </svg>
                                            )}

                                            <span>{t("appearance")}: {themeLabel}</span>
                                        </div>
                                    </div>

                                    <div className="account-action">
                                        <Link href="/settings" className="account-action__wrapper button--active-transform" onClick={closeAccountMenu}>
                                            <svg className="icon icon--settings account-action__icon" height="24" width="24" viewBox="0 0 24 24">
                                                <path fillRule="evenodd" clipRule="evenodd" d="M11.997 2c-.824 0-1.506.177-2.04.588-.523.404-.771.934-.925 1.336l-.181.491c-.195.543-.268.747-.604.918-.362.186-.595.137-1.128.023-.154-.032-.333-.07-.547-.11-.428-.078-.991-.135-1.602.085-.615.22-1.14.668-1.618 1.331-.457.636-.66 1.287-.592 1.957.062.624.35 1.138.592 1.518.111.176.208.318.295.446.137.201.251.37.369.587.162.3.244.558.244.83 0 .26-.08.512-.243.812-.117.216-.23.382-.364.579-.089.13-.187.276-.302.458-.242.383-.53.9-.591 1.524-.067.67.134 1.324.592 1.961.477.663 1.003 1.111 1.617 1.332.61.22 1.174.164 1.601.086.215-.039.394-.077.548-.11.533-.112.766-.161 1.13.025.335.172.408.375.603.918.05.14.108.301.18.49.155.403.403.934.927 1.337.533.41 1.215.588 2.039.588.824 0 1.505-.177 2.039-.588.524-.403.771-.934.926-1.336.072-.19.13-.352.18-.491.196-.543.27-.746.605-.918.363-.186.597-.137 1.129-.024.154.032.333.07.548.11.428.077.99.133 1.601-.087.614-.22 1.14-.67 1.617-1.332.458-.637.66-1.29.593-1.96-.063-.625-.35-1.142-.591-1.525a15.718 15.718 0 0 0-.303-.459c-.134-.196-.246-.362-.364-.578-.163-.3-.243-.552-.243-.812 0-.272.082-.53.244-.83.118-.217.233-.386.37-.587.087-.128.183-.27.294-.446.242-.38.53-.894.593-1.518.067-.67-.136-1.321-.593-1.957-.477-.663-1.003-1.111-1.618-1.332-.61-.219-1.174-.162-1.602-.084-.214.04-.393.078-.547.11-.533.114-.767.163-1.129-.022-.335-.172-.409-.376-.603-.919-.05-.14-.109-.301-.181-.49-.155-.403-.402-.933-.926-1.337-.534-.41-1.215-.588-2.04-.588Zm5.528 14.727c-.584-.138-1.627-.385-2.69.16h-.001c-1.115.571-1.468 1.653-1.66 2.237a5.33 5.33 0 0 1-.08.235c-.112.294-.196.405-.279.469-.073.056-.273.172-.818.172-.545 0-.746-.116-.819-.172-.083-.064-.166-.175-.28-.469a5.188 5.188 0 0 1-.08-.235c-.19-.584-.544-1.666-1.658-2.237-1.064-.545-2.107-.298-2.691-.16-.1.024-.185.044-.256.057-.293.053-.444.044-.567 0-.12-.043-.347-.17-.67-.618-.23-.32-.236-.497-.226-.594.014-.143.087-.331.291-.654.048-.076.114-.173.188-.284.17-.254.388-.578.545-.866.257-.473.486-1.06.486-1.768 0-.714-.227-1.304-.485-1.782-.16-.296-.38-.622-.552-.877a13.423 13.423 0 0 1-.183-.276c-.205-.322-.276-.507-.29-.646-.01-.093-.005-.268.226-.589.323-.449.55-.574.669-.617.123-.044.273-.053.567 0 .07.014.156.034.255.058.584.139 1.628.388 2.693-.158 1.114-.571 1.468-1.653 1.659-2.237.03-.092.055-.172.08-.235.113-.294.196-.405.279-.468.073-.057.274-.173.819-.173.545 0 .745.116.818.173.083.063.167.174.28.468.024.063.05.143.08.235.19.584.544 1.666 1.659 2.237 1.064.546 2.108.297 2.692.158.1-.024.186-.044.256-.057.294-.054.445-.045.567 0 .12.042.347.168.67.616.23.321.235.496.226.59-.014.138-.086.323-.29.645-.048.075-.112.169-.184.276l-.552.877c-.258.478-.485 1.068-.485 1.782 0 .709.23 1.295.486 1.768.157.288.375.612.546.866.074.11.14.208.187.284.204.323.277.511.292.654.01.097.003.274-.227.594-.323.449-.55.575-.67.618-.123.044-.273.053-.567 0-.07-.013-.156-.033-.256-.056Z" fill="currentColor"></path>
                                                <path fillRule="evenodd" clipRule="evenodd" d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm0 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z" fill="currentColor"></path>
                                            </svg>

                                            <span>{t("settings")}</span>
                                        </Link>
                                    </div>

                                    <div className="account-action">
                                        <div onClick={() => { closeAccountMenu(); logout(); }} className="account-action__wrapper button--active-transform">
                                            <svg className="icon icon--logout account-action__icon" height="24" width="24" viewBox="0 0 24 24">
                                                <path fillRule="evenodd" clipRule="evenodd" d="M3 7a4 4 0 0 1 4-4h3a1 1 0 1 1 0 2H7a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h3a1 1 0 1 1 0 2H7a4 4 0 0 1-4-4V7Zm11.293-.707a1 1 0 0 1 1.414 0l5 5a1 1 0 0 1 0 1.414l-5 5a1 1 0 0 1-1.414-1.414L17.586 13H9a1 1 0 1 1 0-2h8.586l-3.293-3.293a1 1 0 0 1 0-1.414Z" fill="currentColor"></path>
                                            </svg>

                                            <span>{t("logout")}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <LoginModal isOpen={loginModalOpen} onClose={() => setLoginModalOpen(false)} />
        </>
    );
}