"use client";

import { useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

export default function BrowseTabs() {
    const t = useTranslations("BrowsePage");
    const pathname = usePathname();
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
            <Link href="/mods" className={`tabs__tab ${pathname === "/mods" ? "tabs__tab--active" : ""}`}>
                {t("mods")}
            </Link>

            <Link href="/modpacks" className={`tabs__tab ${pathname === "/modpacks" ? "tabs__tab--active" : ""}`}>
                {t("modpacks")}
            </Link>

            <span className="tabs__indicator" aria-hidden="true" style={{ width: `${indicatorStyle.width}px`, transform: `translateX(${indicatorStyle.left}px)`, opacity: indicatorStyle.opacity }} />
        </div>
    );
}