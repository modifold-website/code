"use client";

import { useEffect, useRef, useState } from "react";
import Modal from "react-modal";
import { useTranslations } from "next-intl";
import { toast } from "react-toastify";
import { useAuth } from "@/components/providers/AuthProvider";
import UserModerationMenu from "@/components/moderation/UserModerationMenu";
import { useModerationAchievements, useUserModerationActions } from "@/utils/moderation/hooks";
import ConfirmModal from "./ConfirmModal";

function UserProfileForm({ user, saveUser, onClose, t }) {
	const { user: actor } = useAuth();
	const [form, setForm] = useState(() => ({
		username: user.username || "",
		email: user.email || "",
		slug: user.slug || "",
		description: user.description || "",
		isRole: user.isRole || "user",
		avatar: null,
	}));
	const [preview, setPreview] = useState(user.avatar);
	const [error, setError] = useState(null);
	const fileRef = useRef(null);
	const errorRef = useRef(null);

	useEffect(() => {
		if(error) {
			errorRef.current?.focus();
		}
	}, [error]);

	useEffect(() => {
		if(!form.avatar) {
			return;
		}

		const url = URL.createObjectURL(form.avatar);
		setPreview(url);

		return () => URL.revokeObjectURL(url);
	}, [form.avatar]);

	const update = (event) => {
		setForm((prev) => ({
			...prev,
			[event.target.name]: event.target.value,
		}));
	};

	const submit = async (event) => {
		event.preventDefault();

		if(saveUser.isPending) {
			return;
		}

		setError(null);

		const data = new FormData();
		for(const name of ["username", "email", "slug", "description", "isRole"]) {
			data.append(name, form[name]);
		}

		if(form.avatar) {
			data.append("avatar", form.avatar);
		}

		try {
			await saveUser.mutateAsync(data);
			toast.success(t("success.userUpdated"));
			onClose();
		} catch(failure) {
			const response = failure.response?.data;
			const fallbackCode = [401, 403].includes(failure.response?.status) ? "forbidden" : "updateUser";
			const code = typeof response?.code === "string" && t.has(`errors.${response.code}`) ? response.code : fallbackCode;

			setError({
				message: t(`errors.${code}`),
				field: response?.field,
			});
		}
	};

	return (
		<form id="user-moderation-form" className="user-moderation-form" onSubmit={submit}>
			{error && (
				<div ref={errorRef} id="user-moderation-error" className="user-moderation-error" role="alert" tabIndex={-1}>
					{error.message}
				</div>
			)}

			<div className="user-moderation-avatar">
				<img src={preview || "/images/no-project-icon.svg"} alt={t("fields.avatarAlt")} width="64" height="64" />

				<button type="button" className="button button--size-m button--type-minimal" disabled={saveUser.isPending} onClick={() => fileRef.current?.click()}>
					{t("actions.changeAvatar")}
				</button>

				<input
					ref={fileRef}
					type="file"
					accept="image/jpeg,image/png,image/gif"
					hidden
					onChange={(event) => {
						const file = event.target.files?.[0];
						if(!file) {
							return;
						}

						if(file.size > 20 * 1024 * 1024) {
							toast.error(t("errors.fileTooLarge"));
							event.target.value = "";
							return;
						}

						setForm((prev) => ({ ...prev, avatar: file }));
					}}
				/>
			</div>

			{["username", "email", "slug"].map((name) => (
				<div key={name} className="user-moderation-field">
					<label htmlFor={`moderation-user-${name}`} className="blog-settings__field-title">{t(`fields.${name}`)}</label>

					<div className="field field--default">
						<div className="field__wrapper">
							<input
								id={`moderation-user-${name}`}
								name={name}
								type={name === "email" ? "email" : "text"}
								className="text-input"
								value={form[name]}
								onChange={update}
								required={name !== "email"}
								maxLength={name === "email" ? 255 : name === "slug" ? 30 : 100}
								disabled={saveUser.isPending}
								autoComplete="off"
								spellCheck={name === "username"}
								aria-invalid={error?.field === name || undefined}
								aria-describedby={error?.field === name ? "user-moderation-error" : name === "email" ? "moderation-email-hint" : undefined}
							/>
						</div>
					</div>

					{name === "email" && (
						<p id="moderation-email-hint" className="user-moderation-hint">{t("emailHint")}</p>
					)}

					{name === "slug" && (
						<p className="user-moderation-hint">modifold.com/user/{form.slug}</p>
					)}
				</div>
			))}

			<div className="user-moderation-field">
				<span className="blog-settings__field-title">{t("fields.role")}</span>

				<UserModerationMenu
					stretch
					label={[t("fields.role"), t.has(`roles.${form.isRole}`) ? t(`roles.${form.isRole}`) : form.isRole].join(": ")}
					value={form.isRole}
					disabled={saveUser.isPending || Number(actor?.id) === Number(user.id)}
					options={["admin", "moderator", "user"].map((role) => ({
						value: role,
						label: t(`roles.${role}`),
						onSelect: () => setForm((prev) => ({ ...prev, isRole: role })),
					}))}
				>
					<span>{t.has(`roles.${form.isRole}`) ? t(`roles.${form.isRole}`) : form.isRole}</span>
					<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
						<path d="m6 9 6 6 6-6" />
					</svg>
				</UserModerationMenu>

				{Number(actor?.id) === Number(user.id) && (
					<p className="user-moderation-hint">{t("errors.ownRole")}</p>
				)}
			</div>

			<div className="user-moderation-field">
				<label className="blog-settings__field-title" htmlFor="moderation-user-description">{t("fields.description")}</label>

				<div className="field field--default textarea">
					<div className="field__wrapper">
						<textarea
							id="moderation-user-description"
							name="description"
							className="textarea__input"
							rows="4"
							maxLength={5000}
							value={form.description}
							onChange={update}
							disabled={saveUser.isPending}
							aria-invalid={error?.field === "description" || undefined}
							aria-describedby={error?.field === "description" ? "user-moderation-error" : undefined}
						/>
					</div>
				</div>
			</div>
		</form>
	);
}

export default function UserModerationModal({ user, view, authToken, onClose }) {
	const t = useTranslations("UsersModerationPage");
	const tAchievement = useTranslations("ProfilePage.achievements");
	const [revoke, setRevoke] = useState(null);
	const modalRef = useRef(null);
	const [achievementError, setAchievementError] = useState("");
	const { saveUser, updateAchievement } = useUserModerationActions({ authToken, userId: user.id });
	const query = useModerationAchievements({ authToken, userId: user.id, enabled: view === "achievements" });
	const busy = saveUser.isPending || updateAchievement.isPending;
	const appElement = typeof document !== "undefined" ? document.querySelector(".moderation-page") : undefined;

	useEffect(() => {
		if(modalRef.current) {
			modalRef.current.inert = Boolean(revoke);
		}
	}, [revoke]);

	useEffect(() => {
		const siblings = [...document.body.children].filter((element) => !element.classList.contains("ReactModalPortal"));
		const previous = siblings.map((element) => element.inert);

		siblings.forEach((element) => {
			element.inert = true;
		});

		return () => siblings.forEach((element, index) => {
			element.inert = previous[index];
		});
	}, []);

	const titleFor = (item) => tAchievement.has(`items.${item.code}.title`) ? tAchievement(`items.${item.code}.title`) : item.name;

	const update = async (item, earned) => {
		setAchievementError("");

		try {
			await updateAchievement.mutateAsync({ code: item.code, earned });
			setRevoke(null);
			toast.success(t(earned ? "success.achievementGranted" : "success.achievementRevoked"));
		} catch(error) {
			setRevoke(null);
			setAchievementError(t(error.response?.status === 403 ? "errors.forbidden" : "errors.achievement"));
		}
	};

	const achievements = [...(query.data || [])].sort((a, b) => (
		Number(b.code === "creator_badge") - Number(a.code === "creator_badge") || Number(b.earned) - Number(a.earned)
	));

	return (
		<>
			<Modal
				contentRef={(element) => {
					modalRef.current = element;
				}}
				appElement={appElement}
				isOpen
				closeTimeoutMS={150}
				onRequestClose={() => {
					if(!busy && !revoke) {
						onClose();
					}
				}}
				shouldCloseOnEsc={!busy && !revoke}
				shouldCloseOnOverlayClick={!busy && !revoke}
				className="modal active user-moderation-modal"
				overlayClassName="modal-overlay"
				contentLabel={t(view === "edit" ? "modal.title" : "achievements.title", { username: user.username })}
			>
				<div className="modal-window">
					<div className="modal-window__header">
						<h2 className="modal-window__title">{t(view === "edit" ? "modal.title" : "achievements.title", { username: user.username })}</h2>

						<button type="button" className="icon-button modal-window__close" aria-label={t("actions.close")} disabled={busy} onClick={onClose}>
							<svg className="icon icon--cross" width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
								<path d="m6 6 12 12M18 6 6 18" fill="none" stroke="currentColor" strokeWidth="2" />
							</svg>
						</button>
					</div>

					<div className="modal-window__content user-moderation-modal__body">
						{view === "edit" ? (
							<UserProfileForm user={user} t={t} saveUser={saveUser} onClose={onClose} />
						) : (
							<>
								<p className="user-moderation-hint">{t("achievements.note")}</p>

								{achievementError && (
									<p role="alert" className="user-moderation-error">{achievementError}</p>
								)}

								{query.isPending ? (
									<p role="status">{t("loading")}</p>
								) : query.isError ? (
									<div role="alert">
										<p>{t("errors.achievementsFetch")}</p>

										<button type="button" className="button button--size-m button--type-secondary" onClick={() => query.refetch()}>
											{t("retry")}
										</button>
									</div>
								) : !achievements.length ? (
									<p>{t("achievements.empty")}</p>
								) : (
									<div className="user-moderation-achievements">
										{achievements.map((item) => (
											<div key={item.code} className="user-moderation-achievement">
												<img src={item.icon_url || "/images/no-project-icon.svg"} width="40" height="40" alt="" />

												<div className="user-moderation-achievement__copy">
													<h3>{titleFor(item)}</h3>
												</div>

												<button type="button" className="button button--size-m button--type-minimal" disabled={busy} aria-label={t(item.earned ? "achievements.revokeNamed" : "achievements.grantNamed", { name: titleFor(item) })} onClick={() => item.earned ? setRevoke(item) : update(item, true)}>
													{t(item.earned ? "achievements.revoke" : "achievements.grant")}
												</button>
											</div>
										))}
									</div>
								)}

								<p className="user-moderation-hint">{t("achievements.reearn")}</p>
							</>
						)}
					</div>

					<div className="user-moderation-modal__footer">
						<button type="button" className="button button--size-m button--type-minimal" disabled={busy} onClick={onClose}>
							{t(view === "edit" ? "actions.cancel" : "actions.close")}
						</button>

						{view === "edit" && (
							<button type="submit" form="user-moderation-form" className="button button--size-m button--type-primary" disabled={busy}>
								{t(saveUser.isPending ? "actions.saving" : "actions.save")}
							</button>
						)}
					</div>
				</div>
			</Modal>

			<ConfirmModal
				appElement={appElement}
				isOpen={Boolean(revoke)}
				title={t("achievements.confirmTitle", { name: revoke ? titleFor(revoke) : "" })}
				description={t("achievements.confirmDescription", { username: user.username })}
				confirmLabel={t("achievements.revoke")}
				cancelLabel={t("actions.cancel")}
				isLoading={updateAchievement.isPending}
				onRequestClose={() => {
					if(!busy) {
						setRevoke(null);
					}
				}}
				onConfirm={() => {
					if(revoke && !busy) {
						update(revoke, false);
					}
				}}
			/>
		</>
	);
}