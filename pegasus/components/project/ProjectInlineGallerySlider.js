"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import ImageLightbox, { useImageLightbox } from "../ui/ImageLightbox";

const SLIDE_DURATION_MS = 440;
const AUTO_PLAY_MS = 6500;

export default function ProjectInlineGallerySlider({ images = [], projectTitle = "" }) {
	const t = useTranslations("ProjectPage");
	const preparedImages = useMemo(() => (
		Array.isArray(images) ? images.filter((image) => typeof image?.url === "string" && image.url.length > 0) : []
	), [images]);
	const visibleThumbsCount = 5;
	const [activeIndex, setActiveIndex] = useState(0);
	const [transitionState, setTransitionState] = useState(null);
	const { lightboxOpen, lightboxImage, closeLightbox, getLightboxTriggerProps } = useImageLightbox();

	useEffect(() => {
		setActiveIndex(0);
	}, [preparedImages.length]);

	if(preparedImages.length === 0) {
		return null;
	}
	const hasMultipleImages = preparedImages.length > 1;
	const isAnimating = transitionState !== null;

	const startTransition = (nextIndex, direction) => {
		if(isAnimating || !preparedImages.length || nextIndex === activeIndex) {
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

	const openAt = (index) => {
		if(index < 0 || index >= preparedImages.length) {
			return;
		}

		startTransition(index, index > activeIndex ? "right" : "left");
	};

	const goPrev = () => startTransition((activeIndex - 1 + preparedImages.length) % preparedImages.length, "left");
	const goNext = () => startTransition((activeIndex + 1) % preparedImages.length, "right");

	useEffect(() => {
		if(preparedImages.length < 2 || isAnimating) {
			return;
		}

		const timer = window.setInterval(() => {
			startTransition((activeIndex + 1) % preparedImages.length, "right");
		}, AUTO_PLAY_MS);

		return () => window.clearInterval(timer);
	}, [activeIndex, preparedImages.length, isAnimating]);

	useEffect(() => {
		if(activeIndex > preparedImages.length - 1) {
			setActiveIndex(0);
		}
	}, [activeIndex, preparedImages.length]);

	const activeImage = preparedImages[activeIndex];
	const leavingImage = transitionState ? preparedImages[transitionState.from] : null;
	const enteringImage = transitionState ? preparedImages[transitionState.to] : null;
	const getThumbWindowStart = (index) => (
		(() => {
			if(preparedImages.length <= visibleThumbsCount) {
				return 0;
			}

			return Math.floor(index / visibleThumbsCount) * visibleThumbsCount;
		})()
	);
	const thumbsWindowStart = getThumbWindowStart(activeIndex);
	const nextThumbsWindowStart = transitionState ? getThumbWindowStart(transitionState.to) : thumbsWindowStart;
	const isThumbsAnimating = transitionState && thumbsWindowStart !== nextThumbsWindowStart;
	const visibleThumbs = preparedImages.slice(thumbsWindowStart, thumbsWindowStart + visibleThumbsCount);
	const nextVisibleThumbs = preparedImages.slice(nextThumbsWindowStart, nextThumbsWindowStart + visibleThumbsCount);
	const activeThumbIndex = transitionState ? transitionState.to : activeIndex;
	const displayedThumbsCount = Math.max(1, isThumbsAnimating ? Math.max(visibleThumbs.length, nextVisibleThumbs.length) : visibleThumbs.length);
	const hasSingleVisibleThumb = !isThumbsAnimating && displayedThumbsCount === 1;
	const getImageAlt = (image, index) => image.title || `${projectTitle} image ${index + 1}`;
	const getThumbAlt = (image, index) => image.title || `${projectTitle} thumbnail ${index + 1}`;

	return (
		<div className="content content--padding project-inline-gallery">
			<div className={`project-inline-gallery__stage ${!hasMultipleImages ? "is-static" : ""}`} onDragStart={(event) => event.preventDefault()}>
				{transitionState ? (
					<>
						<div className={`project-inline-gallery__pane project-inline-gallery__pane--leave ${transitionState.direction === "right" ? "to-left" : "to-right"}`}>
							<img
								src={leavingImage.url}
								alt={getImageAlt(leavingImage, transitionState.from)}
								className="project-inline-gallery__main-image"
								loading="eager"
								draggable={false}
							/>
						</div>

						<div className={`project-inline-gallery__pane project-inline-gallery__pane--enter ${transitionState.direction === "right" ? "from-right" : "from-left"}`}>
							<img
								src={enteringImage.url}
								alt={getImageAlt(enteringImage, transitionState.to)}
								className="project-inline-gallery__main-image"
								loading="eager"
								draggable={false}
							/>
						</div>
					</>
				) : (
					<button type="button" className="project-inline-gallery__pane project-inline-gallery__pane--button" aria-label={t("gallery.viewImage", { title: activeImage.title || t("gallery.image") })} {...getLightboxTriggerProps(activeImage)}>
						<img
							key={activeImage.id || activeImage.url}
							src={activeImage.url}
							alt={getImageAlt(activeImage, activeIndex)}
							className="project-inline-gallery__main-image"
							loading="eager"
							draggable={false}
						/>
					</button>
				)}
			</div>

			<div className="project-inline-gallery__thumbs-row">
				<button type="button" className="project-inline-gallery__arrow project-inline-gallery__arrow--prev" aria-label="Previous image" onClick={goPrev} disabled={!hasMultipleImages || isAnimating}>
					<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 26 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
						<path d="m15 18-6-6 6-6"></path>
					</svg>
				</button>

				<div className={`project-inline-gallery__thumbs-viewport ${hasSingleVisibleThumb ? "project-inline-gallery__thumbs-viewport--single" : ""}`} style={{ "--thumb-count": displayedThumbsCount }}>
					{isThumbsAnimating ? (
						<>
							<div className={`project-inline-gallery__thumbs-track project-inline-gallery__thumbs-track--leave ${visibleThumbs.length === 1 ? "project-inline-gallery__thumbs-track--single" : ""} ${transitionState.direction === "right" ? "to-left" : "to-right"}`}>
								{visibleThumbs.map((image, offset) => {
									const index = thumbsWindowStart + offset;
									return (
										<button key={`leave-${image.id || image.url}-${index}`} type="button" className={`project-inline-gallery__thumb ${index === activeThumbIndex ? "is-active" : ""}`} onClick={() => openAt(index)} aria-label={`Open image ${index + 1}`} disabled={isAnimating}>
											<img src={image.url} alt={getThumbAlt(image, index)} loading="lazy" />
										</button>
									);
								})}
							</div>
							<div className={`project-inline-gallery__thumbs-track project-inline-gallery__thumbs-track--enter ${nextVisibleThumbs.length === 1 ? "project-inline-gallery__thumbs-track--single" : ""} ${transitionState.direction === "right" ? "from-right" : "from-left"}`}>
								{nextVisibleThumbs.map((image, offset) => {
									const index = nextThumbsWindowStart + offset;
									return (
										<button key={`enter-${image.id || image.url}-${index}`} type="button" className={`project-inline-gallery__thumb ${index === activeThumbIndex ? "is-active" : ""}`} onClick={() => openAt(index)} aria-label={`Open image ${index + 1}`} disabled={isAnimating}>
											<img src={image.url} alt={getThumbAlt(image, index)} loading="lazy" />
										</button>
									);
								})}
							</div>
						</>
					) : (
						<div className={`project-inline-gallery__thumbs-track project-inline-gallery__thumbs-track--active ${visibleThumbs.length === 1 ? "project-inline-gallery__thumbs-track--single" : ""}`}>
							{visibleThumbs.map((image, offset) => {
								const index = thumbsWindowStart + offset;
								return (
									<button key={`${image.id || image.url}-${index}`} type="button" className={`project-inline-gallery__thumb ${index === activeThumbIndex ? "is-active" : ""}`} onClick={() => openAt(index)} aria-label={`Open image ${index + 1}`} disabled={isAnimating}>
										<img src={image.url} alt={getThumbAlt(image, index)} loading="lazy" />
									</button>
								);
							})}
						</div>
					)}
				</div>

				<button type="button" className="project-inline-gallery__arrow project-inline-gallery__arrow--next" aria-label="Next image" onClick={goNext} disabled={!hasMultipleImages || isAnimating}>
					<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 22 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
						<path d="m9 18 6-6-6-6"></path>
					</svg>
				</button>
			</div>

			<ImageLightbox isOpen={lightboxOpen} image={lightboxImage} onClose={closeLightbox} dialogLabel={t("gallery.lightboxLabel")} closeLabel={t("close")} openInNewTabLabel={t("gallery.openInNewTab")} fallbackAlt={t("gallery.image")} />
		</div>
	);
}