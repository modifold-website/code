"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getProjectPath } from "@/utils/projectRoutes";

const SLIDE_DURATION_MS = 440;

function getProjectImage(project) {
	return project?.gallery?.find((image) => image?.featured === 1)?.url || project?.gallery?.[0]?.url || project?.icon_url || "https://media.modifold.com/static/no-project-icon.svg";
}

function getSlideHref(slide) {
	return slide?.type === "mod-jam" ? `/jams/${slide.item?.slug || ""}` : getProjectPath(slide?.item);
}

function getSlideImage(slide) {
	if(slide?.type === "mod-jam") {
		return slide.item?.cover_url || slide.item?.avatar_url || "https://media.modifold.com/static/no-project-icon.svg";
	}

	return getProjectImage(slide?.item);
}

function getSlidePreviewImage(slide, featuredImage) {
	return slide?.item?.owner?.avatar || slide?.item?.avatar_url || featuredImage;
}

function HeroPane({ slide, t }) {
	if(!slide?.item) {
		return null;
	}

	const item = slide.item;
	const href = getSlideHref(slide);
	const featuredImage = getSlideImage(slide);
	const previewImage = getSlidePreviewImage(slide, featuredImage);
	const ownerHref = item?.owner?.profile_url || `/user/${item?.owner?.slug || ""}`;
	const ownerName = item?.owner?.username || item?.owner?.display_name || "Modifold Creator";
	const isModJam = slide.type === "mod-jam";

	return (
		<>
			<Link href={href} className="browse-recommended-hero__bg-link" aria-label={item?.title || t(isModJam ? "recommended.participate" : "recommended.openProject")}>
				<img className="browse-recommended-hero__bg" src={featuredImage} alt="" />
				<div className="browse-recommended-hero__veil" />
			</Link>

			<div className="browse-recommended-hero__content">
				<div style={{ display: "flex", alignItems: "flex-start", flexDirection: "column", gap: "20px", height: "100%" }}>
					<Link href={href} className="browse-recommended-hero__project-link">
						<h2>{item?.title}</h2>
						<p>{item?.summary || t("recommended.noSummary")}</p>
					</Link>

					<div className="browse-recommended-hero__actions">
						<Link href={ownerHref} className="browse-recommended-hero__owner">
							<img src={previewImage} alt="" width="24" height="24" />
							
							<span>{ownerName}</span>
						</Link>

						<Link href={href} className="button button--size-m button--type-secondary button--active-transform button--with-icon">
							<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
								{isModJam ? (
									<>
										<path d="M5 12h14"></path>
										<path d="M12 5v14"></path>
									</>
								) : (
									<>
										<path d="M7 7h10v10"></path>
										<path d="M7 17 17 7"></path>
									</>
								)}
							</svg>

							{t(isModJam ? "recommended.participate" : "recommended.openProject")}
						</Link>
					</div>
				</div>
			</div>

		</>
	);
}

export default function BrowseRecommendedRail({ projects = [], modJams = [], t, projectType = "mod", initialCollapsed = false }) {
	const slides = useMemo(() => [
		...modJams.map((jam) => ({ type: "mod-jam", item: jam })),
		...projects.map((project) => ({ type: "project", item: project })),
	], [projects, modJams]);
	const [activeIndex, setActiveIndex] = useState(0);
	const [isCollapsed, setIsCollapsed] = useState(Boolean(initialCollapsed));
	const [transitionState, setTransitionState] = useState(null);

	const isAnimating = transitionState !== null;
	const activeSlide = slides[activeIndex];

	const startTransition = (nextIndex, direction) => {
		if(isAnimating || !slides.length || nextIndex === activeIndex) {
			return;
		}

		setTransitionState({
			from: activeIndex,
			to: nextIndex,
			direction,
		});

		window.setTimeout(() => {
			setActiveIndex(nextIndex);
			setTransitionState(null);
		}, SLIDE_DURATION_MS);
	};

	const goPrev = () => startTransition((activeIndex - 1 + slides.length) % slides.length, "left");
	const goNext = () => startTransition((activeIndex + 1) % slides.length, "right");

	useEffect(() => {
		if(slides.length < 2 || isCollapsed || isAnimating) {
			return;
		}

		const timer = window.setInterval(() => {
			startTransition((activeIndex + 1) % slides.length, "right");
		}, 6500);

		return () => window.clearInterval(timer);
	}, [activeIndex, slides.length, isCollapsed, isAnimating]);

	useEffect(() => {
		if(activeIndex > slides.length - 1) {
			setActiveIndex(0);
		}
	}, [activeIndex, slides.length]);

	useEffect(() => {
		try {
			document.cookie = `browse_recommended_collapsed_${projectType}=${isCollapsed ? "1" : "0"}; path=/; max-age=31536000; samesite=lax`;
		} catch {}
	}, [isCollapsed, projectType]);

	if(slides.length === 0) {
		return null;
	}

	const leavingSlide = transitionState ? slides[transitionState.from] : null;
	const enteringSlide = transitionState ? slides[transitionState.to] : null;

	return (
		<section className="browse-recommended-hero" aria-label={t("recommended.ariaLabel")}>
			<div className="browse-recommended-hero__meta">
				<button type="button" className="browse-recommended-hero__collapse button--active-transform" aria-label={isCollapsed ? t("recommended.expand") : t("recommended.collapse")} aria-expanded={!isCollapsed} onClick={() => setIsCollapsed((prev) => !prev)}>
					<svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
						{isCollapsed ? <path d="m6 9 6 6 6-6"/> : <path d="m18 15-6-6-6 6"/>}
					</svg>
				</button>
			</div>

			{!isCollapsed && (
				<div className="browse-recommended-hero__frame">
					{transitionState ? (
						<>
							<div className={`browse-recommended-hero__pane browse-recommended-hero__pane--leave ${transitionState.direction === "right" ? "to-left" : "to-right"}`}>
								<HeroPane slide={leavingSlide} t={t} />
							</div>

							<div className={`browse-recommended-hero__pane browse-recommended-hero__pane--enter ${transitionState.direction === "right" ? "from-right" : "from-left"}`}>
								<HeroPane slide={enteringSlide} t={t} />
							</div>
						</>
					) : (
						<div className="browse-recommended-hero__pane browse-recommended-hero__pane--active">
							<HeroPane slide={activeSlide} t={t} />
						</div>
					)}

					{slides.length > 1 && (
						<>
							<button className="browse-recommended-hero__arrow browse-recommended-hero__arrow--left" type="button" aria-label={t("previous")} onClick={goPrev} disabled={isAnimating}>
								<svg style={{ marginRight: "2px" }} xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
									<path d="m15 18-6-6 6-6"/>
								</svg>
							</button>

							<button className="browse-recommended-hero__arrow browse-recommended-hero__arrow--right" type="button" aria-label={t("next")} onClick={goNext} disabled={isAnimating}>
								<svg style={{ marginLeft: "2px" }} xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
									<path d="m9 18 6-6-6-6"/>
								</svg>
							</button>

							<div className="browse-recommended-hero__dots" role="tablist" aria-label={t("recommended.ariaLabel")}>
								{slides.map((slide, index) => {
									const activeDotIndex = transitionState ? transitionState.to : activeIndex;
									return (
										<button
											key={`${slide.type}-${slide.item?.id || slide.item?.slug || index}`}
											type="button"
											className={`browse-recommended-hero__dot ${index === activeDotIndex ? "is-active" : ""}`}
											onClick={() => {
												if(index === activeIndex) {
													return;
												}
												startTransition(index, index > activeIndex ? "right" : "left");
											}}
											aria-label={`${index + 1}`}
											aria-current={index === activeDotIndex ? "true" : undefined}
											disabled={isAnimating}
										/>
									);
								})}
							</div>
						</>
					)}
				</div>
			)}
		</section>
	);
}