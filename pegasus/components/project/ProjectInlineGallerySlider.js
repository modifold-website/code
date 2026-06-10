"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import ImageLightbox, { useImageLightbox } from "../ui/ImageLightbox";

const SLIDE_DURATION_MS = 440;
const AUTO_PLAY_MS = 6500;

const getYouTubeEmbedUrl = (videoId) => `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&playsinline=1&rel=0`;
const getYouTubeThumbnailUrl = (videoId) => `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;

export default function ProjectInlineGallerySlider({ images = [], projectTitle = "", trailerVideoId = "" }) {
	const t = useTranslations("ProjectPage");
	const preparedMedia = useMemo(() => {
		const media = [];

		if(trailerVideoId) {
			media.push({
				id: `youtube-${trailerVideoId}`,
				type: "youtube",
				videoId: trailerVideoId,
				title: t("gallery.trailer"),
				thumbnailUrl: getYouTubeThumbnailUrl(trailerVideoId),
			});
		}

		if(Array.isArray(images)) {
			for(const image of images) {
				if(typeof image?.url === "string" && image.url.length > 0) {
					media.push({ ...image, type: "image" });
				}
			}
		}

		return media;
	}, [images, trailerVideoId, t]);
	const visibleThumbsCount = 5;
	const [activeIndex, setActiveIndex] = useState(0);
	const [transitionState, setTransitionState] = useState(null);
	const { lightboxOpen, lightboxImage, closeLightbox, getLightboxTriggerProps } = useImageLightbox();

	useEffect(() => {
		setActiveIndex(0);
	}, [preparedMedia.length]);

	if(preparedMedia.length === 0) {
		return null;
	}
	const hasMultipleImages = preparedMedia.length > 1;
	const isAnimating = transitionState !== null;

	const startTransition = (nextIndex, direction) => {
		if(isAnimating || !preparedMedia.length || nextIndex === activeIndex) {
			return;
		}

		const currentMedia = preparedMedia[activeIndex];
		const nextMedia = preparedMedia[nextIndex];
		if(currentMedia?.type === "youtube" || nextMedia?.type === "youtube") {
			setActiveIndex(nextIndex);
			setTransitionState(null);
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
		if(index < 0 || index >= preparedMedia.length) {
			return;
		}

		startTransition(index, index > activeIndex ? "right" : "left");
	};

	const goPrev = () => startTransition((activeIndex - 1 + preparedMedia.length) % preparedMedia.length, "left");
	const goNext = () => startTransition((activeIndex + 1) % preparedMedia.length, "right");

	useEffect(() => {
		if(preparedMedia.length < 2 || isAnimating || preparedMedia[activeIndex]?.type === "youtube") {
			return;
		}

		const timer = window.setInterval(() => {
			startTransition((activeIndex + 1) % preparedMedia.length, "right");
		}, AUTO_PLAY_MS);

		return () => window.clearInterval(timer);
	}, [activeIndex, preparedMedia, isAnimating]);

	useEffect(() => {
		if(activeIndex > preparedMedia.length - 1) {
			setActiveIndex(0);
		}
	}, [activeIndex, preparedMedia.length]);

	const activeMedia = preparedMedia[activeIndex];
	const leavingMedia = transitionState ? preparedMedia[transitionState.from] : null;
	const enteringMedia = transitionState ? preparedMedia[transitionState.to] : null;
	const getThumbWindowStart = (index) => (
		(() => {
			if(preparedMedia.length <= visibleThumbsCount) {
				return 0;
			}

			return Math.floor(index / visibleThumbsCount) * visibleThumbsCount;
		})()
	);
	const thumbsWindowStart = getThumbWindowStart(activeIndex);
	const nextThumbsWindowStart = transitionState ? getThumbWindowStart(transitionState.to) : thumbsWindowStart;
	const isThumbsAnimating = transitionState && thumbsWindowStart !== nextThumbsWindowStart;
	const visibleThumbs = preparedMedia.slice(thumbsWindowStart, thumbsWindowStart + visibleThumbsCount);
	const nextVisibleThumbs = preparedMedia.slice(nextThumbsWindowStart, nextThumbsWindowStart + visibleThumbsCount);
	const activeThumbIndex = transitionState ? transitionState.to : activeIndex;
	const displayedThumbsCount = Math.max(1, isThumbsAnimating ? Math.max(visibleThumbs.length, nextVisibleThumbs.length) : visibleThumbs.length);
	const hasSingleVisibleThumb = !isThumbsAnimating && displayedThumbsCount === 1;
	const getImageAlt = (media, index) => media.title || `${projectTitle} image ${index + 1}`;
	const getThumbAlt = (media, index) => media.title || `${projectTitle} thumbnail ${index + 1}`;
	const renderMedia = (media, index) => {
		if(media?.type === "youtube") {
			return (
				<iframe
					key={media.id}
					src={getYouTubeEmbedUrl(media.videoId)}
					title={media.title || t("gallery.trailer")}
					className="project-inline-gallery__video"
					allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
					allowFullScreen
				/>
			);
		}

		return (
			<img
				key={media.id || media.url}
				src={media.url}
				alt={getImageAlt(media, index)}
				className="project-inline-gallery__main-image"
				loading="eager"
				draggable={false}
			/>
		);
	};
	const renderThumb = (media, index, keyPrefix = "") => (
		<button key={`${keyPrefix}${media.id || media.url}-${index}`} type="button" className={`project-inline-gallery__thumb ${index === activeThumbIndex ? "is-active" : ""}`} onClick={() => openAt(index)} aria-label={media.type === "youtube" ? t("gallery.openTrailer") : `Open image ${index + 1}`} disabled={isAnimating}>
			<img src={media.type === "youtube" ? media.thumbnailUrl : media.url} alt={getThumbAlt(media, index)} loading="lazy" />

			{media.type === "youtube" && (
				<span className="project-inline-gallery__thumb-play" aria-hidden="true">
					<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 67 60" fill="" focusable="false" aria-hidden="true">
						<path fill="red" d="M63 14.87a7.885 7.885 0 00-5.56-5.56C52.54 8 32.88 8 32.88 8S13.23 8 8.32 9.31c-2.7.72-4.83 2.85-5.56 5.56C1.45 19.77 1.45 30 1.45 30s0 10.23 1.31 15.13c.72 2.7 2.85 4.83 5.56 5.56C13.23 52 32.88 52 32.88 52s19.66 0 24.56-1.31c2.7-.72 4.83-2.85 5.56-5.56C64.31 40.23 64.31 30 64.31 30s0-10.23-1.31-15.13z"></path>
						<path fill="#FFF" class="logo-arrow" d="M26.6 39.43L42.93 30 26.6 20.57z"></path>
					</svg>
				</span>
			)}
		</button>
	);

	return (
		<div className="content content--padding project-inline-gallery">
			<div className={`project-inline-gallery__stage ${!hasMultipleImages ? "is-static" : ""}`} onDragStart={(event) => event.preventDefault()}>
				{transitionState ? (
					<>
						<div className={`project-inline-gallery__pane project-inline-gallery__pane--leave ${transitionState.direction === "right" ? "to-left" : "to-right"}`}>
							{renderMedia(leavingMedia, transitionState.from)}
						</div>

						<div className={`project-inline-gallery__pane project-inline-gallery__pane--enter ${transitionState.direction === "right" ? "from-right" : "from-left"}`}>
							{renderMedia(enteringMedia, transitionState.to)}
						</div>
					</>
				) : activeMedia.type === "youtube" ? (
					<div className="project-inline-gallery__pane">
						{renderMedia(activeMedia, activeIndex)}
					</div>
				) : (
					<button type="button" className="project-inline-gallery__pane project-inline-gallery__pane--button" aria-label={t("gallery.viewImage", { title: activeMedia.title || t("gallery.image") })} {...getLightboxTriggerProps(activeMedia)}>
						{renderMedia(activeMedia, activeIndex)}
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
									return renderThumb(image, index, "leave-");
								})}
							</div>
							<div className={`project-inline-gallery__thumbs-track project-inline-gallery__thumbs-track--enter ${nextVisibleThumbs.length === 1 ? "project-inline-gallery__thumbs-track--single" : ""} ${transitionState.direction === "right" ? "from-right" : "from-left"}`}>
								{nextVisibleThumbs.map((image, offset) => {
									const index = nextThumbsWindowStart + offset;
									return renderThumb(image, index, "enter-");
								})}
							</div>
						</>
					) : (
						<div className={`project-inline-gallery__thumbs-track project-inline-gallery__thumbs-track--active ${visibleThumbs.length === 1 ? "project-inline-gallery__thumbs-track--single" : ""}`}>
							{visibleThumbs.map((image, offset) => {
								const index = thumbsWindowStart + offset;
								return renderThumb(image, index);
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