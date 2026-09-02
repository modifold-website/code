"use client";

import Modal from "react-modal";
import { getYouTubeEmbedUrl, getYouTubeVideoId } from "@/utils/gallery/media";

if(typeof window !== "undefined") {
	Modal.setAppElement("#app");
}

export default function GalleryVideoModal({ isOpen, onRequestClose, isLoading, videoForm, setVideoForm, onSubmit, t, tProject }) {
	const previewVideoId = getYouTubeVideoId(videoForm.youtubeUrl);
	const isEditing = Boolean(videoForm.id);

	const handleChange = (event) => {
		const { name, value } = event.target;
		setVideoForm((currentForm) => ({ ...currentForm, [name]: value }));
	};

	return (
		<Modal closeTimeoutMS={150} isOpen={isOpen} onRequestClose={onRequestClose} className="modal active" overlayClassName="modal-overlay" contentLabel={isEditing ? t("gallerySettings.video.editTitle") : t("gallerySettings.video.addTitle")}>
			<div className="modal-window version-upload-modal gallery-video-modal">
				<div className="modal-window__header">
					<span>{isEditing ? t("gallerySettings.video.editTitle") : t("gallerySettings.video.addTitle")}</span>

					<button className="icon-button modal-window__close" type="button" onClick={onRequestClose} aria-label={tProject("cancel")} disabled={isLoading}>
						<svg className="icon icon--cross" height="24" width="24" viewBox="0 0 24 24" aria-hidden="true">
							<path fillRule="evenodd" clipRule="evenodd" d="M5.293 5.293a1 1 0 0 1 1.414 0L12 10.586l5.293-5.293a1 1 0 0 1 1.414 1.414L13.414 12l5.293 5.293a1 1 0 0 1-1.414 1.414L12 13.414l-5.293 5.293a1 1 0 0 1-1.414-1.414L10.586 12 5.293 6.707a1 1 0 0 1 0-1.414Z" />
						</svg>
					</button>
				</div>

				<div className="modal-window__content">
					<form onSubmit={onSubmit}>
						<p className="gallery-video-modal__description">{t("gallerySettings.video.modalDescription")}</p>

						<p className="blog-settings__field-title">{t("gallerySettings.video.urlLabel")}</p>
						<div className="field field--default">
							<label className="field__wrapper">
								<input type="text" name="youtubeUrl" value={videoForm.youtubeUrl} onChange={handleChange} placeholder={t("gallerySettings.video.placeholder")} className="text-input" autoComplete="off" disabled={isLoading} required />
							</label>
						</div>

						<p className="blog-settings__field-title">{t("gallerySettings.fields.titleOptional")}</p>
						<div className="field field--default">
							<label className="field__wrapper">
								<input type="text" name="title" value={videoForm.title} onChange={handleChange} placeholder={t("gallerySettings.video.titlePlaceholder")} className="text-input" disabled={isLoading} />
							</label>
						</div>

						<p className="blog-settings__field-title">{t("gallerySettings.fields.descriptionOptional")}</p>
						<div className="field field--default textarea">
							<label className="field__wrapper">
								<textarea name="description" value={videoForm.description} onChange={handleChange} placeholder={t("gallerySettings.video.descriptionPlaceholder")} className="autosize textarea__input" disabled={isLoading} />
							</label>
						</div>

						{previewVideoId ? (
							<div className="gallery-video-modal__preview">
								<iframe src={getYouTubeEmbedUrl(previewVideoId)} title={t("gallerySettings.video.previewTitle")} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen />
							</div>
						) : null}

						<div className="version-upload-actions">
							<button type="submit" className="button button--size-m button--type-primary" disabled={isLoading || !previewVideoId}>
								{isLoading ? tProject("updating") : isEditing ? t("gallerySettings.video.save") : t("gallerySettings.video.add")}
							</button>
						</div>
					</form>
				</div>
			</div>
		</Modal>
	);
}