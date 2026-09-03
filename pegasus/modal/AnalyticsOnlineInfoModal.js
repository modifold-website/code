"use client";

import Modal from "react-modal";
import { useTranslations } from "next-intl";

if(typeof window !== "undefined") {
	Modal.setAppElement("body");
}

export default function AnalyticsOnlineInfoModal({ isOpen, onRequestClose }) {
	const t = useTranslations("SettingsProjectPage.analytics.onlineInfo");

	return (
		<Modal closeTimeoutMS={150} isOpen={isOpen} onRequestClose={onRequestClose} className="modal active" overlayClassName="modal-overlay">
			<div className="modal-window">
				<div className="modal-window__header">
					<h2 className="modal-window__title">Modifold Analytics</h2>

					<button className="icon-button modal-window__close" type="button" onClick={onRequestClose} aria-label={t("closeAriaLabel")}>
						<svg className="icon icon--cross" height="24" width="24">
							<path fillRule="evenodd" clipRule="evenodd" d="M5.293 5.293a1 1 0 0 1 1.414 0L12 10.586l5.293-5.293a1 1 0 0 1 1.414 1.414L13.414 12l5.293 5.293a1 1 0 0 1-1.414 1.414L12 13.414l-5.293 5.293a1 1 0 0 1-1.414-1.414L10.586 12 5.293 6.707a1 1 0 0 1 0-1.414Z" />
						</svg>
					</button>
				</div>

				<div className="modal-window__content analytics-online-info-modal__content">
					<p>
						{t("paragraph1Prefix")} <strong>Modifold Analytics</strong> {t("paragraph1Suffix")}
					</p>

					<p>{t("paragraph2")}</p>

					<p>{t("installationLabel")}</p>

					<a href="https://github.com/modifold-website/analytics" target="_blank" rel="noopener noreferrer" className="button button--size-xl button--type-minimal button--with-icon button--active-transform" type="button" style={{ "--icon-size": "20px" }}>
						<svg className="icon icon--github" width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
							<path d="M12 0C5.373 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.6.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.757-1.333-1.757-1.09-.745.083-.729.083-.729 1.205.084 1.838 1.237 1.838 1.237 1.07 1.834 2.807 1.304 3.492.997.108-.775.418-1.305.762-1.605-2.665-.305-5.467-1.334-5.467-5.932 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.91 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" fill="#181717"></path>
						</svg>
						
						GitHub
					</a>
				</div>
			</div>
		</Modal>
	);
}