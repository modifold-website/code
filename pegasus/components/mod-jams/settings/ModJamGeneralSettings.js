"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "react-toastify";
import UnsavedChangesBar from "@/components/ui/UnsavedChangesBar";

const DATETIME_LOCAL_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/;

function padDatePart(value) {
	return String(value).padStart(2, "0");
}

function toDatetimeLocal(value) {
	if(!value) {
		return "";
	}

	const text = String(value);
	if(DATETIME_LOCAL_PATTERN.test(text)) {
		return text.slice(0, 16);
	}

	const date = new Date(value);
	if(Number.isNaN(date.getTime())) {
		return "";
	}

	return `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}T${padDatePart(date.getHours())}:${padDatePart(date.getMinutes())}`;
}

function getInitialForm(jam) {
	return {
		title: jam.title || "",
		slug: jam.slug || "",
		summary: jam.summary || "",
		starts_at: toDatetimeLocal(jam.starts_at),
		submissions_start_at: toDatetimeLocal(jam.submissions_start_at || jam.starts_at),
		submissions_end_at: toDatetimeLocal(jam.submissions_end_at),
		voting_starts_at: toDatetimeLocal(jam.voting_starts_at || jam.submissions_end_at),
		voting_end_at: toDatetimeLocal(jam.voting_end_at),
		vote_limit: jam.vote_limit || 1,
	};
}

export default function ModJamGeneralSettings({ authToken, jam }) {
	const t = useTranslations("ModJamsPage");
	const router = useRouter();
	const avatarInputRef = useRef(null);
	const coverInputRef = useRef(null);
	const [saving, setSaving] = useState(false);
	const [form, setForm] = useState(getInitialForm(jam));
	const [savedForm, setSavedForm] = useState(getInitialForm(jam));
	const [avatar, setAvatar] = useState(null);
	const [cover, setCover] = useState(null);
	const [avatarPreview, setAvatarPreview] = useState(jam.avatar_url || "https://media.modifold.com/static/no-project-icon.svg");
	const [coverPreview, setCoverPreview] = useState(jam.cover_url || "");
	const [savedAvatarPreview, setSavedAvatarPreview] = useState(jam.avatar_url || "https://media.modifold.com/static/no-project-icon.svg");
	const [savedCoverPreview, setSavedCoverPreview] = useState(jam.cover_url || "");
	const isDirty = JSON.stringify(form) !== JSON.stringify(savedForm) || Boolean(avatar) || Boolean(cover);

	const updateField = (field, value) => {
		setForm((current) => ({ ...current, [field]: value }));
	};

	const handleImageChange = (field, file) => {
		if(file && file.size > 20 * 1024 * 1024) {
			toast.error(t("settings.general.imageTooLarge"));
			return;
		}

		const preview = file ? URL.createObjectURL(file) : "";
		if(field === "avatar") {
			setAvatar(file || null);
			setAvatarPreview(preview || savedAvatarPreview);
			return;
		}

		setCover(file || null);
		setCoverPreview(preview || savedCoverPreview);
	};

	const save = async (event) => {
		if(event) {
			event.preventDefault();
		}

		if(saving || !isDirty) {
			return;
		}

		setSaving(true);

		const payload = new FormData();
		for(const [key, value] of Object.entries(form)) {
			payload.set(key, value);
		}
		
		if(avatar) {
			payload.set("avatar", avatar);
		}

		if(cover) {
			payload.set("cover", cover);
		}

		try {
			const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE}/mod-jams/${jam.slug}`, {
				method: "PUT",
				headers: { Authorization: `Bearer ${authToken}` },
				body: payload,
			});

			const data = await response.json().catch(() => ({}));
			if(!response.ok) {
				throw new Error(data?.message || t("settings.general.saveError"));
			}

			const nextForm = getInitialForm(data.mod_jam || { ...jam, ...form });
			setForm(nextForm);
			setSavedForm(nextForm);
			setAvatar(null);
			setCover(null);
			setSavedAvatarPreview(data.mod_jam?.avatar_url || avatarPreview);
			setSavedCoverPreview(data.mod_jam?.cover_url || coverPreview);
			if(avatarInputRef.current) {
				avatarInputRef.current.value = "";
			}

			if(coverInputRef.current) {
				coverInputRef.current.value = "";
			}

			toast.success(t("settings.general.saved"));
			router.push(`/jams/${nextForm.slug}/settings`);
			router.refresh();
		} catch (error) {
			toast.error(error.message);
		} finally {
			setSaving(false);
		}
	};

	return (
		<>
			<div className="settings-wrapper settings-wrapper--narrow">
				<div className="settings-content">
					<form onSubmit={save}>
						<div className="blog-settings">
							<div className="blog-settings__body">
								<p className="blog-settings__field-title">{t("settings.general.avatar")}</p>
								<div className="subsite-header mod-jam-media-header">
									<div className="subsite-avatar subsite-header__avatar" style={{ marginTop: 0 }}>
										<div className="andropov-media andropov-media--rounded andropov-media--bordered andropov-media--has-preview subsite-avatar__image andropov-image andropov-image--zoom" data-loaded="true" style={{ aspectRatio: "1 / 1", width: "90px", height: "90px", maxWidth: "none", "--background-color": "var(--theme-color-background)" }}>
											<img id="mod_jam_avatar_preview" alt={t("settings.general.avatarPreviewAlt")} src={avatarPreview} />
										</div>

										<button type="button" className="subsite-avatar__overlay" aria-label={t("settings.general.uploadAvatar")} onClick={() => avatarInputRef.current?.click()}>
											<svg className="icon icon--image" width="40" height="40" viewBox="0 0 24 24">
												<path d="M8 9.5a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0Z"></path>
												<path fillRule="evenodd" clipRule="evenodd" d="M7 3a4 4 0 0 0-4 4v10a4 4 0 0 0 4 4h10a4 4 0 0 0 4-4V7a4 4 0 0 0-4-4H7ZM5 7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v5.252l-1.478-1.477a2 2 0 0 0-3.014.214L8.5 19H7a2 2 0 0 1-2-2V7Zm11.108 5.19L19 15.08V17a2 2 0 0 1-2 2h-6l5.108-6.81Z"></path>
											</svg>
										</button>
									</div>
								</div>

								<input ref={avatarInputRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp" onChange={(event) => handleImageChange("avatar", event.target.files?.[0] || null)} style={{ display: "none" }} />

								<p className="blog-settings__field-title">{t("settings.general.cover")}</p>
								<div className="mod-jam-cover-upload">
									<button type="button" className="mod-jam-cover-upload__preview" onClick={() => coverInputRef.current?.click()} aria-label={t("settings.general.uploadCover")}>
										{coverPreview ? <img src={coverPreview} alt={t("settings.general.coverPreviewAlt")} /> : <span>{t("settings.general.uploadCover")}</span>}
										<span className="mod-jam-cover-upload__overlay">
											<svg className="icon icon--image" width="32" height="32" viewBox="0 0 24 24">
												<path d="M8 9.5a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0Z"></path>
												<path fillRule="evenodd" clipRule="evenodd" d="M7 3a4 4 0 0 0-4 4v10a4 4 0 0 0 4 4h10a4 4 0 0 0 4-4V7a4 4 0 0 0-4-4H7ZM5 7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v5.252l-1.478-1.477a2 2 0 0 0-3.014.214L8.5 19H7a2 2 0 0 1-2-2V7Zm11.108 5.19L19 15.08V17a2 2 0 0 1-2 2h-6l5.108-6.81Z"></path>
											</svg>
										</span>
									</button>
									<input ref={coverInputRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp" onChange={(event) => handleImageChange("cover", event.target.files?.[0] || null)} style={{ display: "none" }} />
								</div>

								<p style={{ marginTop: "12px" }} className="blog-settings__field-title">{t("settings.general.name")}</p>
								<div className="field field--default blog-settings__input">
									<label style={{ marginBottom: "10px" }} className="field__wrapper">
										<input className="text-input" name="title" value={form.title} onChange={(event) => updateField("title", event.target.value)} maxLength="120" required />
										<div className="counter">{form.title.length}/120</div>
									</label>
								</div>

								<p className="blog-settings__field-title">{t("settings.general.shortDescription")}</p>
								<div className="field field--default textarea blog-settings__input">
									<label style={{ marginBottom: "10px" }} className="field__wrapper">
										<textarea className="autosize textarea__input" name="summary" value={form.summary} onChange={(event) => updateField("summary", event.target.value)} style={{ height: "160px" }} minLength={30} maxLength={280} required />
									</label>

									<p>{t("settings.general.shortDescriptionHint")}</p>
								</div>

								<p style={{ marginTop: "12px" }} className="blog-settings__field-title">{t("settings.general.slug")}</p>
								<div className="field field--default blog-settings__input">
									<label style={{ marginBottom: "10px" }} className="field__wrapper">
										<input className="text-input" name="slug" value={form.slug} onChange={(event) => updateField("slug", event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 80))} maxLength="80" required />
										<div className="counter">{form.slug.length}/80</div>
									</label>

									<p>{t("settings.general.publicPage", { slug: form.slug || t("settings.general.slugPlaceholder") })}</p>
								</div>

								<p className="blog-settings__field-title">{t("settings.general.schedule")}</p>
								<div className="mod-jam-form__grid mod-jam-form__grid--four">
									<div>
										<p className="blog-settings__field-title">{t("settings.general.starts")}</p>
										<div className="field field--default blog-settings__input">
											<label className="field__wrapper">
												<input className="text-input" type="datetime-local" value={form.starts_at} onChange={(event) => updateField("starts_at", event.target.value)} required />
											</label>
										</div>
									</div>

									<div>
										<p className="blog-settings__field-title">{t("settings.general.submissionsStart")}</p>
										<div className="field field--default blog-settings__input">
											<label className="field__wrapper">
												<input className="text-input" type="datetime-local" value={form.submissions_start_at} onChange={(event) => updateField("submissions_start_at", event.target.value)} required />
											</label>
										</div>
									</div>

									<div>
										<p className="blog-settings__field-title">{t("settings.general.submissionsEnd")}</p>
										<div className="field field--default blog-settings__input">
											<label className="field__wrapper">
												<input className="text-input" type="datetime-local" value={form.submissions_end_at} onChange={(event) => updateField("submissions_end_at", event.target.value)} required />
											</label>
										</div>
									</div>

									<div>
										<p className="blog-settings__field-title">{t("settings.general.votingStarts")}</p>
										<div className="field field--default blog-settings__input">
											<label className="field__wrapper">
												<input className="text-input" type="datetime-local" value={form.voting_starts_at} onChange={(event) => updateField("voting_starts_at", event.target.value)} required />
											</label>
										</div>
									</div>

									<div>
										<p className="blog-settings__field-title">{t("settings.general.winnersAnnounced")}</p>
										<div className="field field--default blog-settings__input">
											<label className="field__wrapper">
												<input className="text-input" type="datetime-local" value={form.voting_end_at} onChange={(event) => updateField("voting_end_at", event.target.value)} required />
											</label>
										</div>
									</div>
								</div>

							</div>
						</div>
					</form>
				</div>
			</div>

			<UnsavedChangesBar
				isDirty={isDirty}
				isSaving={saving}
				onSave={save}
				onReset={() => {
					setForm(savedForm);
					setAvatar(null);
					setCover(null);
					setAvatarPreview(savedAvatarPreview);
					setCoverPreview(savedCoverPreview);
					if(avatarInputRef.current) {
						avatarInputRef.current.value = "";
					}
					if(coverInputRef.current) {
						coverInputRef.current.value = "";
					}
				}}
				saveLabel={t("settings.unsaved.save")}
				resetLabel={t("settings.unsaved.reset")}
				message={t("settings.unsaved.message")}
			/>
		</>
	);
}