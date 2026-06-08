"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

export default function ModJamSettingsSidebar({ jam }) {
	const t = useTranslations("ModJamsPage");
	const pathname = usePathname();
	const basePath = `/jams/${jam.slug}`;
	const settingsPath = `${basePath}/settings`;
	const isExact = (href) => pathname === href;
	const isActive = (href) => pathname === href || pathname.startsWith(`${href}/`);

	return (
		<div className="sidebar">
			<div className="sidebar__main">
				<Link href={basePath} scroll={false} className="sidebar-item sidebar-item--profile" data-ripple>
					<img src={jam.avatar_url || "https://media.modifold.com/static/no-project-icon.svg"} alt="" className="icon" width="28" height="28" style={{ borderRadius: "8px" }} />
					
					<span className="sidebar-item__label">{jam.title}</span>
				</Link>

				<div className="sidebar-separator-view _theme_default _size_s"></div>

				<Link href={settingsPath} scroll={false} className={`sidebar-item ${isExact(settingsPath) ? "sidebar-item--active" : ""}`} data-ripple>
					<svg className="icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
						<path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915"></path>
						<circle cx="12" cy="12" r="3"></circle>
					</svg>

					{t("settings.sidebar.general")}
				</Link>

				<Link href={`${settingsPath}/description`} scroll={false} className={`sidebar-item ${isActive(`${settingsPath}/description`) ? "sidebar-item--active" : ""}`} data-ripple>
					<svg className="icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
						<path d="M12 4v16"></path>
						<path d="M4 7V5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v2"></path>
						<path d="M9 20h6"></path>
					</svg>

					{t("settings.sidebar.description")}
				</Link>

				<Link href={`${settingsPath}/rules`} scroll={false} className={`sidebar-item ${isActive(`${settingsPath}/rules`) ? "sidebar-item--active" : ""}`} data-ripple>
					<svg className="icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
						<path d="M12 13V7"/>
						<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20"/>
						<path d="m9 10 3-3 3 3"/>
					</svg>

					{t("settings.sidebar.rules")}
				</Link>

				<Link href={`${settingsPath}/links`} scroll={false} className={`sidebar-item ${isActive(`${settingsPath}/links`) ? "sidebar-item--active" : ""}`} data-ripple>
					<svg className="icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
						<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
						<path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
					</svg>

					{t("settings.sidebar.links")}
				</Link>

				<Link href={`${settingsPath}/nominations`} scroll={false} className={`sidebar-item ${isActive(`${settingsPath}/nominations`) ? "sidebar-item--active" : ""}`} data-ripple>
					<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon lucide lucide-layout-list-icon lucide-layout-list">
						<rect width="7" height="7" x="3" y="3" rx="1"/>
						<rect width="7" height="7" x="3" y="14" rx="1"/>
						<path d="M14 4h7"/>
						<path d="M14 9h7"/>
						<path d="M14 15h7"/>
						<path d="M14 20h7"/>
					</svg>

					{t("settings.sidebar.nominations")}
				</Link>

				<Link href={`${settingsPath}/jury`} scroll={false} className={`sidebar-item ${isActive(`${settingsPath}/jury`) ? "sidebar-item--active" : ""}`} data-ripple>
					<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon lucide lucide-users-icon lucide-users">
						<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
						<path d="M16 3.128a4 4 0 0 1 0 7.744"/>
						<path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
						<circle cx="9" cy="7" r="4"/>
					</svg>

					{t("settings.sidebar.jury")}
				</Link>

				<Link href={`${settingsPath}/moderation`} scroll={false} className={`sidebar-item ${isActive(`${settingsPath}/moderation`) ? "sidebar-item--active" : ""}`} data-ripple>
					<svg className="icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
						<path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"></path>
						<path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"></path>
						<path d="M7 21h10"></path>
						<path d="M12 3v18"></path>
						<path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"></path>
					</svg>

					{t("settings.sidebar.moderation")}
				</Link>
			</div>
		</div>
	);
}