import { useTranslations } from "next-intl";
import { getGameVersionLabel, normalizeGameVersionBranches } from "@/utils/gameVersions";

export default function VersionDisplay({ gameVersions, allGameVersions = [] }) {
	const t = useTranslations("ProjectPage.versions");
	const versions = normalizeGameVersionBranches(Array.isArray(gameVersions) ? gameVersions : []);

	return versions.length > 0 ? (
		<>
			{versions.map((version) => (
				<span key={version} className="version__game-versions">
					{getGameVersionLabel(version, allGameVersions)}
				</span>
			))}
		</>
	) : (
		<span className="version__game-versions">{t("notSpecified")}</span>
	);
}