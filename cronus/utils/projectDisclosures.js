const EMPTY_DISCLOSURES = Object.freeze({
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
});

const EMPTY_ARCHIVE = Object.freeze({
	is_archived: false,
	explanation: "",
});

const parseJsonArray = (value) => {
	if(Array.isArray(value)) {
		return value;
	}

	if(typeof value !== "string" || !value) {
		return [];
	}

	try {
		const parsed = JSON.parse(value);
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
};

const formatProjectDisclosures = (row) => {
	if(!row) {
		return { ...EMPTY_DISCLOSURES };
	}

	return {
		ai_generated: Boolean(row.ai_generated),
		ai_code: Boolean(row.ai_code),
		ai_assets: Boolean(row.ai_assets),
		ai_text: Boolean(row.ai_text),
		ai_functionality: Boolean(row.ai_functionality),
		ai_explanation: row.ai_explanation || "",
		contains_paid_features: Boolean(row.contains_paid_features),
		paid_features: parseJsonArray(row.paid_features),
		contains_telemetry: Boolean(row.contains_telemetry),
		telemetry_consent: row.telemetry_consent || null,
		telemetry_data: parseJsonArray(row.telemetry_data),
		photosensitivity_warning: Boolean(row.photosensitivity_warning),
		photosensitivity_explanation: row.photosensitivity_explanation || "",
	};
};

const formatProjectArchive = (row) => {
	if(!row) {
		return { ...EMPTY_ARCHIVE };
	}

	return {
		is_archived: Boolean(row.is_archived),
		explanation: row.archive_explanation || "",
	};
};

const getProjectDisclosureState = async (connection, projectId) => {
	const [[disclosureRows], [archiveRows]] = await Promise.all([
		connection.query(
			`SELECT *
			FROM project_disclosures
			WHERE project_id = ?
			LIMIT 1`,
			[projectId]
		),
		connection.query(
			`SELECT is_archived, archive_explanation
			FROM projects
			WHERE id = ?
			LIMIT 1`,
			[projectId]
		),
	]);

	return {
		disclosures: formatProjectDisclosures(disclosureRows[0]),
		archive: formatProjectArchive(archiveRows[0]),
	};
};

module.exports = {
	EMPTY_ARCHIVE,
	EMPTY_DISCLOSURES,
	formatProjectArchive,
	formatProjectDisclosures,
	getProjectDisclosureState,
};