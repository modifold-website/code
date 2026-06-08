"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "react-toastify";
import UnsavedChangesBar from "@/components/ui/UnsavedChangesBar";

function getInitialLinks(jam) {
	return {
		discord: jam.external_links?.discord || "",
		website: jam.external_links?.website || "",
	};
}

export default function ModJamLinksSettings({ authToken, jam }) {
	const t = useTranslations("ModJamsPage");
	const router = useRouter();
	const [saving, setSaving] = useState(false);
	const [links, setLinks] = useState(getInitialLinks(jam));
	const [savedLinks, setSavedLinks] = useState(getInitialLinks(jam));
	const isDirty = JSON.stringify(links) !== JSON.stringify(savedLinks);

	const save = async (event) => {
		if(event) {
			event.preventDefault();
		}

		if(saving || !isDirty) {
			return;
		}

		setSaving(true);

		const externalLinks = {};
		if(links.discord) {
			externalLinks.discord = links.discord;
		}

		if(links.website) {
			externalLinks.website = links.website;
		}

		const payload = new FormData();
		payload.set("external_links", JSON.stringify(externalLinks));

		try {
			const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE}/mod-jams/${jam.slug}`, {
				method: "PUT",
				headers: { Authorization: `Bearer ${authToken}` },
				body: payload,
			});

			const data = await response.json().catch(() => ({}));
			if(!response.ok) {
				throw new Error(data?.message || t("settings.links.saveError"));
			}

			const nextLinks = getInitialLinks(data.mod_jam || { external_links: externalLinks });
			setLinks(nextLinks);
			setSavedLinks(nextLinks);
			toast.success(t("settings.links.saved"));
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
								<p className="blog-settings__field-title">{t("settings.links.discord")}</p>
								<div className="field field--default blog-settings__input">
									<label style={{ marginBottom: "10px" }} className="field__wrapper">
										<input type="url" className="text-input" value={links.discord} onChange={(event) => setLinks((current) => ({ ...current, discord: event.target.value }))} placeholder={t("settings.links.discordPlaceholder")} />
									</label>
								</div>

								<p className="blog-settings__field-title">{t("settings.links.website")}</p>
								<div className="field field--default blog-settings__input">
									<label style={{ marginBottom: "10px" }} className="field__wrapper">
										<input type="url" className="text-input" value={links.website} onChange={(event) => setLinks((current) => ({ ...current, website: event.target.value }))} placeholder={t("settings.links.websitePlaceholder")} />
									</label>
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
				onReset={() => setLinks(savedLinks)}
				saveLabel={t("settings.unsaved.save")}
				resetLabel={t("settings.unsaved.reset")}
				message={t("settings.unsaved.message")}
			/>
		</>
	);
}