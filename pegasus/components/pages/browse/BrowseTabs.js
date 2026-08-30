"use client";

import { useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

let lastBrowseTabsIndicatorStyle = { width: 0, left: 0, opacity: 0 };

function getActiveSection(pathname) {
	if(pathname.startsWith("/discover")) {
		return "discover";
	}

	if(pathname.startsWith("/worlds")) {
		return "worlds";
	}

	if(pathname.startsWith("/prefabs")) {
		return "prefabs";
	}

	return "mods";
}

export default function BrowseTabs() {
	const t = useTranslations("BrowsePage");
	const pathname = usePathname();
	const activeSection = getActiveSection(pathname);
	const tabsRef = useRef(null);
	const [indicatorStyle, setIndicatorStyle] = useState(lastBrowseTabsIndicatorStyle);

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

			const nextIndicatorStyle = {
				width: activeTab.offsetWidth,
				left: activeTab.offsetLeft,
				opacity: 1,
			};

			lastBrowseTabsIndicatorStyle = nextIndicatorStyle;
			setIndicatorStyle(nextIndicatorStyle);
		};

		const raf = requestAnimationFrame(updateIndicator);
		window.addEventListener("resize", updateIndicator);
		return () => {
			cancelAnimationFrame(raf);
			window.removeEventListener("resize", updateIndicator);
		};
	}, [pathname]);

	return (
		<div className="tabs browse-tabs" ref={tabsRef} style={{ paddingLeft: "16px", "--40010a00": "46px", "--58752bc5": "0px", "--b2a58f2e": "0" }}>
			<Link href="/discover" className={`tabs__tab ${activeSection === "discover" ? "tabs__tab--active" : ""}`}>
				{t("discover")}
			</Link>

			<Link href="/mods" className={`tabs__tab ${activeSection === "mods" ? "tabs__tab--active" : ""}`}>
				{t("mods")}
			</Link>

			<Link href="/prefabs" className={`tabs__tab ${activeSection === "prefabs" ? "tabs__tab--active" : ""}`}>
				{t("prefabs")}
			</Link>

			<Link href="/worlds" className={`tabs__tab ${activeSection === "worlds" ? "tabs__tab--active" : ""}`}>
				{t("worlds")}
			</Link>

			<span className="tabs__indicator" aria-hidden="true" style={{ width: `${indicatorStyle.width}px`, transform: `translateX(${indicatorStyle.left}px)`, opacity: indicatorStyle.opacity }} />
		</div>
	);
}