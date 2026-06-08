"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "react-toastify";
import UserName from "@/components/ui/UserName";

export default function ModJamJurySettings({ authToken, jam, initialJury = [] }) {
	const t = useTranslations("ModJamsPage");
	const router = useRouter();
	const [jury, setJury] = useState(Array.isArray(initialJury) ? initialJury : []);
	const [userSlug, setUserSlug] = useState("");
	const [saving, setSaving] = useState(false);

	const addJuryMember = async (event) => {
		event.preventDefault();

		const normalizedSlug = userSlug.trim().toLowerCase();
		if(!normalizedSlug || saving) {
			return;
		}

		setSaving(true);

		try {
			const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE}/mod-jams/${jam.slug}/jury`, {
				method: "POST",
				headers: {
					Authorization: `Bearer ${authToken}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ user_slug: normalizedSlug }),
			});
			const data = await response.json().catch(() => ({}));

			if(!response.ok) {
				throw new Error(data?.message || t("settings.jury.addError"));
			}

			setJury(data.jury || []);
			setUserSlug("");
			toast.success(t("settings.jury.added"));
			router.refresh();
		} catch (error) {
			toast.error(error.message);
		} finally {
			setSaving(false);
		}
	};

	const removeJuryMember = async (member) => {
		if(!member?.user_id || saving) {
			return;
		}

		setSaving(true);

		try {
			const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE}/mod-jams/${jam.slug}/jury/${member.user_id}`, {
				method: "DELETE",
				headers: { Authorization: `Bearer ${authToken}` },
			});
			const data = await response.json().catch(() => ({}));

			if(!response.ok) {
				throw new Error(data?.message || t("settings.jury.removeError"));
			}

			setJury(data.jury || []);
			toast.success(t("settings.jury.removed"));
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
						<p className="blog-settings__field-title">{t("settings.jury.title")}</p>
						<p className="markdown-editor__hint">{t("settings.jury.hint")}</p>

						<form onSubmit={addJuryMember} className="mod-jam-jury-settings-form">
							<div className="field field--default blog-settings__input">
								<label className="field__wrapper">
									<input className="text-input" value={userSlug} onChange={(event) => setUserSlug(event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} placeholder={t("settings.jury.placeholder")} disabled={saving} />
								</label>
							</div>

							<button className="button button--size-m button--type-primary" type="submit" disabled={saving || !userSlug.trim()}>
								{t("settings.jury.add")}
							</button>
						</form>

						<div className="mod-jam-jury-settings-list">
							{jury.length === 0 ? (
								<p className="mod-jam-jury-settings-empty">{t("settings.jury.empty")}</p>
							) : (
								jury.map((member) => (
									<div key={member.user_id} className="author author-card mod-jam-jury-settings-card" style={{ "--1ebedaf6": "40px", display: "flex" }}>
										<Link className="author__avatar button--active-transform" href={`/user/${member.user?.slug}`}>
											<div className="andropov-media andropov-media--rounded andropov-media--bordered andropov-media--loaded andropov-media--has-preview andropov-image" style={{ aspectRatio: "1.77778 / 1", width: "40px", height: "40px", maxWidth: "none" }}>
												<img className="magnify" alt={member.user?.username || ""} src={member.user?.avatar || "https://media.modifold.com/static/no-project-icon.svg"} />
											</div>
										</Link>

										<div className="author__main">
											<Link className="author__name" href={`/user/${member.user?.slug}`}>
												<UserName user={member.user} />
											</Link>
										</div>

										<div className="author__details" style={{ marginLeft: "auto" }}>
											<span>{t("jury.member")}</span>
										</div>

										<button className="button button--size-s button--type-secondary" type="button" disabled={saving} onClick={() => removeJuryMember(member)}>
											{t("settings.jury.remove")}
										</button>
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