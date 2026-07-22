"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import UserName from "@/components/ui/UserName";
import { getProjectPath } from "@/utils/projectRoutes";
import { getOwnerHref, getProjectImage, SLIDE_INTERVAL_MS } from "./discoverHelpers";

const SLIDE_TRANSITION_MS = 560;

function useAutoSlide(length) {
	const [activeIndex, setActiveIndex] = useState(0);
	const [timerVersion, setTimerVersion] = useState(0);
	const [transitionState, setTransitionState] = useState(null);
	const transitionTimerRef = useRef(null);

	const resetTimer = useCallback(() => {
		setTimerVersion((version) => version + 1);
	}, []);

	const startTransition = useCallback((index, direction) => {
		if(length < 1) {
			return;
		}

		const nextIndex = ((index % length) + length) % length;
		if(nextIndex === activeIndex || transitionState) {
			return;
		}

		setTransitionState({
			from: activeIndex,
			to: nextIndex,
			direction,
		});

		window.clearTimeout(transitionTimerRef.current);
		transitionTimerRef.current = window.setTimeout(() => {
			setActiveIndex(nextIndex);
			setTransitionState(null);
			resetTimer();
		}, SLIDE_TRANSITION_MS);
	}, [activeIndex, length, resetTimer, transitionState]);

	const selectIndex = (index) => {
		if(length < 1) {
			return;
		}

		const nextIndex = ((index % length) + length) % length;
		const forwardDistance = (nextIndex - activeIndex + length) % length;
		const backwardDistance = (activeIndex - nextIndex + length) % length;
		startTransition(nextIndex, forwardDistance <= backwardDistance ? "right" : "left");
	};

	const moveIndex = (direction) => {
		if(length < 1) {
			return;
		}

		startTransition(activeIndex + direction, direction > 0 ? "right" : "left");
	};

	useEffect(() => {
		if(length < 2 || transitionState) {
			return;
		}

		const timer = window.setInterval(() => {
			startTransition(activeIndex + 1, "right");
		}, SLIDE_INTERVAL_MS);

		return () => window.clearInterval(timer);
	}, [activeIndex, length, startTransition, timerVersion, transitionState]);

	useEffect(() => {
		if(activeIndex > length - 1) {
			window.clearTimeout(transitionTimerRef.current);
			setTransitionState(null);
			setActiveIndex(0);
		}
	}, [activeIndex, length]);

	useEffect(() => () => window.clearTimeout(transitionTimerRef.current), []);

	return [activeIndex, selectIndex, moveIndex, timerVersion, transitionState];
}

function FeaturedPane({ project, t }) {
	if(!project) {
		return null;
	}

	const ownerAvatar = project.owner?.avatar || "https://media.modifold.com/static/no-project-icon.svg";

	return (
		<>
			<Link href={getProjectPath(project)} className="discover-featured__image-link" aria-label={project.title}>
				<img className="discover-featured__image" src={getProjectImage(project)} alt="" />
				
				<span className="discover-featured__shade" />
			</Link>

			<div className="discover-featured__content">
				<span className="discover-featured__eyebrow">
					<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-star-icon lucide-star" aria-hidden="true">
						<path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"/>
					</svg>
					
					{t("featured")}
				</span>
				
				<Link href={getProjectPath(project)} className="discover-featured__title-link">
					<h1>{project.title}</h1>
				</Link>

				<Link href={getOwnerHref(project)} className="discover-featured__author">
					<img className="discover-author__avatar" src={ownerAvatar} alt="" loading="lazy" />
					
					<UserName user={project.owner} className="discover-author__name" />
				</Link>
			</div>
		</>
	);
}

function getSlideImagePosition(index, activeIndex, transitionState, length) {
	if(length < 2) {
		return index === activeIndex ? "current" : "hidden";
	}

	if(!transitionState) {
		if(index === activeIndex) {
			return "current";
		}

		if(index === (activeIndex - 1 + length) % length) {
			return "previous";
		}

		if(index === (activeIndex + 1) % length) {
			return "next";
		}

		return "hidden";
	}

	const { direction, from, to } = transitionState;
	if(direction === "right") {
		if(index === from) {
			return "current-to-previous";
		}

		if(index === to) {
			return "next-to-current";
		}

		if(length > 2 && index === (from - 1 + length) % length) {
			return "previous-exit";
		}

		if(length > 2 && index === (to + 1) % length) {
			return "next-enter";
		}

		return "hidden";
	}

	if(index === from) {
		return "current-to-next";
	}

	if(index === to) {
		return "previous-to-current";
	}

	if(length > 2 && index === (from + 1) % length) {
		return "next-exit";
	}

	if(length > 2 && index === (to - 1 + length) % length) {
		return "previous-enter";
	}

	return "hidden";
}

function FeaturedImageSlide({ project, position, t }) {
	if(!project) {
		return null;
	}

	return (
		<div className={`discover-featured__slide discover-featured__slide--${position}`} aria-hidden={position === "hidden" ? "true" : undefined}>
			<FeaturedPane project={project} t={t} />
		</div>
	);
}

export default function FeaturedHero({ projects, t }) {
	const slides = projects.slice(0, 5);
	const [activeIndex, selectIndex, moveIndex, timerVersion, transitionState] = useAutoSlide(slides.length);
	const activeProject = slides[activeIndex];
	const activeDotIndex = transitionState ? transitionState.to : activeIndex;
	const isAnimating = transitionState !== null;

	if(!activeProject) {
		return null;
	}

	return (
		<section className={`discover-featured ${isAnimating ? "discover-featured--animating" : ""}`} aria-label={t("featured")}>
			<div className="discover-featured__stage">
				{slides.map((project, index) => (
					<FeaturedImageSlide key={project.id || project.slug || index} project={project} position={getSlideImagePosition(index, activeIndex, transitionState, slides.length)} t={t} />
				))}
			</div>

			{slides.length > 1 && (
				<div className="discover-featured__previews">
					<button type="button" className="discover-rail-arrow discover-featured__arrow" onClick={() => moveIndex(-1)} aria-label={t("previous")} disabled={isAnimating}>
						<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-chevron-left-icon lucide-chevron-left">
							<path d="m15 18-6-6 6-6"/>
						</svg>
					</button>

					<div className="discover-featured__preview-list" role="tablist" aria-label={t("featured")}>
						{slides.map((project, index) => (
							<button key={project.id || project.slug} type="button" className={`discover-featured__preview ${index === activeDotIndex ? "is-active" : ""}`} onClick={() => selectIndex(index)} aria-label={project.title} aria-current={index === activeDotIndex ? "true" : undefined} disabled={isAnimating}>
								<img src={getProjectImage(project)} alt="" />
								
								{index === activeIndex && !isAnimating && <span key={`${index}-${timerVersion}`} className="discover-featured__preview-progress" aria-hidden="true" />}
							</button>
						))}
					</div>

					<button type="button" className="discover-rail-arrow discover-featured__arrow" onClick={() => moveIndex(1)} aria-label={t("next")} disabled={isAnimating}>
						<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-chevron-right-icon lucide-chevron-right">
							<path d="m9 18 6-6-6-6"/>
						</svg>
					</button>
				</div>
			)}
		</section>
	);
}