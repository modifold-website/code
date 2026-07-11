"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

function getCurrentRouteKey() {
	if(typeof window === "undefined") {
		return "";
	}

	return `${window.location.pathname}${window.location.search}`;
}

function isModifiedClick(event) {
	return event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0;
}

function shouldStartNavigation(event) {
	if(event.defaultPrevented || isModifiedClick(event)) {
		return false;
	}

	const link = event.target.closest?.("a[href]");
	if(!link || link.target && link.target !== "_self" || link.hasAttribute("download")) {
		return false;
	}

	const href = link.getAttribute("href");
	if(!href || href.startsWith("#")) {
		return false;
	}

	const url = new URL(link.href, window.location.href);
	if(url.origin !== window.location.origin) {
		return false;
	}

	return `${url.pathname}${url.search}` !== getCurrentRouteKey();
}

function shouldStartHistoryNavigation(url) {
	if(!url) {
		return false;
	}

	const nextUrl = new URL(String(url), window.location.href);
	if(nextUrl.origin !== window.location.origin) {
		return false;
	}

	return `${nextUrl.pathname}${nextUrl.search}` !== getCurrentRouteKey();
}

export default function NavigationProgressBar() {
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const [isVisible, setIsVisible] = useState(false);
	const [progress, setProgress] = useState(0);
	const isLoadingRef = useRef(false);
	const isVisibleRef = useRef(false);
	const previousRouteRef = useRef("");
	const showTimerRef = useRef(null);
	const trickleTimerRef = useRef(null);
	const finishTimerRef = useRef(null);
	const resetTimerRef = useRef(null);
	const maxTimerRef = useRef(null);
	const frameRef = useRef(null);

	const clearTimers = () => {
		window.clearTimeout(showTimerRef.current);
		window.clearInterval(trickleTimerRef.current);
		window.clearTimeout(finishTimerRef.current);
		window.clearTimeout(resetTimerRef.current);
		window.clearTimeout(maxTimerRef.current);
		window.cancelAnimationFrame(frameRef.current);
	};

	const startNavigation = () => {
		if(isLoadingRef.current) {
			return;
		}

		clearTimers();
		isLoadingRef.current = true;
		isVisibleRef.current = false;
		setProgress(0);
		setIsVisible(false);

		showTimerRef.current = window.setTimeout(() => {
			if(!isLoadingRef.current) {
				return;
			}

			isVisibleRef.current = true;
			setIsVisible(true);
			frameRef.current = requestAnimationFrame(() => setProgress(8));
			trickleTimerRef.current = window.setInterval(() => {
				setProgress((currentProgress) => {
					if(currentProgress >= 88) {
						return currentProgress;
					}

					return Math.min(88, currentProgress + Math.max(0.5, (88 - currentProgress) * 0.08));
				});
			}, 220);
		}, 90);

		maxTimerRef.current = window.setTimeout(() => {
			finishNavigation();
		}, 10000);
	};

	const finishNavigation = () => {
		window.clearTimeout(showTimerRef.current);
		window.clearInterval(trickleTimerRef.current);
		window.clearTimeout(maxTimerRef.current);

		if(!isLoadingRef.current) {
			return;
		}

		isLoadingRef.current = false;

		if(!isVisibleRef.current) {
			setProgress(0);
			return;
		}

		setProgress(100);
		finishTimerRef.current = window.setTimeout(() => {
			isVisibleRef.current = false;
			setIsVisible(false);
		}, 180);
		resetTimerRef.current = window.setTimeout(() => {
			setProgress(0);
		}, 280);
	};

	useEffect(() => {
		previousRouteRef.current = getCurrentRouteKey();
	}, []);

	useEffect(() => {
		const originalPushState = window.history.pushState;
		const originalReplaceState = window.history.replaceState;
		const handleClick = (event) => {
			if(shouldStartNavigation(event)) {
				startNavigation();
			}
		};

		const handlePopState = () => {
			startNavigation();
		};

		window.history.pushState = function pushState(state, title, url) {
			if(shouldStartHistoryNavigation(url)) {
				startNavigation();
			}

			return originalPushState.apply(this, arguments);
		};

		window.history.replaceState = function replaceState(state, title, url) {
			if(shouldStartHistoryNavigation(url)) {
				startNavigation();
			}

			return originalReplaceState.apply(this, arguments);
		};

		document.addEventListener("click", handleClick, true);
		window.addEventListener("popstate", handlePopState);

		return () => {
			window.history.pushState = originalPushState;
			window.history.replaceState = originalReplaceState;
			document.removeEventListener("click", handleClick, true);
			window.removeEventListener("popstate", handlePopState);
			clearTimers();
		};
	}, []);

	useEffect(() => {
		const routeKey = `${pathname || ""}${searchParams?.toString() ? `?${searchParams.toString()}` : ""}`;

		if(!previousRouteRef.current) {
			previousRouteRef.current = routeKey;
			return;
		}

		if(previousRouteRef.current === routeKey) {
			return;
		}

		previousRouteRef.current = routeKey;
		finishNavigation();
	}, [pathname, searchParams]);

	return (
		<div className={`navigation-progress ${isVisible ? "navigation-progress--visible" : ""}`} aria-hidden="true">
			<div className="navigation-progress__bar" style={{ transform: `scaleX(${progress / 100})` }} />
		</div>
	);
}