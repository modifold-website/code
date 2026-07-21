"use client";

import { useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

function getBrowseType(pathname) {
	if(pathname.includes("/modpacks") || pathname === "/modpacks") {
		return "modpacks";
	}

	if(pathname.includes("/worlds") || pathname === "/worlds") {
		return "worlds";
	}

	return "mods";
}

export default function BrowseTabs() {
    const t = useTranslations("BrowsePage");
    const pathname = usePathname();
    const browseType = getBrowseType(pathname);
    const isDiscover = pathname.startsWith("/discover/");
    const discoverHref = `/discover/${browseType}`;
    const browseHref = `/${browseType}`;
    const tabsRef = useRef(null);
    const [indicatorStyle, setIndicatorStyle] = useState({ width: 0, left: 0, opacity: 0 });

    useLayoutEffect(() => {
        const updateIndicator = () => {
            const container = tabsRef.current;
            if(!container) {
                return;
            }

            const activeTab = container.querySelector(".tabs__tab--active");
            if(!activeTab) {
                return;
            }

            const left = activeTab.offsetLeft;
            const width = activeTab.offsetWidth;
            setIndicatorStyle({ width, left, opacity: 1 });
        };

        const raf = requestAnimationFrame(updateIndicator);
        window.addEventListener("resize", updateIndicator);
        return () => {
            cancelAnimationFrame(raf);
            window.removeEventListener("resize", updateIndicator);
        };
    }, [pathname]);

    return (
        <div className="tabs" ref={tabsRef} style={{ paddingLeft: "16px", "--40010a00": "46px", "--58752bc5": "0px", "--b2a58f2e": "0" }}>
            <Link href={discoverHref} className={`tabs__tab ${isDiscover ? "tabs__tab--active" : ""}`}>
                {t("discover")}
            </Link>

            <Link href={browseHref} className={`tabs__tab ${!isDiscover ? "tabs__tab--active" : ""}`}>
                {t("browseAll")}
            </Link>

            <span className="tabs__indicator" aria-hidden="true" style={{ width: `${indicatorStyle.width}px`, transform: `translateX(${indicatorStyle.left}px)`, opacity: indicatorStyle.opacity }} />
        </div>
    );
}