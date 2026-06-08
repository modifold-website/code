"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { toast } from "react-toastify";

export default function ModJamModerationPage({ authToken, initialJams = [] }) {
	const t = useTranslations("ModJamsPage");
	const [jams, setJams] = useState(initialJams);

	const moderate = async (jam, status) => {
		const reason = status === "rejected" ? window.prompt(t("moderation.rejectionReason")) : t("moderation.approvedReason");
		if(status === "rejected" && !reason) {
			return;
		}

		try {
			const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE}/mod-jams/${jam.id}/moderate`, {
				method: "POST",
				headers: {
					Authorization: `Bearer ${authToken}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ status, reason }),
			});
			
			const data = await response.json().catch(() => ({}));
			if(!response.ok) {
				throw new Error(data?.message || t("moderation.error"));
			}

			setJams((current) => current.filter((item) => item.id !== jam.id));
			toast.success(status === "approved" ? t("moderation.approved") : t("moderation.rejected"));
		} catch (error) {
			toast.error(error.message);
		}
	};

	return (
		<>
			{jams.length === 0 ? (
				<div className="content content--padding">
					<p>{t("moderation.empty")}</p>
				</div>
			) : (
				<div className="projects-grid">
					{jams.map((jam) => (
						<div className="new-projects-list" key={jam.id}>
							<div className="new-project-card">
								<div className="mod-jam-moderation-card">
									<img className="new-project-icon" src={jam.avatar_url} alt="" />

									<div className="new-project-info">
										<div className="new-project-header">
											<Link className="new-project-title" href={`/jams/${jam.slug}`}>{jam.title}</Link>
										</div>
										<p className="new-project-description">{jam.summary}</p>
									</div>

									<div className="new-project-stats">
										<button className="button button--size-m button--type-primary" type="button" onClick={() => moderate(jam, "approved")}>
											{t("moderation.approve")}
										</button>
										
										<button className="button button--size-m button--type-minimal" type="button" onClick={() => moderate(jam, "rejected")}>
											{t("moderation.reject")}
										</button>
									</div>
								</div>
							</div>
						</div>
					))}
				</div>
			)}
		</>
	);
}