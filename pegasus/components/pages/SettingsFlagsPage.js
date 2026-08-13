"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import ToggleSwitch from "@/components/ui/ToggleSwitch";
import { getCookieValue, parseFeatureFlagsCookieValue } from "@/utils/featureFlags";

const getFlagsFromDocumentCookie = () => {
	const rawCookieValue = getCookieValue(document.cookie, "featureFlags");
	return parseFeatureFlagsCookieValue(rawCookieValue);
};

const saveFlagsToCookie = (flags) => {
	document.cookie = `featureFlags=${encodeURIComponent(JSON.stringify(flags))}; path=/; max-age=31536000; samesite=lax`;
};

const AVAILABLE_FLAGS = [
	{ key: "developerMode", title: "DeveloperMode" },
	{ key: "frostedMenus", title: "FrostedMenus" },
];

export default function SettingsFlagsPage() {
	const t = useTranslations("SettingsBlogPage.flags");
	const [flagsState, setFlagsState] = useState({
		developerMode: false,
		frostedMenus: false,
	});

	useEffect(() => {
		const flags = getFlagsFromDocumentCookie();
		setFlagsState({
			developerMode: flags.developerMode === true,
			frostedMenus: flags.frostedMenus === true,
		});
	}, []);

	const handleToggleFlag = (flagKey) => {
		const nextFlagValue = !flagsState[flagKey];
		const currentFlags = getFlagsFromDocumentCookie();
		const nextFlags = {
			...currentFlags,
			[flagKey]: nextFlagValue,
		};

		setFlagsState((prev) => ({
			...prev,
			[flagKey]: nextFlagValue,
		}));
		saveFlagsToCookie(nextFlags);

		if(flagKey === "frostedMenus" && document?.body) {
			document.body.dataset.featureFlagFrostedMenus = nextFlagValue ? "true" : "false";
		}
	};

	return (
		<div className="settings-wrapper--narrow">
			<div className="settings-feature-flag-list">
				{AVAILABLE_FLAGS.map((flag) => (
					<div key={flag.key} className="settings-feature-flag-card">
						<div className="settings-feature-flag-card__content">
							<div className="settings-feature-flag-card__title">{flag.title}</div>
							
							<div className="settings-feature-flag-card__default">
								{t("defaultLabel")} <span>{t("defaultValue")}</span>
							</div>
						</div>

						<ToggleSwitch id={`toggle-${flag.key}`} checked={flagsState[flag.key]} onChange={() => handleToggleFlag(flag.key)} label={`${t("ariaLabelToggle")} ${flag.title}`} />
					</div>
				))}
			</div>
		</div>
	);
}