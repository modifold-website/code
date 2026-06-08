"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "react-toastify";

function createEmptyForm() {
	return {
		title: "",
		description: "",
	};
}

export default function ModJamNominationsSettings({ authToken, jam, initialNominations = [] }) {
	const t = useTranslations("ModJamsPage");
	const router = useRouter();
	const [nominations, setNominations] = useState(Array.isArray(initialNominations) ? initialNominations : []);
	const [form, setForm] = useState(createEmptyForm());
	const [editingId, setEditingId] = useState(null);
	const [saving, setSaving] = useState(false);
	const isEditing = Boolean(editingId);
	const isFormValid = form.title.trim().length >= 3;

	const resetForm = () => {
		setForm(createEmptyForm());
		setEditingId(null);
	};

	const saveNomination = async (event) => {
		event.preventDefault();

		if(saving || !isFormValid) {
			return;
		}

		setSaving(true);

		try {
			const endpoint = isEditing ? `${process.env.NEXT_PUBLIC_API_BASE}/mod-jams/${jam.slug}/nominations/${editingId}` : `${process.env.NEXT_PUBLIC_API_BASE}/mod-jams/${jam.slug}/nominations`;
			const response = await fetch(endpoint, {
				method: isEditing ? "PUT" : "POST",
				headers: {
					Authorization: `Bearer ${authToken}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					title: form.title.trim(),
					description: form.description.trim(),
				}),
			});
			const data = await response.json().catch(() => ({}));

			if(!response.ok) {
				throw new Error(data?.message || t("settings.nominations.saveError"));
			}

			setNominations(data.nominations || []);
			resetForm();
			toast.success(isEditing ? t("settings.nominations.updated") : t("settings.nominations.added"));
			router.refresh();
		} catch (error) {
			toast.error(error.message);
		} finally {
			setSaving(false);
		}
	};

	const editNomination = (nomination) => {
		setEditingId(nomination.id);
		setForm({
			title: nomination.title || "",
			description: nomination.description || "",
		});
	};

	const deleteNomination = async (nomination) => {
		if(saving || !nomination?.id) {
			return;
		}

		setSaving(true);

		try {
			const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE}/mod-jams/${jam.slug}/nominations/${nomination.id}`, {
				method: "DELETE",
				headers: { Authorization: `Bearer ${authToken}` },
			});
			const data = await response.json().catch(() => ({}));

			if(!response.ok) {
				throw new Error(data?.message || t("settings.nominations.deleteError"));
			}

			setNominations(data.nominations || []);
			if(Number(editingId) === Number(nomination.id)) {
				resetForm();
			}
			toast.success(t("settings.nominations.deleted"));
			router.refresh();
		} catch (error) {
			toast.error(error.message);
		} finally {
			setSaving(false);
		}
	};

	return (
		<div className="settings-wrapper settings-wrapper--narrow">
			<div className="settings-content">
				<div className="blog-settings">
					<div className="blog-settings__body">
						<p className="blog-settings__field-title">{t("settings.nominations.title")}</p>
						<p className="markdown-editor__hint">{t("settings.nominations.hint")}</p>

						<form onSubmit={saveNomination} className="mod-jam-nominations-form">
							<p className="blog-settings__field-title">{t("settings.nominations.name")}</p>
							<div className="field field--default blog-settings__input">
								<label className="field__wrapper">
									<input className="text-input" value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder={t("settings.nominations.placeholder")} maxLength="80" disabled={saving} />
									<div className="counter">{form.title.length}/80</div>
								</label>
							</div>

							<p className="blog-settings__field-title">{t("settings.nominations.description")}</p>
							<div className="field field--default textarea blog-settings__input">
								<label className="field__wrapper">
									<textarea className="autosize textarea__input" value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} placeholder={t("settings.nominations.descriptionPlaceholder")} maxLength="280" style={{ height: "112px" }} disabled={saving} />
								</label>
							</div>

							<div className="mod-jam-settings-actions" style={{ marginTop: "14px" }}>
								{isEditing && (
									<button className="button button--size-m button--type-minimal" type="button" disabled={saving} onClick={resetForm}>
										{t("settings.nominations.cancelEdit")}
									</button>
								)}

								<button className="button button--size-m button--type-primary" type="submit" disabled={saving || !isFormValid}>
									{isEditing ? t("settings.nominations.saveEdit") : t("settings.nominations.add")}
								</button>
							</div>
						</form>

						<div className="mod-jam-nominations-list">
							{nominations.length === 0 ? (
								<div className="subsite-empty-feed">
									<p className="subsite-empty-feed__title" style={{ textAlign: "center" }}>
										{t("settings.nominations.empty")}
									</p>
								</div>
							) : (
								nominations.map((nomination) => (
									<div key={nomination.id} className="mod-jam-nomination-card">
										<div>
											<strong>{nomination.title}</strong>
										</div>

										<div className="mod-jam-nomination-card__actions">
											<button className="button button--size-s button--type-secondary" type="button" disabled={saving} onClick={() => editNomination(nomination)}>
												{t("settings.nominations.edit")}
											</button>

											<button className="button button--size-s button--type-secondary" type="button" disabled={saving} onClick={() => deleteNomination(nomination)}>
												{t("settings.nominations.delete")}
											</button>
										</div>
									</div>
								))
							)}
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}