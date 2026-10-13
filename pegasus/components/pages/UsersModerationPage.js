"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import UserName from "../ui/UserName";
import UserModerationMenu from "../moderation/UserModerationMenu";
import UserModerationModal from "@/modal/UserModerationModal";
import { useModerationUsers } from "@/utils/moderation/hooks";

export default function UsersModerationPage({ authToken, initialData, canEdit = false }) {
	const t = useTranslations("UsersModerationPage");
	const [input, setInput] = useState("");
	const [search, setSearch] = useState("");
	const [page, setPage] = useState(1);
	const [selected, setSelected] = useState(null);
	const query = useModerationUsers({ authToken, initialData, page, search });
	const users = query.data?.users || [];
	const totalPages = query.data?.totalPages || 1;

	useEffect(() => {
		if(query.data?.totalPages && page > query.data.totalPages) {
			setPage(query.data.totalPages);
		}
	}, [page, query.data?.totalPages]);

	useEffect(() => {
		const timeout = setTimeout(() => {
			setSearch(input.trim());
			setPage(1);
		}, 300);

		return () => clearTimeout(timeout);
	}, [input]);

	return (
		<>
			<div className="moderation-toolbar">
				<div className="field field--large user-moderation__search">
					<label className="field__wrapper">
						<div className="field__wrapper-body">
							<svg className="icon icon--search field__icon field__icon--left" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
								<path d="m21 21-4.34-4.34" />
								<circle cx="11" cy="11" r="8" />
							</svg>

							<input
								type="search"
								className="text-input"
								value={input}
								maxLength={100}
								placeholder={t("search.placeholder")}
								aria-label={t("search.label")}
								onChange={(event) => setInput(event.target.value)}
							/>
						</div>
					</label>
				</div>
			</div>

			<section className="content content--padding user-moderation" aria-label={t("listLabel")}>
				{query.isError ? (
					<div role="alert" className="user-moderation__empty">
						<p>{t("errors.fetch")}</p>

						<button type="button" className="button button--size-m button--type-secondary" onClick={() => query.refetch()}>
							{t("retry")}
						</button>
					</div>
				) : query.isPending ? (
					<p className="user-moderation__empty" role="status">{t("loading")}</p>
				) : !users.length ? (
					<div className="user-moderation__empty">
						<p>{t(search ? "search.empty" : "empty")}</p>

						{search && (
							<button type="button" className="button button--size-m button--type-minimal" onClick={() => setInput("")}>
								{t("search.clear")}
							</button>
						)}
					</div>
				) : (
					<div className="user-moderation__list">
						{users.map((user) => (
							<div key={user.id} className="user-moderation__row">
								<Link href={`/user/${user.slug}`} className="user-moderation__identity">
									<img src={user.avatar || "/images/no-project-icon.svg"} width="40" height="40" alt="" />

									<span className="user-moderation__name">
										<UserName user={user} className="user-moderation__display-name" />
										<span className="user-moderation__slug">@{user.slug}</span>
									</span>
								</Link>

								<span className="user-moderation__role">{t.has(`roles.${user.isRole}`) ? t(`roles.${user.isRole}`) : user.isRole}</span>

								{canEdit && (
									<UserModerationMenu
										label={t("actions.manageNamed", { username: user.username })}
										options={[
											{
												value: "edit",
												label: t("actions.edit"),
												onSelect: () => setSelected({ user, view: "edit" }),
											},
											{
												value: "achievements",
												label: t("actions.achievements"),
												onSelect: () => setSelected({ user, view: "achievements" }),
											},
										]}
									>
										<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
											<path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915" />
											<circle cx="12" cy="12" r="3" />
										</svg>
									</UserModerationMenu>
								)}
							</div>
						))}
					</div>
				)}

				{totalPages > 1 && !query.isError && (
					<div className="pagination user-moderation__pagination">
						<button type="button" className="button button--size-m button--type-minimal" disabled={page <= 1 || query.isFetching} onClick={() => setPage((current) => current - 1)}>
							{t("pagination.previous")}
						</button>

						<span>{t("pagination.pageOf", { page, totalPages })}</span>

						<button type="button" className="button button--size-m button--type-minimal" disabled={page >= totalPages || query.isFetching} onClick={() => setPage((current) => current + 1)}>
							{t("pagination.next")}
						</button>
					</div>
				)}
			</section>

			{selected && (
				<UserModerationModal
					key={`${selected.user.id}-${selected.view}`}
					user={selected.user}
					view={selected.view}
					authToken={authToken}
					onClose={() => setSelected(null)}
				/>
			)}
		</>
	);
}