"use client";

import { useEffect, useState } from "react";
import { useAuth } from "../providers/AuthProvider";
import { useRouter } from "next/navigation";
import axios from "axios";
import { toast } from "react-toastify";
import { useTranslations } from "next-intl";

export default function SettingsVerificationPage({ initialUser = null, initialVerification = null }) {
	const t = useTranslations("SettingsVerificationPage");
	const { isLoggedIn, user } = useAuth();
	const router = useRouter();
	const effectiveUser = user || initialUser;

	const [verificationStatus, setVerificationStatus] = useState(() => ({
		isVerified: initialVerification?.isVerified || false,
		eligibility: initialVerification?.eligibility || null,
		loading: !initialVerification,
	}));
	const [isSubmitting, setIsSubmitting] = useState(false);

	const fetchVerificationStatus = async () => {
		try {
			const res = await axios.get(`${process.env.NEXT_PUBLIC_API_BASE}/verification/me`, {
				headers: { Authorization: `Bearer ${localStorage.getItem("authToken")}` },
			});

			setVerificationStatus({
				isVerified: res.data.isVerified === 1,
				eligibility: res.data.eligibility || null,
				loading: false,
			});
		} catch (err) {
			setVerificationStatus((prev) => ({ ...prev, loading: false }));
			toast.error(t("errors.fetch"));
		}
	};

	useEffect(() => {
		if(!isLoggedIn && !initialUser) {
			router.push("/403");
			return;
		}

		if(!initialVerification) {
			fetchVerificationStatus();
		}
	}, [isLoggedIn, initialUser, initialVerification, router]);

	if(!isLoggedIn && !initialUser) {
		return null;
	}

	const publishedProjects = Number(verificationStatus?.eligibility?.publishedProjects) || 0;
	const minProjects = Number(verificationStatus?.eligibility?.requirements?.minProjects) || 3;
	const totalDownloads = Number(verificationStatus?.eligibility?.totalDownloads) || 0;
	const minDownloads = Number(verificationStatus?.eligibility?.requirements?.minDownloads) || 500;
	const hasMinProjects = publishedProjects >= minProjects;
	const hasMinDownloads = totalDownloads >= minDownloads;
	const isEligible = Boolean(verificationStatus?.eligibility?.eligible);
	const statusLabel = verificationStatus.isVerified ? t("status.verified") : t("status.notVerified");

	const handleClaimBadge = async () => {
		try {
			setIsSubmitting(true);

			await axios.post(
				`${process.env.NEXT_PUBLIC_API_BASE}/verification/request`,
				{},
				{ headers: { Authorization: `Bearer ${localStorage.getItem("authToken")}` } }
			);

			toast.success(t("success.claimed"));
			await fetchVerificationStatus();
		} catch (error) {
			const message = error?.response?.data?.message;
			if(message === "Requirements not met") {
				toast.error(t("errors.notEligible"));
			} else if(message === "User already verified") {
				toast.error(t("errors.alreadyVerified"));
			} else {
				toast.error(t("errors.claim"));
			}
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<>
			<div className="settings-wrapper blog-settings settings-wrapper--narrow">
				<div className="blog-settings__body">
					<div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
						<img src="/badges/creator.webp" alt={t("badgeAlt")} width="50" style={{ display: "block" }} />
						
						<div>
							<p className="blog-settings__field-title" style={{ marginBottom: "0px", fontSize: "16px" }}>{t("title")}</p>
							<p style={{ margin: 0, color: "var(--theme-color-text-secondary)", fontSize: "16px" }}>{t("subtitle")}</p>
						</div>
					</div>

					<div style={{ borderRadius: "16px", padding: "16px", marginBottom: "14px", background: "var(--theme-color-background)" }}>
						<div className="author" style={{ "--1ebedaf6": "30px", "--avatar-size": "30px", display: "flex", alignItems: "center" }}>
							<div className="author__avatar">
								<div className="andropov-media andropov-media--rounded andropov-media--bordered andropov-media--loaded andropov-media--has-preview andropov-image" style={{ aspectRatio: "1.77778 / 1", width: "30px", height: "30px", maxWidth: "none" }}>
									<picture>
										<img alt={t("promoCard.avatarAlt")} src={effectiveUser?.avatar || "https://media.modifold.com/static/no-project-icon.svg"} />
									</picture>
								</div>
							</div>

							<div className="author__main" style={{ fontWeight: 500 }}>
								<span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
									<span>{effectiveUser?.username || effectiveUser?.slug || t("promoCard.usernameFallback")}</span>
									<img alt={t("status.verified")} src="/badges/creator.webp" style={{ width: "18px", display: "inline-block" }} />
								</span>
							</div>
						</div>

						<div style={{ marginTop: "8px", color: "var(--theme-color-text-secondary)" }}>
							{t("benefitsNote")}
						</div>
					</div>

					<div style={{ background: "var(--theme-color-background)", borderRadius: "16px", padding: "16px", marginBottom: "14px" }}>
						<p className="blog-settings__field-title" style={{ marginBottom: "8px" }}>{t("whatYouGetTitle")}</p>
						<ul style={{ margin: 0, paddingLeft: "18px", color: "var(--theme-color-text-secondary)" }}>
							<li>{t("whatYouGet.list1")}</li>
							<li>{t("whatYouGet.list2")}</li>
							<li>{t("whatYouGet.list3")}</li>
						</ul>
					</div>

					<div style={{ background: "var(--theme-color-background)", borderRadius: "16px", padding: "16px", marginBottom: "14px" }}>
						<p className="blog-settings__field-title" style={{ marginBottom: "8px" }}>{t("requirementsTitle")}</p>
						<div style={{ display: "grid", gap: "8px" }}>
							<div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--theme-color-text-secondary)" }}>
								{hasMinProjects ? (
									<svg style={{ fill: "none", color: "#4caf50" }} xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
										<path d="M20 6 9 17l-5-5"/>
									</svg>
								) : (
									<svg style={{ fill: "none", color: "#d84545" }} xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
										<path d="M18 6 6 18"/>
										<path d="m6 6 12 12"/>
									</svg>
								)}

								<span>{t("requirementsList.projects", { required: minProjects })}</span>
							</div>

							<div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--theme-color-text-secondary)" }}>
								{hasMinDownloads ? (
									<svg style={{ fill: "none", color: "#4caf50" }} xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
										<path d="M20 6 9 17l-5-5"/>
									</svg>
								) : (
									<svg style={{ fill: "none", color: "#d84545" }} xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
										<path d="M18 6 6 18"/>
										<path d="m6 6 12 12"/>
									</svg>
								)}

								<span>{t("requirementsList.downloads", { required: minDownloads })}</span>
							</div>
						</div>
					</div>

					<div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap", background: "var(--theme-color-background)", borderRadius: "16px", padding: "16px" }}>
						<div>
							<p className="blog-settings__field-title" style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "0" }}>
								<span>{t("statusLabel")}: {statusLabel}</span>

								{verificationStatus.isVerified && (
									<img src="/badges/creator.webp" alt={t("status.verified")} width="20" style={{ display: "inline-block" }} />
								)}
							</p>
						</div>

						{!verificationStatus.isVerified && (
							<button type="button" className="button button--size-m button--type-primary" onClick={handleClaimBadge} disabled={!isEligible || isSubmitting}>
								{isSubmitting ? t("claiming") : t("claim")}
							</button>
						)}
					</div>
				</div>
			</div>
		</>
	);
}