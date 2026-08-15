"use client";

import { useLocale, useTranslations } from "next-intl";
import DisclosureIcon from "@/utils/DisclosureIcon";

const CONSENT_KEYS = {
	opt_in: "optIn",
	opt_out: "optOut",
	always_active: "alwaysActive",
};

export default function ProjectDisclosureDetails({ disclosures }) {
	const t = useTranslations("ProjectDisclosures.public");
	const locale = useLocale();
	const items = [];
	const listFormatter = new Intl.ListFormat(locale, { style: "long", type: "conjunction" });

	if(disclosures?.ai_generated) {
		const aiTypes = ["code", "assets", "text", "functionality"].filter((type) => disclosures[`ai_${type}`]).map((type) => t(`aiTypes.${type}`));
		items.push({ icon: "ai", title: t("ai", { types: listFormatter.format(aiTypes) }), detail: disclosures.ai_explanation });
	}

	if(disclosures?.contains_paid_features) {
		items.push({ icon: "paid", title: t("paid"), detail: listFormatter.format(disclosures.paid_features || []) });
	}

	if(disclosures?.contains_telemetry) {
		const consentKey = CONSENT_KEYS[disclosures.telemetry_consent] || "alwaysActive";
		items.push({ icon: "telemetry", title: t("telemetry", { consent: t(`consent.${consentKey}`) }), detail: listFormatter.format(disclosures.telemetry_data || []) });
	}

	if(disclosures?.photosensitivity_warning) {
		items.push({ icon: "photosensitivity", title: t("photosensitivity"), detail: disclosures.photosensitivity_explanation });
	}

	if(items.length === 0) {
		return null;
	}

	return (
		<div className="content content--padding">
			<h2>{t("title")}</h2>
			
			<div className="project-disclosures-list">
				{items.map((item) => (
					<div className="project-disclosure-item" key={item.icon}>
						<DisclosureIcon type={item.icon} />

						<div className="project-disclosure-item__content">
							<div className="project-disclosure-item__title">{item.title}</div>
							
							{item.detail && <div className="project-disclosure-item__detail">{item.detail}</div>}
						</div>
					</div>
				))}
			</div>
		</div>
	);
}