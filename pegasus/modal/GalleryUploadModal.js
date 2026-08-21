"use client";

import { useEffect, useRef } from "react";
import Modal from "react-modal";

if(typeof window !== "undefined") {
	Modal.setAppElement("body");
}

export default function GalleryUploadModal({ isOpen, onRequestClose, uploadLoading, uploadStep, uploadSteps, uploadItems, uploadIndex, isUploadDragActive, uploadFileRef, openUploadFilePicker, handleUploadDragOver, handleUploadDragLeave, handleUploadDrop, handleUploadFileChange, formatFileSize, removeUploadItem, goToUploadFilesStep, goToUploadMetadataStep, goToUploadItem, handleSubmit, handleUploadInputChange, toggleUploadFeatured, t, tProject }) {
	const isFilesStep = uploadStep === uploadSteps.FILES;
	const isMetadataStep = uploadStep === uploadSteps.METADATA;
	const uploadItem = uploadItems[uploadIndex] || null;
	const metadataProgress = uploadItems.length > 0 ? ((uploadIndex + 1) / uploadItems.length) * 50 : 0;
	const progress = isFilesStep ? 50 : 50 + metadataProgress;
	const dropzoneClassName = `version-upload-dropzone ${isUploadDragActive || uploadItems.length > 0 ? "version-upload-dropzone--active" : ""}`.trim();
	const contentRef = useRef(null);

	useEffect(() => {
		if(isMetadataStep) {
			contentRef.current?.scrollTo({ top: 0 });
		}
	}, [isMetadataStep, uploadIndex]);

	const handlePickerKeyDown = (event) => {
		if(event.key === "Enter" || event.key === " ") {
			event.preventDefault();
			openUploadFilePicker();
		}
	};

	return (
		<Modal closeTimeoutMS={150} isOpen={isOpen} onRequestClose={onRequestClose} className="modal active" overlayClassName="modal-overlay" contentLabel={t("gallerySettings.title")}>
			<div className="modal-window version-upload-modal gallery-bulk-upload-modal">
				<div className="modal-window__header">
					<div className="version-upload-steps" aria-label={t("gallerySettings.modal.steps.label")}>
						<button type="button" className={`version-upload-steps__item version-upload-steps__item--button ${isFilesStep ? "is-active" : "is-complete"}`} onClick={goToUploadFilesStep} disabled={uploadLoading} aria-current={isFilesStep ? "step" : undefined}>
							{t("gallerySettings.modal.steps.files")}
						</button>

						<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" className="version-upload-steps__separator" aria-hidden="true">
							<path d="m9 18 6-6-6-6"></path>
						</svg>

						<button type="button" className={`version-upload-steps__item version-upload-steps__item--button ${isMetadataStep ? "is-active" : ""}`} onClick={goToUploadMetadataStep} disabled={uploadLoading || uploadItems.length === 0} aria-current={isMetadataStep ? "step" : undefined}>
							{t("gallerySettings.modal.steps.metadata")}
						</button>
					</div>

					<button className="icon-button modal-window__close" type="button" onClick={onRequestClose} aria-label={tProject("cancel")} disabled={uploadLoading}>
						<svg className="icon icon--cross" height="24" width="24">
							<path fillRule="evenodd" clipRule="evenodd" d="M5.293 5.293a1 1 0 0 1 1.414 0L12 10.586l5.293-5.293a1 1 0 0 1 1.414 1.414L13.414 12l5.293 5.293a1 1 0 0 1-1.414 1.414L12 13.414l-5.293 5.293a1 1 0 0 1-1.414-1.414L10.586 12 5.293 6.707a1 1 0 0 1 0-1.414Z" />
						</svg>
					</button>
				</div>

				<div className="version-upload-progress" aria-hidden="true">
					<div className="version-upload-progress__bar" style={{ width: `${progress}%` }}></div>
				</div>

				<div ref={contentRef} className="modal-window__content">
					<form onSubmit={handleSubmit}>
						<input
							ref={uploadFileRef}
							type="file"
							accept="image/jpeg,image/png,image/gif,image/webp"
							multiple
							className="version-upload-dropzone__input"
							onChange={handleUploadFileChange}
							disabled={uploadLoading}
						/>

						{isFilesStep ? (
							<>
								<div className={dropzoneClassName} role="button" tabIndex={0} onClick={openUploadFilePicker} onKeyDown={handlePickerKeyDown} onDragOver={handleUploadDragOver} onDragLeave={handleUploadDragLeave} onDrop={handleUploadDrop} aria-label={t("gallerySettings.modal.dropzone.uploadTitle")}>
									<div className="version-upload-dropzone__icon" aria-hidden="true">
										<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
											<rect width="18" height="18" x="3" y="3" rx="2" ry="2"></rect>
											<circle cx="9" cy="9" r="2"></circle>
											<path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"></path>
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

													<button type="button" className="icon-button gallery-upload-selection__remove" onClick={() => removeUploadItem(item.id)} aria-label={t("gallerySettings.modal.removeFile", { name: item.file.name })} disabled={uploadLoading}>
														<svg className="icon icon--cross" height="20" width="20" viewBox="0 0 24 24" aria-hidden="true">
															<path fillRule="evenodd" clipRule="evenodd" d="M5.293 5.293a1 1 0 0 1 1.414 0L12 10.586l5.293-5.293a1 1 0 0 1 1.414 1.414L13.414 12l5.293 5.293a1 1 0 0 1-1.414 1.414L12 13.414l-5.293 5.293a1 1 0 0 1-1.414-1.414L10.586 12 5.293 6.707a1 1 0 0 1 0-1.414Z" />
														</svg>
													</button>
												</div>
											))}
										</div>
									</div>
								) : null}

								<div className="version-upload-actions">
									<button type="button" className="button button--size-m button--type-primary" onClick={goToUploadMetadataStep} disabled={uploadLoading || uploadItems.length === 0}>
										{t("gallerySettings.modal.actions.continue")}
									</button>
								</div>
							</>
						) : uploadItem ? (
							<>
								<div className="gallery-upload-metadata-nav" role="tablist" aria-label={t("gallerySettings.modal.metadataNavigation")}>
									{uploadItems.map((item, index) => (
										<button key={item.id} type="button" role="tab" aria-selected={index === uploadIndex} className={`gallery-upload-metadata-nav__item ${index === uploadIndex ? "is-active" : ""}`} onClick={() => goToUploadItem(index)} disabled={uploadLoading}>
											<img src={item.previewUrl} alt="" />
											
											<span>{index + 1}</span>
										</button>
									))}
								</div>

								<p className="blog-settings__field-title gallery-upload-metadata__first-field">{t("gallerySettings.fields.titleOptional")}</p>
								<div className="field field--default">
									<label className="field__wrapper">
										<input type="text" name="title" value={uploadItem.title} onChange={handleUploadInputChange} placeholder={t("gallerySettings.placeholders.title")} className="text-input" disabled={uploadLoading} />
									</label>
								</div>

								<p className="blog-settings__field-title">{t("gallerySettings.fields.descriptionOptional")}</p>
								<div className="field field--default textarea">
									<label className="field__wrapper">
										<textarea name="description" value={uploadItem.description} onChange={handleUploadInputChange} placeholder={t("gallerySettings.placeholders.description")} className="autosize textarea__input" disabled={uploadLoading} />
									</label>
								</div>

								<p className="blog-settings__field-title">{t("gallerySettings.fields.orderOptional")}</p>
								<div className="field field--default">
									<label className="field__wrapper">
										<input type="number" name="ordering" min="0" step="1" value={uploadItem.ordering} onChange={handleUploadInputChange} placeholder={t("gallerySettings.placeholders.order")} className="text-input" disabled={uploadLoading} />
									</label>
								</div>

								<p className="blog-settings__field-title">{t("gallerySettings.fields.featured")}</p>

								<button type="button" className="button button--size-m button--type-minimal" aria-pressed={uploadItem.featured} onClick={toggleUploadFeatured} disabled={uploadLoading}>
									{uploadItem.featured ? t("gallerySettings.states.enabled") : t("gallerySettings.states.disabled")}
								</button>

								<p className="gallery-modal-help">{t("gallerySettings.featuredHint")}</p>

								<div className="version-upload-actions">
									<button type="button" className="button button--size-m button--type-minimal button--with-icon" onClick={goToUploadFilesStep} disabled={uploadLoading}>
										<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
											<path d="m12 19-7-7 7-7M19 12H5"></path>
										</svg>

										{t("gallerySettings.modal.actions.back")}
									</button>

									<button type="submit" className="button button--size-m button--type-primary" disabled={uploadLoading}>
										{t("gallerySettings.modal.actions.upload")}
									</button>
								</div>
							</>
						) : null}
					</form>
				</div>
			</div>
		</Modal>
	);
}