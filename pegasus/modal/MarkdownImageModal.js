"use client";

import { useDeferredValue, useEffect, useLayoutEffect, useRef, useState } from "react";
import Modal from "react-modal";
import { getProjectDescriptionImageValidationError, uploadProjectDescriptionImage } from "@/utils/projects/images";

if(typeof window !== "undefined") {
	Modal.setAppElement("body");
}

const getValidImageUrl = (value) => {
	try {
		const parsedUrl = new URL(value.trim());
		if(!["http:", "https:"].includes(parsedUrl.protocol)) {
			return "";
		}

		return parsedUrl.toString();
	} catch {
		return "";
	}
};

export default function MarkdownImageModal({ isOpen, onRequestClose, onInsert, projectId, authToken, t }) {
	const appElement = typeof document !== "undefined" ? document.body : undefined;
	const [source, setSource] = useState("upload");
	const [altText, setAltText] = useState("");
	const [linkUrl, setLinkUrl] = useState("");
	const [uploadFile, setUploadFile] = useState(null);
	const [uploadedUrl, setUploadedUrl] = useState("");
	const [localPreviewUrl, setLocalPreviewUrl] = useState("");
	const [previewStatus, setPreviewStatus] = useState("idle");
	const [isUploading, setIsUploading] = useState(false);
	const [isDragActive, setIsDragActive] = useState(false);
	const [errorKey, setErrorKey] = useState("");
	const fileInputRef = useRef(null);
	const contentRef = useRef(null);
	const uploadControllerRef = useRef(null);
	const objectUrlRef = useRef("");
	const deferredLinkUrl = useDeferredValue(linkUrl);
	const currentLinkUrl = getValidImageUrl(linkUrl);
	const previewLinkUrl = getValidImageUrl(deferredLinkUrl);
	const previewUrl = source === "upload" ? uploadedUrl || localPreviewUrl : previewLinkUrl;
	const insertUrl = source === "upload" ? uploadedUrl : currentLinkUrl;
	const isLinkPreviewCurrent = source !== "link" || currentLinkUrl === previewLinkUrl;
	const isInsertDisabled = !insertUrl || isUploading || previewStatus !== "ready" || !isLinkPreviewCurrent;
	const dropzoneClassName = `version-upload-dropzone ${isDragActive || uploadFile ? "version-upload-dropzone--active" : ""}`.trim();
	const getSourceButtonClassName = (buttonSource) => {
		const isActive = source === buttonSource;
		return `button button--size-m button--type-${isActive ? "positive" : "minimal"} button--active-transform${isActive ? " button--with-icon" : ""}`;
	};

	const releaseObjectUrl = () => {
		if(objectUrlRef.current) {
			URL.revokeObjectURL(objectUrlRef.current);
			objectUrlRef.current = "";
		}
	};

	const reset = () => {
		uploadControllerRef.current?.abort();
		uploadControllerRef.current = null;
		releaseObjectUrl();
		setSource("upload");
		setAltText("");
		setLinkUrl("");
		setUploadFile(null);
		setUploadedUrl("");
		setLocalPreviewUrl("");
		setPreviewStatus("idle");
		setIsUploading(false);
		setIsDragActive(false);
		setErrorKey("");
		if(fileInputRef.current) {
			fileInputRef.current.value = "";
		}
	};

	useEffect(() => {
		if(!isOpen) {
			reset();
		}
	}, [isOpen]);

	useEffect(() => () => {
		uploadControllerRef.current?.abort();
		releaseObjectUrl();
	}, []);

	useLayoutEffect(() => {
		setPreviewStatus(previewUrl ? "loading" : "idle");
	}, [previewUrl]);

	useLayoutEffect(() => {
		if(isOpen) {
			contentRef.current?.scrollTo({ top: 0 });
		}
	}, [isOpen]);

	const close = () => {
		reset();
		onRequestClose?.();
	};

	const selectSource = (nextSource) => {
		setSource(nextSource);
		setErrorKey("");
	};

	const selectFile = async (file) => {
		const validationError = getProjectDescriptionImageValidationError(file);
		if(validationError) {
			setErrorKey(validationError);
			return;
		}

		uploadControllerRef.current?.abort();
		releaseObjectUrl();

		const objectUrl = URL.createObjectURL(file);
		const uploadController = new AbortController();
		objectUrlRef.current = objectUrl;
		uploadControllerRef.current = uploadController;
		setUploadFile(file);
		setUploadedUrl("");
		setLocalPreviewUrl(objectUrl);
		setErrorKey("");
		setIsUploading(true);

		try {
			const image = await uploadProjectDescriptionImage({
				projectId,
				file,
				authToken,
				signal: uploadController.signal,
			});
			setUploadedUrl(image.url);
			setLocalPreviewUrl("");
			releaseObjectUrl();
		} catch(error) {
			if(error?.name !== "AbortError") {
				setErrorKey("upload");
			}
		} finally {
			if(uploadControllerRef.current === uploadController) {
				uploadControllerRef.current = null;
				setIsUploading(false);
			}
		}
	};

	const handleFileChange = (event) => {
		const [file] = Array.from(event.target.files || []);
		if(file) {
			selectFile(file);
		}
		event.target.value = "";
	};

	const openFilePicker = () => {
		fileInputRef.current?.click();
	};

	const handlePickerKeyDown = (event) => {
		if(event.key === "Enter" || event.key === " ") {
			event.preventDefault();
			openFilePicker();
		}
	};

	const handleDragOver = (event) => {
		event.preventDefault();
		event.stopPropagation();
		setIsDragActive(true);
	};

	const handleDragLeave = (event) => {
		event.preventDefault();
		event.stopPropagation();
		if(event.currentTarget.contains(event.relatedTarget)) {
			return;
		}

		setIsDragActive(false);
	};

	const handleDrop = (event) => {
		event.preventDefault();
		event.stopPropagation();
		setIsDragActive(false);
		const [file] = Array.from(event.dataTransfer.files || []);
		if(file) {
			selectFile(file);
		}
	};

	const handleSubmit = (event) => {
		event.preventDefault();
		if(isInsertDisabled) {
			return;
		}

		onInsert({ altText: altText.trim(), url: insertUrl });
		close();
	};

	return (
		<Modal appElement={appElement} closeTimeoutMS={150} isOpen={isOpen} onRequestClose={close} className="modal active markdown-image-modal" overlayClassName="modal-overlay modal-overlay--markdown-image" contentLabel={t("title")}>
			<div className="modal-window markdown-image-modal__window">
				<div className="modal-window__header markdown-image-modal__header">
					<h2 className="modal-window__title">{t("title")}</h2>

					<button className="icon-button modal-window__close" type="button" onClick={close} aria-label={t("close") }>
						<svg className="icon icon--cross" height="24" width="24" viewBox="0 0 24 24" aria-hidden="true">
							<path fillRule="evenodd" clipRule="evenodd" d="M5.293 5.293a1 1 0 0 1 1.414 0L12 10.586l5.293-5.293a1 1 0 0 1 1.414 1.414L13.414 12l5.293 5.293a1 1 0 0 1-1.414 1.414L12 13.414l-5.293 5.293a1 1 0 0 1-1.414-1.414L10.586 12 5.293 6.707a1 1 0 0 1 0-1.414Z" />
						</svg>
					</button>
				</div>

				<div ref={contentRef} className="modal-window__content markdown-image-modal__content">
					<form onSubmit={handleSubmit}>
						<div className="markdown-image-modal__field-heading">
							<label htmlFor="markdown-image-alt">{t("altLabel")}</label>
						</div>

						<p className="markdown-image-modal__help">{t("altHelp")}</p>
						<div className="field field--default">
							<label className="field__wrapper">
								<input id="markdown-image-alt" className="text-input" value={altText} onChange={(event) => setAltText(event.target.value)} placeholder={t("altPlaceholder")} maxLength={300} autoFocus />
							</label>
						</div>

						<div className="markdown-image-modal__field-heading markdown-image-modal__source-heading">
							<span>{t("urlLabel")}</span>
							<span>{t("required")}</span>
						</div>

						<div className="markdown-image-modal__source-tabs" role="group" aria-label={t("sourceLabel")}>
							<button type="button" className={getSourceButtonClassName("upload")} onClick={() => selectSource("upload")} aria-pressed={source === "upload"}>
								{source === "upload" ? (
									<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m20 6-11 11-5-5" /></svg>
								) : null}

								{t("upload")}
							</button>

							<button type="button" className={getSourceButtonClassName("link")} onClick={() => selectSource("link")} aria-pressed={source === "link"}>
								{source === "link" ? (
									<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m20 6-11 11-5-5" /></svg>
								) : null}

								{t("link")}
							</button>
						</div>

						{source === "upload" ? (
							<>
								<input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp" className="version-upload-dropzone__input" onChange={handleFileChange} disabled={isUploading} />
								<div className={dropzoneClassName} role="button" tabIndex={0} onClick={openFilePicker} onKeyDown={handlePickerKeyDown} onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop} aria-label={t("dropzoneTitle")}>
									<div className="version-upload-dropzone__icon" aria-hidden="true">
										<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
											<rect width="18" height="18" x="3" y="3" rx="2" ry="2"></rect>
											<circle cx="9" cy="9" r="2"></circle>
											<path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"></path>
										</svg>
									</div>

									<div className="version-upload-dropzone__text">
										<strong style={{ fontSize: "16px" }}>{uploadFile ? uploadFile.name : t("dropzoneTitle")}</strong>

										<span style={{ fontSize: "16px" }}>{isUploading ? t("uploading") : uploadFile ? t("dropzoneReplace") : t("dropzoneHint")}</span>
									</div>
								</div>
							</>
						) : (
							<div className="field field--default markdown-image-modal__url-field">
								<label className="field__wrapper">
									<svg viewBox="0 0 24 24" aria-hidden="true">
										<rect width="18" height="18" x="3" y="3" rx="2" />
										<circle cx="9" cy="9" r="2" />
										<path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21" />
									</svg>

									<input className="text-input" inputMode="url" value={linkUrl} onChange={(event) => {
										setLinkUrl(event.target.value);
										setErrorKey("");
									}} placeholder={t("linkPlaceholder")} required />
								</label>
							</div>
						)}

						{errorKey ? <p className="markdown-image-modal__error" role="alert">{t(`errors.${errorKey}`)}</p> : null}
						{source === "link" && linkUrl.trim() && !currentLinkUrl ? <p className="markdown-image-modal__error" role="alert">{t("errors.invalidUrl")}</p> : null}

						<h3 className="markdown-image-modal__preview-title">{t("preview")}</h3>
						<div className={`markdown-image-modal__preview ${previewStatus === "ready" ? "has-image" : ""}`} aria-live="polite" aria-busy={previewStatus === "loading"}>
							{previewUrl ? (
								<img src={previewUrl} alt={altText.trim()} onLoad={() => setPreviewStatus("ready")} onError={() => setPreviewStatus("error")} referrerPolicy="no-referrer" />
							) : (
								<div className="markdown-image-modal__preview-empty">
									<svg viewBox="0 0 24 24" aria-hidden="true">
										<rect width="18" height="18" x="3" y="3" rx="2" />
										<circle cx="9" cy="9" r="2" />
										<path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21" />
									</svg>
									
									<span>{t("previewEmpty")}</span>
								</div>
							)}

							{previewStatus === "loading" ? <span className="markdown-image-modal__preview-status">{t("previewLoading")}</span> : null}
							{previewStatus === "error" ? <span className="markdown-image-modal__preview-status markdown-image-modal__preview-status--error">{t("errors.preview")}</span> : null}
						</div>

						<div className="markdown-image-modal__actions">
							<button type="button" className="button button--size-m button--type-minimal" onClick={close}>
								{t("cancel")}
							</button>
							
							<button type="submit" className="button button--size-m button--type-primary button--with-icon" disabled={isInsertDisabled}>
								<svg viewBox="0 0 24 24" aria-hidden="true">
									<path d="M5 12h14" />
									<path d="M12 5v14" />
								</svg>
								
								{t("insert")}
							</button>
						</div>
					</form>
				</div>
			</div>
		</Modal>
	);
}