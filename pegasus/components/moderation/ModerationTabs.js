"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

export default function ModerationTabs() {
    const t = useTranslations("ModerationPage");
    const pathname = usePathname();
    const tabsRef = useRef(null);
    const [indicatorStyle, setIndicatorStyle] = useState({ width: 0, left: 0, opacity: 0 });

    useEffect(() => {
        const updateIndicator = () => {
            const container = tabsRef.current;
            if(!container) {
                return;
            }

            const activeTab = container.querySelector('[aria-current="page"]');
            if(!activeTab) {
                setIndicatorStyle({ width: 0, left: 0, opacity: 0 });
                return;
            }

            const containerRect = container.getBoundingClientRect();
            const tabRect = activeTab.getBoundingClientRect();
            setIndicatorStyle({
                width: tabRect.width,
                left: tabRect.left - containerRect.left,
                opacity: 1,
            });
        };

        const raf = requestAnimationFrame(updateIndicator);
        window.addEventListener("resize", updateIndicator);
        return () => {
            cancelAnimationFrame(raf);
            window.removeEventListener("resize", updateIndicator);
        };
    }, [pathname]);

    return (
        <nav className="pagination moderation-tabs" ref={tabsRef} aria-label="Moderation sections">
            <Link href="/moderation/statistics" data-ripple className="pagination__button" aria-current={pathname === "/moderation/statistics" ? "page" : undefined}>
                {t("tabs.statistics")}
            </Link>
            
            <Link href="/moderation" data-ripple className="pagination__button" aria-current={pathname === "/moderation" ? "page" : undefined}>
                {t("tabs.projects")}
            </Link>

            <Link href="/moderation/reports" data-ripple className="pagination__button" aria-current={pathname === "/moderation/reports" ? "page" : undefined}>
                {t("tabs.reports")}
            </Link>

            <Link href="/moderation/technical-review" data-ripple className="pagination__button" aria-current={pathname === "/moderation/technical-review" ? "page" : undefined}>
                {t("tabs.technicalReview")}
            </Link>

            <Link href="/moderation/users" data-ripple className="pagination__button" aria-current={pathname === "/moderation/users" ? "page" : undefined}>
                {t("tabs.users")}
            </Link>

            <Link href="/moderation/mod-jams" data-ripple className="pagination__button" aria-current={pathname === "/moderation/mod-jams" ? "page" : undefined}>
                Mod jams
            </Link>

            <span className="pagination__indicator" aria-hidden="true" style={{ width: `${indicatorStyle.width}px`, transform: `translateX(${indicatorStyle.left}px)`, opacity: indicatorStyle.opacity }} />
        </nav>
    );
}