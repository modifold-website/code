import { displayDate, displayNumber } from "@/utils/moderation/projectAnalytics";

export default function ProjectAnalyticsVersions({ report, locale, t }) {
	return (
		<section className="content content--padding">
			<h3>{t("versions")}</h3>

			{!report.versions.length ? (
				<p>{t("empty")}</p>
			) : (
				<div className="moderation-project-analytics__list" role="region" aria-label={t("versions")} tabIndex={0}>
					<table className="moderation-project-analytics__versions">
						<thead>
							<tr>
								<th scope="col">{t("version")}</th>
								<th scope="col">{t("uploaded")}</th>
								<th scope="col">{t("downloads")}</th>
							</tr>
						</thead>

						<tbody>
							{report.versions.map((version) => (
								<tr key={version.id}>
									<td>{version.version_number}</td>
									<td>{displayDate(version.uploaded_at, locale)}</td>
									<td>{displayNumber(version.downloads, locale)}</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}
		</section>
	);
}