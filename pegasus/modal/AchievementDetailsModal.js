"use client";

import { useId } from "react";
import Modal from "react-modal";

export default function AchievementDetailsModal({ isOpen, onRequestClose, title, description, iconUrl, awardedDate, link, t }) {
	const titleId = useId();
	const descriptionId = useId();
	const linkLabel = link ? t("achievements.visitWebsite", { site: link.site }) : null;

	return (
		<Modal appElement={typeof document !== "undefined" ? document.getElementById("app") : undefined} aria={{ modal: true, labelledby: titleId, describedby: descriptionId }} closeTimeoutMS={150} isOpen={isOpen} onRequestClose={onRequestClose} className="modal active" overlayClassName="modal-overlay">
			<div className="modal-window">
				<div className="modal-window__header">
					<button className="icon-button modal-window__close" type="button" onClick={onRequestClose} aria-label={t("close")}>
						<svg className="icon icon--cross" height="24" width="24" aria-hidden="true">
							<path fillRule="evenodd" clipRule="evenodd" d="M5.293 5.293a1 1 0 0 1 1.414 0L12 10.586l5.293-5.293a1 1 0 0 1 1.414 1.414L13.414 12l5.293 5.293a1 1 0 0 1-1.414 1.414L12 13.414l-5.293 5.293a1 1 0 0 1-1.414-1.414L10.586 12 5.293 6.707a1 1 0 0 1 0-1.414Z" />
						</svg>
					</button>
				</div>

				<div className="modal-window__content achievement-details">
					<img className="achievement-details__icon" src={iconUrl} alt="" width="96" height="96" />
					
					<h2 id={titleId} className="achievement-details__title">{title}</h2>
					
					<p id={descriptionId} className="achievement-details__description">{description}</p>

					{awardedDate && <p className="achievement-details__date">{t("achievements.receivedAt", { date: awardedDate })}</p>}

					{link && (
						<a className="button button--size-l button--type-primary" href={link.href} target="_blank" rel="noopener noreferrer" aria-label={`${linkLabel} (${t("achievements.opensInNewTab")})`}>
							{linkLabel}
						</a>
					)}
				</div>
			</div>
		</Modal>
	);
}