"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import UserName from "@/components/ui/UserName";
import { getProjectPath } from "@/utils/projectRoutes";
import { getOwnerHref, getProjectImage, SLIDE_INTERVAL_MS } from "./discoverHelpers";

function useAutoSlide(length) {
	const [activeIndex, setActiveIndex] = useState(0);
	const [timerVersion, setTimerVersion] = useState(0);

	const resetTimer = () => {
		setTimerVersion((version) => version + 1);
	};

	const selectIndex = (index) => {
		if(length < 1) {
			return;
		}

		setActiveIndex(((index % length) + length) % length);
		resetTimer();
	};

	const moveIndex = (direction) => {
		if(length < 1) {
			return;
		}

		setActiveIndex((index) => (index + direction + length) % length);
		resetTimer();
	};

	useEffect(() => {
		if(length < 2) {
			return;
		}

		const timer = window.setInterval(() => {
			setActiveIndex((index) => (index + 1) % length);
		}, SLIDE_INTERVAL_MS);

		return () => window.clearInterval(timer);
	}, [length, timerVersion]);

	useEffect(() => {
		if(activeIndex > length - 1) {
			setActiveIndex(0);
		}
	}, [activeIndex, length]);

	return [activeIndex, selectIndex, moveIndex, timerVersion];
}

export default function FeaturedHero({ projects, t }) {
	const slides = projects.slice(0, 5);
	const [activeIndex, selectIndex, moveIndex, timerVersion] = useAutoSlide(slides.length);
	const activeProject = slides[activeIndex];

	if(!activeProject) {
		return null;
	}

	return (
		<section className="discover-featured" aria-label={t("featured")}>
			<Link href={getProjectPath(activeProject)} className="discover-featured__image-link" aria-label={activeProject.title}>
				<img className="discover-featured__image" src={getProjectImage(activeProject)} alt="" />
				
				<span className="discover-featured__shade" />
			</Link>

			<div className="discover-featured__content">
				<span className="discover-featured__eyebrow">{t("featured")}</span>
				
				<Link href={getProjectPath(activeProject)} className="discover-featured__title-link">
					<h1>{activeProject.title}</h1>
				</Link>

				<Link href={getOwnerHref(activeProject)} className="discover-featured__author">
					{t("by")} <UserName user={activeProject.owner} />
				</Link>
			</div>

			{slides.length > 1 && (
				<div className="discover-featured__previews">
					<button type="button" className="discover-rail-arrow discover-featured__arrow" onClick={() => moveIndex(-1)} aria-label={t("previous")}>
						<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-chevron-left-icon lucide-chevron-left">
							<path d="m15 18-6-6 6-6"/>
						</svg>
					</button>

					<div className="discover-featured__preview-list" role="tablist" aria-label={t("featured")}>
						{slides.map((project, index) => (
							<button key={project.id || project.slug} type="button" className={`discover-featured__preview ${index === activeIndex ? "is-active" : ""}`} onClick={() => selectIndex(index)} aria-label={project.title} aria-current={index === activeIndex ? "true" : undefined}>
								<img src={getProjectImage(project)} alt="" />
								
								{index === activeIndex && <span key={`${index}-${timerVersion}`} className="discover-featured__preview-progress" aria-hidden="true" />}
							</button>
						))}
					</div>

					<button type="button" className="discover-rail-arrow discover-featured__arrow" onClick={() => moveIndex(1)} aria-label={t("next")}>
						<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-chevron-right-icon lucide-chevron-right">
							<path d="m9 18 6-6-6-6"/>
						</svg>
					</button>
				</div>
			)}
		</section>
	);
}