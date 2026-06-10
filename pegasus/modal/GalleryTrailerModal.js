"use client";

import Modal from "react-modal";

if(typeof window !== "undefined") {
	Modal.setAppElement("body");
}

const getYouTubeEmbedUrl = (videoId) => {
	if(!videoId) {
		return "";
	}

	return `https://www.youtube.com/embed/${videoId}`;
};

export default function GalleryTrailerModal({ isOpen, onRequestClose, trailerLoading, trailerUrl, trailerVideoId, setTrailerUrl, handleTrailerSubmit, handleTrailerDelete, t, tProject }) {
	return (
		<Modal closeTimeoutMS={150} isOpen={isOpen} onRequestClose={onRequestClose} className="modal active" overlayClassName="modal-overlay">
			<div className="modal-window version-upload-modal gallery-trailer-modal">
				<div className="modal-window__header">
					<span>{t("gallerySettings.trailer.title")}</span>

					<button className="icon-button modal-window__close" type="button" onClick={onRequestClose} disabled={trailerLoading}>
						<svg className="icon icon--cross" height="24" width="24">
							<path fillRule="evenodd" clipRule="evenodd" d="M5.293 5.293a1 1 0 0 1 1.414 0L12 10.586l5.293-5.293a1 1 0 0 1 1.414 1.414L13.414 12l5.293 5.293a1 1 0 0 1-1.414 1.414L12 13.414l-5.293 5.293a1 1 0 0 1-1.414-1.414L10.586 12 5.293 6.707a1 1 0 0 1 0-1.414Z" />
						</svg>
					</button>
				</div>

				<div className="modal-window__content">
					<form onSubmit={handleTrailerSubmit}>
						<p className="gallery-trailer-modal__description">{t("gallerySettings.trailer.modalDescription")}</p>

						<p className="blog-settings__field-title">{t("gallerySettings.trailer.urlLabel")}</p>
						<div className="field field--default">
							<label className="field__wrapper">
								<input
									type="text"
									name="trailer_youtube_url"
									value={trailerUrl}
									onChange={(event) => setTrailerUrl(event.target.value)}
									placeholder={t("gallerySettings.trailer.placeholder")}
									className="text-input"
									disabled={trailerLoading}
								/>
							</label>
						</div>

						{trailerVideoId && (
							<div className="gallery-trailer-modal__preview">
								<iframe
									src={getYouTubeEmbedUrl(trailerVideoId)}
									title={t("gallerySettings.trailer.previewTitle")}
									allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
									allowFullScreen
								/>
							</div>
						)}

						<div className="version-upload-actions">
							{trailerVideoId && (
								<button type="button" className="button button--size-m button--type-minimal" onClick={handleTrailerDelete} disabled={trailerLoading}>
									{t("gallerySettings.trailer.remove")}
								</button>
							)}

							<button type="submit" className="button button--size-m button--type-primary" disabled={trailerLoading}>
								{trailerLoading ? tProject("updating") : t("gallerySettings.trailer.save")}
							</button>
						</div>
					</form>
				</div>
			</div>
		</Modal>
	);
}