"use client";

import { useState } from "react";
import Modal from "react-modal";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "react-toastify";
import { useAuth } from "../components/providers/AuthProvider";

Modal.setAppElement("body");

export default function ModJamCreationModal({ isOpen, authToken, onRequestClose, onCreated }) {
	const t = useTranslations("ModJamsPage");
	const router = useRouter();
	const { isLoggedIn } = useAuth();
	const [loading, setLoading] = useState(false);
	const [formData, setFormData] = useState({
		title: "",
		summary: "",
	});
	const isFormValid = formData.title.trim().length > 0 && formData.summary.trim().length >= 30;

	const handleSubmit = async (event) => {
		event.preventDefault();
		setLoading(true);

		const payload = new FormData();
		payload.set("title", formData.title);
		payload.set("summary", formData.summary);

		try {
			const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE}/mod-jams`, {
				method: "POST",
				headers: { Authorization: `Bearer ${authToken}` },
				body: payload,
			});
			const data = await response.json().catch(() => ({}));

			if(!response.ok) {
				throw new Error(data?.message || t("creation.error"));
			}

			toast.success(t("creation.success"));
			onRequestClose();
			if(typeof onCreated === "function") {
				onCreated(data.mod_jam);
			}
			router.push(`/jams/${data.mod_jam.slug}/settings`);
			router.refresh();
		} catch (error) {
			toast.error(error.message);
		} finally {
			setLoading(false);
		}
	};

	if(!isLoggedIn && isOpen) {
		router.push("/");
		return null;
	}

	return (
		<Modal closeTimeoutMS={150} isOpen={isOpen} onRequestClose={onRequestClose} className="modal active" overlayClassName="modal-overlay">
			<div className="modal-window">
				<div className="modal-window__header">
					<h2 className="modal-window__title">{t("creation.title")}</h2>

					<button className="icon-button modal-window__close" type="button" onClick={onRequestClose} aria-label={t("creation.close")}>
						<svg className="icon icon--cross" height="24" width="24">
							<path fillRule="evenodd" clipRule="evenodd" d="M5.293 5.293a1 1 0 0 1 1.414 0L12 10.586l5.293-5.293a1 1 0 0 1 1.414 1.414L13.414 12l5.293 5.293a1 1 0 0 1-1.414 1.414L12 13.414l-5.293 5.293a1 1 0 0 1-1.414-1.414L10.586 12 5.293 6.707a1 1 0 0 1 0-1.414Z"></path>
						</svg>
					</button>
				</div>

				<div className="modal-window__content">
					<form onSubmit={handleSubmit}>
						<p className="blog-settings__field-title">{t("creation.name")}</p>
						<div className="field field--default">
							<label className="field__wrapper">
								<input type="text" name="title" placeholder={t("creation.namePlaceholder")} value={formData.title} onChange={(event) => setFormData({ ...formData, title: event.target.value })} required className="text-input" maxLength="120" disabled={loading} />
							</label>
						</div>

						<p className="blog-settings__field-title" style={{ marginBottom: "4px" }}>{t("creation.summary")}</p>
						<p style={{ marginBottom: "8px", color: "var(--theme-color-text-secondary)" }}>{t("creation.summaryHint")}</p>

						<div className="field field--default textarea">
							<label className="field__wrapper">
								<textarea name="summary" value={formData.summary} onChange={(event) => setFormData({ ...formData, summary: event.target.value })} placeholder={t("creation.summaryPlaceholder")} className="autosize textarea__input" style={{ height: "128px" }} required minLength={30} maxLength={280} disabled={loading} />
							</label>
						</div>

						<div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "16px" }}>
							<button type="button" className="button button--size-m button--type-minimal" onClick={onRequestClose} disabled={loading}>
								{t("creation.cancel")}
							</button>
							
							<button type="submit" className="button button--size-m button--type-primary" disabled={loading || !isFormValid}>
								{loading ? t("creation.creating") : t("creation.submit")}
							</button>
						</div>
					</form>
				</div>
			</div>
		</Modal>
	);
}