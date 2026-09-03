"use client";

import { useEffect, useRef } from "react";
import Modal from "react-modal";
import { getYouTubeEmbedUrl, getYouTubeVideoId } from "@/utils/gallery/media";

if(typeof window !== "undefined") {
	Modal.setAppElement("body");
}

export default function GalleryMediaModal({ isOpen, onRequestClose, mediaType, onMediaTypeChange, uploadLoading, uploadProgress, uploadStep, uploadSteps, uploadItems, uploadIndex, isUploadDragActive, uploadFileRef, openUploadFilePicker, handleUploadDragOver, handleUploadDragLeave, handleUploadDrop, handleUploadFileChange, formatFileSize, removeUploadItem, goToUploadFilesStep, goToUploadMetadataStep, goToUploadItem, handleSubmit, handleUploadInputChange, toggleUploadFeatured, videoLoading, videoForm, setVideoForm, onVideoSubmit, t, tProject }) {
	const isImageMode = mediaType === "image";
	const isFilesStep = uploadStep === uploadSteps.FILES;
	const isMetadataStep = uploadStep === uploadSteps.METADATA;
	const uploadItem = uploadItems[uploadIndex] || null;
	const metadataProgress = uploadItems.length > 0 ? ((uploadIndex + 1) / uploadItems.length) * 50 : 0;
	const progress = isFilesStep ? 50 : 50 + metadataProgress;
	const dropzoneClassName = `version-upload-dropzone ${isUploadDragActive || uploadItems.length > 0 ? "version-upload-dropzone--active" : ""}`.trim();
	const previewVideoId = getYouTubeVideoId(videoForm.youtubeUrl);
	const contentRef = useRef(null);
	const uploadBodyRef = useRef(null);
	const isLoading = uploadLoading || videoLoading;
	const uploadProgressValue = uploadProgress.total > 0 ? uploadProgress.processed / uploadProgress.total : 0;
	const uploadProgressLabel = t("gallerySettings.modal.uploadProgress.count", { uploaded: uploadProgress.uploaded, total: uploadProgress.total });

	useEffect(() => {
		contentRef.current?.scrollTo({ top: 0 });
		uploadBodyRef.current?.scrollTo({ top: 0 });
	}, [mediaType, isMetadataStep, uploadIndex]);

	const handlePickerKeyDown = (event) => {
		if(event.key === "Enter" || event.key === " ") {
			event.preventDefault();
			openUploadFilePicker();
		}
	};

	const handleVideoChange = (event) => {
		const { name, value } = event.target;
		setVideoForm((currentForm) => ({ ...currentForm, [name]: value }));
	};

	return (
		<Modal closeTimeoutMS={150} isOpen={isOpen} onRequestClose={onRequestClose} className="modal active" overlayClassName="modal-overlay" contentLabel={t("gallerySettings.picker.title")}>
			<div className={`modal-window version-upload-modal gallery-bulk-upload-modal ${isImageMode ? "gallery-bulk-upload-modal--image" : ""}`}>
				<div className="modal-window__header">
					<div className="version-upload-steps" aria-label={t("gallerySettings.modal.steps.label")}>
						{isImageMode ? (
							<>
								<button type="button" className={`version-upload-steps__item version-upload-steps__item--button ${isFilesStep ? "is-active" : "is-complete"}`} onClick={goToUploadFilesStep} disabled={uploadLoading} aria-current={isFilesStep ? "step" : undefined}>
									{t("gallerySettings.modal.steps.files")}
								</button>

								<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" className="version-upload-steps__separator" aria-hidden="true">
									<path d="m9 18 6-6-6-6" />
								</svg>

								<button type="button" className={`version-upload-steps__item version-upload-steps__item--button ${isMetadataStep ? "is-active" : ""}`} onClick={goToUploadMetadataStep} disabled={uploadLoading || uploadItems.length === 0} aria-current={isMetadataStep ? "step" : undefined}>
									{t("gallerySettings.modal.steps.metadata")}
								</button>
							</>
						) : (
							<button type="button" className="version-upload-steps__item version-upload-steps__item--button is-active" disabled={videoLoading} aria-current="step">
								{t("gallerySettings.modal.steps.files")}
							</button>
						)}
					</div>

					<button className="icon-button modal-window__close" type="button" onClick={onRequestClose} aria-label={tProject("cancel")} disabled={isLoading}>
						<svg className="icon icon--cross" height="24" width="24" viewBox="0 0 24 24" aria-hidden="true">
							<path fillRule="evenodd" clipRule="evenodd" d="M5.293 5.293a1 1 0 0 1 1.414 0L12 10.586l5.293-5.293a1 1 0 0 1 1.414 1.414L13.414 12l5.293 5.293a1 1 0 0 1-1.414 1.414L12 13.414l-5.293 5.293a1 1 0 0 1-1.414-1.414L10.586 12 5.293 6.707a1 1 0 0 1 0-1.414Z" />
						</svg>
					</button>
				</div>

				<div className="version-upload-progress" aria-hidden="true">
					<div className="version-upload-progress__bar" style={{ width: `${isImageMode ? progress : 100}%` }} />
				</div>

				<div ref={contentRef} className="modal-window__content">
					<div className="gallery-media-modal__tabs" role="tablist" aria-label={t("gallerySettings.picker.description")}>
						<button type="button" role="tab" aria-selected={isImageMode} className={`button button--size-m ${isImageMode ? "button--type-primary" : "button--type-minimal"}`} onClick={() => onMediaTypeChange("image")} disabled={isLoading}>
							{t("gallerySettings.types.image")}
						</button>

						<button type="button" role="tab" aria-selected={!isImageMode} className={`button button--size-m ${!isImageMode ? "button--type-primary" : "button--type-minimal"}`} onClick={() => onMediaTypeChange("video")} disabled={isLoading}>
							{t("gallerySettings.types.video")}
						</button>
					</div>

					{isImageMode ? (
						<div className="gallery-image-upload-panel" role="tabpanel">
							<form className="gallery-upload-form" onSubmit={handleSubmit} aria-busy={uploadLoading}>
								<input ref={uploadFileRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp" multiple className="version-upload-dropzone__input" onChange={handleUploadFileChange} disabled={uploadLoading} />

								{uploadLoading ? (
									<div className="gallery-upload-progress-view">
										<span className="gallery-upload-progress-view__spinner" aria-hidden="true" />

										<div className="gallery-upload-progress-view__copy" role="status" aria-live="polite">
											<strong>{t("gallerySettings.modal.uploadProgress.title")}</strong>
											<span>{uploadProgressLabel}</span>
										</div>

										<div className="gallery-upload-progress-view__track" role="progressbar" aria-label={t("gallerySettings.modal.uploadProgress.title")} aria-valuemin={0} aria-valuemax={uploadProgress.total} aria-valuenow={uploadProgress.processed} aria-valuetext={uploadProgressLabel}>
											<span style={{ transform: `scaleX(${uploadProgressValue})` }} />
										</div>

										<p>{t("gallerySettings.modal.uploadProgress.hint")}</p>
									</div>
								) : (
									<>
										<div ref={uploadBodyRef} className="gallery-upload-form__body">
											{isFilesStep ? (
												<>
													<div className={dropzoneClassName} role="button" tabIndex={0} onClick={openUploadFilePicker} onKeyDown={handlePickerKeyDown} onDragOver={handleUploadDragOver} onDragLeave={handleUploadDragLeave} onDrop={handleUploadDrop} aria-label={t("gallerySettings.modal.dropzone.uploadTitle")}>
														<div className="version-upload-dropzone__icon" aria-hidden="true">
															<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
																<rect width="18" height="18" x="3" y="3" rx="2" />
																<circle cx="9" cy="9" r="2" />
																<path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21" />
															</svg>
														</div>

														<div className="version-upload-dropzone__text">
															<strong>{uploadItems.length > 0 ? t("gallerySettings.modal.dropzone.selected", { count: uploadItems.length }) : t("gallerySettings.modal.dropzone.uploadTitle")}</strong>
															<span>{uploadItems.length > 0 ? t("gallerySettings.modal.dropzone.addMore") : t("gallerySettings.modal.dropzone.uploadHint")}</span>
														</div>
													</div>

													{uploadItems.length > 0 ? (
														<div className="gallery-upload-selection">
															<h3>{t("gallerySettings.modal.selectedFiles")}</h3>

															<div className="gallery-upload-selection__list">
																{uploadItems.map((item) => (
																	<div key={item.id} className="gallery-upload-selection__item">
																		<img src={item.previewUrl} alt="" className="gallery-upload-selection__thumbnail" />

																		<div className="gallery-upload-selection__file">
																			<strong title={item.file.name}>{item.file.name}</strong>

																			<span>{formatFileSize(item.file.size)}</span>
																		</div>

																		<button type="button" className="icon-button gallery-upload-selection__remove" onClick={() => removeUploadItem(item.id)} aria-label={t("gallerySettings.modal.removeFile", { name: item.file.name })}>
																			<svg className="icon icon--cross" height="20" width="20" viewBox="0 0 24 24" aria-hidden="true">
																				<path fillRule="evenodd" clipRule="evenodd" d="M5.293 5.293a1 1 0 0 1 1.414 0L12 10.586l5.293-5.293a1 1 0 0 1 1.414 1.414L13.414 12l5.293 5.293a1 1 0 0 1-1.414 1.414L12 13.414l-5.293 5.293a1 1 0 0 1-1.414-1.414L10.586 12 5.293 6.707a1 1 0 0 1 0-1.414Z" />
																			</svg>
																		</button>
																	</div>
																))}
															</div>
														</div>
													) : null}
												</>
											) : uploadItem ? (
												<>
													<div className="gallery-upload-metadata-nav" role="tablist" aria-label={t("gallerySettings.modal.metadataNavigation")}>
														{uploadItems.map((item, index) => (
															<button key={item.id} type="button" role="tab" aria-selected={index === uploadIndex} className={`gallery-upload-metadata-nav__item ${index === uploadIndex ? "is-active" : ""}`} onClick={() => goToUploadItem(index)}>
																<img src={item.previewUrl} alt="" />

																<span>{index + 1}</span>
															</button>
														))}
													</div>

													<p className="blog-settings__field-title gallery-upload-metadata__first-field">{t("gallerySettings.fields.titleOptional")}</p>
													<div className="field field--default">
														<label className="field__wrapper">
															<input type="text" name="title" value={uploadItem.title} onChange={handleUploadInputChange} placeholder={t("gallerySettings.placeholders.title")} className="text-input" />
														</label>
													</div>

													<p className="blog-settings__field-title">{t("gallerySettings.fields.descriptionOptional")}</p>
													<div className="field field--default textarea">
														<label className="field__wrapper">
															<textarea name="description" value={uploadItem.description} onChange={handleUploadInputChange} placeholder={t("gallerySettings.placeholders.description")} className="autosize textarea__input" />
														</label>
													</div>

													<p className="blog-settings__field-title">{t("gallerySettings.fields.featured")}</p>
													<button type="button" className="button button--size-m button--type-minimal" aria-pressed={uploadItem.featured} onClick={toggleUploadFeatured}>
														{uploadItem.featured ? t("gallerySettings.states.enabled") : t("gallerySettings.states.disabled")}
													</button>

													<p className="gallery-modal-help">{t("gallerySettings.featuredHint")}</p>
												</>
											) : null}
										</div>

										<div className="version-upload-actions gallery-upload-form__actions">
											{isFilesStep ? (
												<button type="button" className="button button--size-m button--type-primary" onClick={goToUploadMetadataStep} disabled={uploadItems.length === 0}>
													{t("gallerySettings.modal.actions.continue")}
												</button>
											) : uploadItem ? (
												<>
													<button type="button" className="button button--size-m button--type-minimal button--with-icon" onClick={goToUploadFilesStep}>
														<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
															<path d="m12 19-7-7 7-7M19 12H5" />
														</svg>

														{t("gallerySettings.modal.actions.back")}
													</button>

													<button type="submit" className="button button--size-m button--type-primary">
														{t("gallerySettings.modal.actions.upload")}
													</button>
												</>
											) : null}
										</div>
									</>
								)}
							</form>
						</div>
					) : (
						<div role="tabpanel">
							<form onSubmit={onVideoSubmit}>
								<p className="gallery-video-modal__description">{t("gallerySettings.video.modalDescription")}</p>

								<p className="blog-settings__field-title">{t("gallerySettings.video.urlLabel")}</p>
								<div className="field field--default">
									<label className="field__wrapper">
										<input type="text" name="youtubeUrl" value={videoForm.youtubeUrl} onChange={handleVideoChange} placeholder={t("gallerySettings.video.placeholder")} className="text-input" autoComplete="off" disabled={videoLoading} required />
									</label>
								</div>

								<p className="blog-settings__field-title">{t("gallerySettings.fields.titleOptional")}</p>
								<div className="field field--default">
									<label className="field__wrapper">
										<input type="text" name="title" value={videoForm.title} onChange={handleVideoChange} placeholder={t("gallerySettings.video.titlePlaceholder")} className="text-input" disabled={videoLoading} />
									</label>
								</div>

								<p className="blog-settings__field-title">{t("gallerySettings.fields.descriptionOptional")}</p>
								<div className="field field--default textarea">
									<label className="field__wrapper">
										<textarea name="description" value={videoForm.description} onChange={handleVideoChange} placeholder={t("gallerySettings.video.descriptionPlaceholder")} className="autosize textarea__input" disabled={videoLoading} />
									</label>
								</div>

								{previewVideoId ? (
									<div className="gallery-video-modal__preview">
										<iframe src={getYouTubeEmbedUrl(previewVideoId)} title={t("gallerySettings.video.previewTitle")} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen />
									</div>
								) : null}

								<div className="version-upload-actions">
									<button type="submit" className="button button--size-m button--type-primary" disabled={videoLoading || !previewVideoId}>
										{videoLoading ? tProject("updating") : t("gallerySettings.video.add")}
									</button>
								</div>
							</form>
						</div>
					)}
				</div>
			</div>
		</Modal>
	);
}