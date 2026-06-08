"use client";

import Link from "next/link";

const previewNotifications = [
	{
		day: "notificationsPreview.days.yesterday",
		items: [
			{
				version: "2.7.0",
				time: "12:30 PM",
			},
		],
	},
	{
		day: "notificationsPreview.days.previous",
		items: [
			{
				version: "2.6.3",
				time: "08:27 PM",
			},
			{
				version: "2.6.2",
				time: "07:44 AM",
			},
		],
	},
];

function PreviewNotificationItem({ item, t }) {
	return (
		<div className="notification-item home-notification-item">
			<div className="notification-item__image">
				<div className="notification-avatars-stack">
					<Link className="notification-avatars-stack__item" href="/user/siren">
						<img alt="Siren" className="notification-avatars-stack__avatar" loading="lazy" src="https://media.modifold.com/1772557202640-siren-logo.webp" />
					</Link>

					<svg className="notification-item__icon notification-item__icon--blue" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
						<circle cx="8" cy="8" r="8" fill="currentColor"></circle>
						<path d="M5 8h6M8 5v6" stroke="#fff" strokeWidth="1.6" strokeLinecap="round"></path>
					</svg>
				</div>
			</div>

			<div className="notification-item__body">
				<div className="notification-item__text">
					<Link className="notification-item__actor-link" href="/user/siren">
						<b>
							<span className="home-notification-actor">
								<span>Siren</span>
								<img alt="Verified" src="/badges/creator.webp" />
							</span>
						</b>
					</Link>{" "}
					{t("notificationsPreview.releasedVersion", { version: item.version })}{" "}
					<Link className="notification-item__project-link" href="/mod/mermaids">
						<b>Mermaids</b>
					</Link>
				</div>

				<div className="notification-item__date">{item.time}</div>
			</div>

			<div className="notification-item__etc">
				<Link href="/mod/mermaids">
					<img alt="Mermaids" className="notification-project-thumb" loading="lazy" src="https://media.modifold.com/projects/FlmWzw/mermaids-logo-2.0.0_small_f0581b02.webp" />
				</Link>
			</div>
		</div>
	);
}

export default function HomeNotificationsSection({ t }) {
	return (
		<section className="home-notifications-section">
			<div className="showcase-notifications notifications">
				<span className="notifications__header-text">{t("notificationsPreview.panelTitle")}</span>

				<div className="notifications-feed">
					{previewNotifications.map((group) => (
						<section className="notifications-day-group" key={group.day}>
							<h3 className="notifications-day-group__title">{t(group.day)}</h3>

							<div className="notifications-day-group__items">
								{group.items.map((item) => (
									<PreviewNotificationItem item={item} key={item.version} t={t} />
								))}
							</div>
						</section>
					))}
				</div>
			</div>

			<div className="home-notifications-copy">
				<span className="home-pill home-pill--notifications">{t("notificationsPreview.badge")}</span>

				<h2 className="home-notifications-title">{t("notificationsPreview.title")}</h2>

				<p className="home-notifications-lead">{t("notificationsPreview.lead")}</p>
			</div>
		</section>
	);
}