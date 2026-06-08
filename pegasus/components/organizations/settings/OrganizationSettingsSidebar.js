"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

export default function OrganizationSettingsSidebar({ organization }) {
    const pathname = usePathname();
    const t = useTranslations("Organizations");
    const basePath = `/organization/${organization.slug}/settings`;

    const isActive = (href) => pathname === href;

    return (
        <div className="sidebar">
            <div className="sidebar__main">
                <Link href={`/organization/${organization.slug}`} className="sidebar-item" data-ripple>
                    <img src={organization.icon_url || "https://media.modifold.com/static/no-project-icon.svg"} alt={t("settings.iconAlt", { name: organization.name })} className="icon" width="28" height="28" style={{ borderRadius: "8px" }} />
                    
                    <span>{organization.name}</span>
                </Link>

                <div className="sidebar-separator-view _theme_default _size_s"></div>

                <Link href={basePath} className={`sidebar-item ${isActive(basePath) ? "sidebar-item--active" : ""}`} data-ripple>
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon lucide lucide-settings-icon lucide-settings">
                        <path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915" />
                        <circle cx="12" cy="12" r="3" />
                    </svg>

                    {t("settings.navOverview")}
                </Link>

                <Link href={`${basePath}/members`} className={`sidebar-item ${isActive(`${basePath}/members`) ? "sidebar-item--active" : ""}`} data-ripple>
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon lucide lucide-users-round-icon lucide-users-round">
                        <path d="M18 21a8 8 0 0 0-16 0" />
                        <circle cx="10" cy="8" r="5" />
                        <path d="M22 20c0-3.37-2-6.5-4-8a5 5 0 0 0-.45-8.3" />
                    </svg>

                    {t("settings.navMembers")}
                </Link>

                <Link href={`${basePath}/links`} className={`sidebar-item ${isActive(`${basePath}/links`) ? "sidebar-item--active" : ""}`} data-ripple>
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon lucide lucide-link-icon lucide-link">
                        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                    </svg>

                    {t("settings.navLinks")}
                </Link>

                <Link href={`${basePath}/projects`} className={`sidebar-item ${isActive(`${basePath}/projects`) ? "sidebar-item--active" : ""}`} data-ripple>
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon lucide lucide-box-icon lucide-box">
                        <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/>
                        <path d="m3.3 7 8.7 5 8.7-5"/>
                        <path d="M12 22V12"/>
                    </svg>

                    {t("settings.navProjects")}
                </Link>
            </div>
        </div>
    );
}