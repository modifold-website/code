"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "react-toastify";

export default function ModJamModerationSettings({ authToken, jam }) {
	const t = useTranslations("ModJamsPage");
	const router = useRouter();
	const [saving, setSaving] = useState(false);
	const [reviewStatus, setReviewStatus] = useState(jam.status || "");
	const isPendingReview = reviewStatus === "pending_review";
	const isApproved = reviewStatus === "approved";

	const submitForReview = async () => {
		if(saving || isPendingReview || isApproved) {
			return;
		}

		setSaving(true);

		try {
			const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE}/mod-jams/${jam.slug}/submit-review`, {
				method: "POST",
				headers: { Authorization: `Bearer ${authToken}` },
			});
			const data = await response.json().catch(() => ({}));

			if(!response.ok) {
				throw new Error(data?.message || t("settings.moderation.submitReviewError"));
			}

			setReviewStatus("pending_review");
			toast.success(t("settings.moderation.sentToModeration"));
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
						<p className="blog-settings__field-title">{t("settings.moderation.title")}</p>
						<p className="markdown-editor__hint">{t("settings.moderation.hint")}</p>

						<div className="mod-jam-moderation-status">
							<strong>{t("settings.moderation.currentStatus")}</strong>
							<span className={`mod-jam-status mod-jam-status--${reviewStatus}`}>{t(`settings.moderation.status.${reviewStatus}`)}</span>
						</div>

						{jam.rejection_reason && (
							<div className="mod-jam-moderation-rejection">
								<strong>{t("settings.moderation.rejectionReason")}</strong>
								<p>{jam.rejection_reason}</p>
							</div>
						)}

						<div className="mod-jam-settings-actions">
							<Link className="button button--size-m button--type-minimal" href={`/jams/${jam.slug}`}>
								{t("settings.moderation.preview")}
							</Link>

							<button className="button button--size-m button--type-primary" type="button" disabled={saving || isPendingReview || isApproved} onClick={submitForReview}>
								{isPendingReview ? t("settings.moderation.pendingReview") : isApproved ? t("settings.moderation.approved") : t("settings.moderation.submitForReview")}
							</button>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}