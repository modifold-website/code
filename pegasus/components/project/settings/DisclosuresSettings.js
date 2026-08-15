"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { toast } from "react-toastify";
import { LICENSES } from "@/components/Licenses";
import Checkbox from "@/components/ui/Checkbox";
import ToggleSwitch from "@/components/ui/ToggleSwitch";
import UnsavedChangesBar from "@/components/ui/UnsavedChangesBar";

const EMPTY_DISCLOSURES = {
	ai_generated: false,
	ai_code: false,
	ai_assets: false,
	ai_text: false,
	ai_functionality: false,
	ai_explanation: "",
	contains_paid_features: false,
	paid_features: [],
	contains_telemetry: false,
	telemetry_consent: null,
	telemetry_data: [],
	photosensitivity_warning: false,
	photosensitivity_explanation: "",
};

const EMPTY_ARCHIVE = {
	is_archived: false,
	explanation: "",
};

const getLicenseValue = (license) => license.key || license.spdx.toLowerCase();

const normalizeLicense = (project) => {
	const rawId = (project?.license?.id || project?.license_id || "arr").toString().toLowerCase();
	const matchedLicense = LICENSES.find((license) => {
		const candidates = [getLicenseValue(license), license.id, license.spdx].filter(Boolean).map((value) => value.toString().toLowerCase());
		return candidates.includes(rawId);
	});

	return {
		id: matchedLicense ? getLicenseValue(matchedLicense) : rawId,
		name: matchedLicense?.name || project?.license?.name || project?.license_name || null,
	};
};

const normalizeFormData = (project) => ({
	license: normalizeLicense(project),
	disclosures: {
		...EMPTY_DISCLOSURES,
		...(project?.disclosures || {}),
		paid_features: Array.isArray(project?.disclosures?.paid_features) ? project.disclosures.paid_features : [],
		telemetry_data: Array.isArray(project?.disclosures?.telemetry_data) ? project.disclosures.telemetry_data : [],
	},
	archive: {
		...EMPTY_ARCHIVE,
		...(project?.archive || {}),
	},
});

const cloneFormData = (value) => JSON.parse(JSON.stringify(value));

function TextArea({ value, onChange, placeholder, maxLength = 2000 }) {
	return (
		<div className="field field--default textarea blog-settings__input">
			<label className="field__wrapper">
				<textarea className="autosize textarea__input" rows="4" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} maxLength={maxLength} />
			</label>
		</div>
	);
}

function ListEditor({ values, onChange, placeholder, addLabel, removeLabel }) {
	const visibleValues = values.length > 0 ? values : [""];

	const updateValue = (index, value) => {
		const nextValues = [...visibleValues];
		nextValues[index] = value;
		onChange(nextValues);
	};

	const removeValue = (index) => {
		const nextValues = visibleValues.filter((_, itemIndex) => itemIndex !== index);
		onChange(nextValues.length > 0 ? nextValues : [""]);
	};

	return (
		<div className="disclosure-list-editor blog-settings__input">
			{visibleValues.map((value, index) => (
				<div className="disclosure-list-editor__row" key={index}>
					<div className="field field--default disclosure-list-editor__field">
						<label className="field__wrapper">
							<input className="text-input" value={value} onChange={(event) => updateValue(index, event.target.value)} placeholder={placeholder} maxLength="240" />
						</label>
					</div>

					<button type="button" className="button button--size-m button--type-minimal button--icon-only button--active-transform disclosure-list-editor__remove" aria-label={removeLabel} onClick={() => removeValue(index)}>
						<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
					</button>
				</div>
			))}

			<button type="button" className="button button--size-m button--type-minimal button--active-transform button--with-icon disclosure-list-editor__add" onClick={() => onChange([...visibleValues, ""])} disabled={visibleValues.length >= 12}>
				<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
				{addLabel}
			</button>
		</div>
	);
}

function DisclosureSection({ title, description, enabled, onToggle, children }) {
	return (
		<section className="content content--padding disclosures-section">
			<div className="disclosures-section__header">
				<div className="disclosures-section__intro">
					<h2 className="disclosures-section__title">{title}</h2>
					<div className="disclosures-section__description">{description}</div>
				</div>
				<ToggleSwitch checked={enabled} onChange={onToggle} label={title} />
			</div>

			{enabled && children ? <div className="disclosures-section__body">{children}</div> : null}
		</section>
	);
}

export default function DisclosuresSettings({ project, authToken }) {
	const t = useTranslations("ProjectDisclosures");
	const tSettings = useTranslations("SettingsProjectPage");
	const initialData = useMemo(() => normalizeFormData(project), [project]);
	const [formData, setFormData] = useState(() => cloneFormData(initialData));
	const [savedFormData, setSavedFormData] = useState(() => cloneFormData(initialData));
	const [isSaving, setIsSaving] = useState(false);
	const [isLicensePopoverOpen, setIsLicensePopoverOpen] = useState(false);
	const licenseFieldRef = useRef(null);
	const licenseTriggerRef = useRef(null);
	const isDirty = JSON.stringify(formData) !== JSON.stringify(savedFormData);
	const disclosures = formData.disclosures;
	const archive = formData.archive;
	const selectedLicense = LICENSES.find((license) => getLicenseValue(license) === formData.license.id);
	const archiveBannerDescription = archive.explanation.trim() || t("archive.bannerDescription", { title: project.title });

	useEffect(() => {
		if(!isLicensePopoverOpen) {
			return;
		}

		const handlePointerDown = (event) => {
			if(licenseFieldRef.current && !licenseFieldRef.current.contains(event.target)) {
				setIsLicensePopoverOpen(false);
			}
		};
		const handleKeyDown = (event) => {
			if(event.key === "Escape") {
				setIsLicensePopoverOpen(false);
				licenseTriggerRef.current?.focus();
			}
		};

		document.addEventListener("pointerdown", handlePointerDown);
		document.addEventListener("keydown", handleKeyDown);
		return () => {
			document.removeEventListener("pointerdown", handlePointerDown);
			document.removeEventListener("keydown", handleKeyDown);
		};
	}, [isLicensePopoverOpen]);

	const updateLicense = (licenseId) => {
		const license = LICENSES.find((item) => getLicenseValue(item) === licenseId) || LICENSES[0];
		setFormData((current) => ({ ...current, license: { id: getLicenseValue(license), name: license.name } }));
		setIsLicensePopoverOpen(false);
	};

	const updateDisclosure = (key, value) => {
		setFormData((current) => ({ ...current, disclosures: { ...current.disclosures, [key]: value } }));
	};

	const updateArchive = (key, value) => {
		setFormData((current) => ({ ...current, archive: { ...current.archive, [key]: value } }));
	};

	const validate = () => {
		if(disclosures.ai_generated && ![disclosures.ai_code, disclosures.ai_assets, disclosures.ai_text, disclosures.ai_functionality].some(Boolean)) {
			return t("errors.aiCategory");
		}

		if(disclosures.contains_paid_features && !disclosures.paid_features.some((item) => item.trim())) {
			return t("errors.paidFeature");
		}

		if(disclosures.contains_telemetry && (!disclosures.telemetry_consent || !disclosures.telemetry_data.some((item) => item.trim()))) {
			return t("errors.telemetry");
		}

		if(disclosures.photosensitivity_warning && !disclosures.photosensitivity_explanation.trim()) {
			return t("errors.photosensitivityExplanation");
		}

		return null;
	};

	const handleSave = async () => {
		if(isSaving || !isDirty) {
			return;
		}

		const validationError = validate();
		if(validationError) {
			toast.error(validationError);
			return;
		}

		setIsSaving(true);
		try {
			const payload = {
				license: formData.license,
				disclosures: {
					...disclosures,
					paid_features: disclosures.paid_features.map((item) => item.trim()).filter(Boolean),
					telemetry_data: disclosures.telemetry_data.map((item) => item.trim()).filter(Boolean),
				},
				archive,
			};
			const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE}/projects/${project.slug}/disclosures`, {
				method: "PUT",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${authToken}`,
				},
				body: JSON.stringify(payload),
			});

			if(!response.ok) {
				const data = await response.json().catch(() => ({}));
				throw new Error(data.message || t("errors.save"));
			}

			const data = await response.json();
			const nextData = normalizeFormData({ ...data, license: data.license || formData.license });
			setFormData(cloneFormData(nextData));
			setSavedFormData(cloneFormData(nextData));
			toast.success(t("success"));
		} catch (error) {
			toast.error(error.message || t("errors.save"));
		} finally {
			setIsSaving(false);
		}
	};

	const handleReset = () => {
		setFormData(cloneFormData(savedFormData));
		setIsLicensePopoverOpen(false);
	};

	return (
		<>
			<div className="disclosures-settings">
				<header className="disclosures-settings__heading">
					<h1>{t("title")}</h1>

					<p>{t("introBefore")} <Link href="/legal/rules#generative-ai">{t("contentRules")}</Link>.</p>
				</header>

				<div className="disclosures-settings__cards">
					<section className="content content--padding disclosures-section disclosures-section--license">
						<div className="disclosures-section__intro">
							<h2 className="disclosures-section__title">{t("license.title")}</h2>
							<div className="disclosures-section__description">{t("license.description")}</div>
						</div>

						<div className="disclosures-license">
							<div className="field field--default blog-settings__input" ref={licenseFieldRef}>
								<button ref={licenseTriggerRef} type="button" className="field__wrapper disclosures-license__trigger" aria-haspopup="listbox" aria-expanded={isLicensePopoverOpen} aria-controls="license-options" onClick={() => setIsLicensePopoverOpen((current) => !current)}>
									<span className="field__wrapper-body">
										<span className="select">
											<span className="select__selected">{selectedLicense?.name || t("license.noSelection")}</span>
										</span>
									</span>

									<svg className={`icon icon--chevron_down ${isLicensePopoverOpen ? "rotate" : ""}`} xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
										<path d="m6 9 6 6 6-6"/>
									</svg>
								</button>

								{isLicensePopoverOpen ? (
									<div className="popover disclosures-license__popover" id="license-options" role="listbox" aria-label={t("license.title")}>
										<div className="context-list" data-scrollable>
											{LICENSES.map((license) => {
												const licenseValue = getLicenseValue(license);
												const isSelected = formData.license.id === licenseValue;

												return (
													<button key={license.id} type="button" role="option" aria-selected={isSelected} className={`context-list-option disclosures-license__option ${isSelected ? "context-list-option--selected" : ""}`} onClick={() => updateLicense(licenseValue)}>
														<span className="context-list-option__label">{license.name}</span>
													</button>
												);
											})}
										</div>
									</div>
								) : null}
							</div>

							<button type="button" className="button button--size-l button--type-minimal button--active-transform" onClick={() => updateLicense("arr")} disabled={formData.license.id === "arr"}>
								{t("license.clear")}
							</button>
						</div>
					</section>

					<DisclosureSection title={t("ai.title")} description={<>{t("ai.description")} <strong>{t("ai.descriptionRequirement")}</strong></>} enabled={disclosures.ai_generated} onToggle={(value) => updateDisclosure("ai_generated", value)}>
						<div className="disclosure-field-group">
							<h3 className="blog-settings__field-title">{t("ai.usesTitle")}</h3>
							
							<div className="disclosure-choice-grid">
								{["code", "assets", "text", "functionality"].map((type) => <Checkbox key={type} checked={disclosures[`ai_${type}`]} onChange={(value) => updateDisclosure(`ai_${type}`, value)}>{t(`ai.types.${type}`)}</Checkbox>)}
							</div>
						</div>

						<div className="disclosure-field-group">
							<h3 className="blog-settings__field-title">{t("explanationOptional")}</h3>
							
							<TextArea value={disclosures.ai_explanation} onChange={(value) => updateDisclosure("ai_explanation", value)} placeholder={t("ai.placeholder")} />
						</div>
					</DisclosureSection>

					<DisclosureSection title={t("paid.title")} description={t("paid.description")} enabled={disclosures.contains_paid_features} onToggle={(value) => updateDisclosure("contains_paid_features", value)}>
						<div className="disclosure-field-group">
							<h3 className="blog-settings__field-title">{t("paid.listTitle")}</h3>
							
							<ListEditor values={disclosures.paid_features} onChange={(value) => updateDisclosure("paid_features", value)} placeholder={t("paid.placeholder")} addLabel={t("addAnother")} removeLabel={t("removeItem")} />
						</div>
					</DisclosureSection>

					<DisclosureSection title={t("telemetry.title")} description={t("telemetry.description")} enabled={disclosures.contains_telemetry} onToggle={(value) => updateDisclosure("contains_telemetry", value)}>
						<div className="disclosure-field-group">
							<h3 className="blog-settings__field-title">{t("telemetry.consentTitle")}</h3>
							
							<div className="disclosure-button-group" role="radiogroup" aria-label={t("telemetry.consentTitle")}>{["opt_in", "opt_out", "always_active"].map((value) => <button key={value} type="button" role="radio" aria-checked={disclosures.telemetry_consent === value} className={`button button--size-m button--active-transform ${disclosures.telemetry_consent === value ? "button--type-primary" : "button--type-minimal"}`} onClick={() => updateDisclosure("telemetry_consent", value)}>{t(`telemetry.consent.${value}`)}</button>)}</div>
						</div>

						<div className="disclosure-field-group">
							<h3 className="blog-settings__field-title">{t("telemetry.dataTitle")}</h3>
							
							<p>{t("telemetry.dataDescription")}</p>
							
							<ListEditor values={disclosures.telemetry_data} onChange={(value) => updateDisclosure("telemetry_data", value)} placeholder={t("telemetry.placeholder")} addLabel={t("addAnother")} removeLabel={t("removeItem")} />
						</div>
					</DisclosureSection>

					<DisclosureSection title={t("photosensitivity.title")} description={t("photosensitivity.description")} enabled={disclosures.photosensitivity_warning} onToggle={(value) => updateDisclosure("photosensitivity_warning", value)}>
						<div className="disclosure-field-group">
							<h3 className="blog-settings__field-title">{t("explanation")}</h3>
							
							<TextArea value={disclosures.photosensitivity_explanation} onChange={(value) => updateDisclosure("photosensitivity_explanation", value)} placeholder={t("photosensitivity.placeholder")} />
						</div>
					</DisclosureSection>

					<DisclosureSection title={t("archive.title")} description={<>{t("archive.description")} <strong>{t("archive.hidden")}</strong></>} enabled={archive.is_archived} onToggle={(value) => updateArchive("is_archived", value)}>
						<div className="disclosure-field-group">
							<h3 className="blog-settings__field-title">{t("explanationOptional")}</h3>
							
							<TextArea value={archive.explanation} onChange={(value) => updateArchive("explanation", value)} placeholder={t("archive.placeholder")} />
						</div>
						
						<div className="disclosure-field-group">
							<h3 className="blog-settings__field-title">{t("archive.previewTitle")}</h3>
							
								<div className="archive-banner archive-banner--preview">
									<div>
										<strong>{t("archive.bannerTitle", { title: project.title })}</strong>
										
										<p>{archiveBannerDescription}</p>
									</div>
								</div>
						</div>
					</DisclosureSection>
				</div>
			</div>

			<UnsavedChangesBar isDirty={isDirty} isSaving={isSaving} onSave={handleSave} onReset={handleReset} message={tSettings("unsavedBar.message")} resetLabel={tSettings("unsavedBar.reset")} saveLabel={tSettings("save")} />
		</>
	);
}