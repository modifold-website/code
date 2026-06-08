const isArgusEnabled = () => !["0", "false", "no", "off"].includes(String(process.env.ARGUS_ENABLED || "true").trim().toLowerCase());

const notifyArgusAboutVersion = async ({ versionId, projectId, projectSlug, fileUrl, fileName, fileSize }) => {
	if(!isArgusEnabled()) {
		return {
			queued: false,
			mockClean: true,
			result: {
				verdict: "approved",
				reason: "CLEAN",
				report: {
					scanner: "argus",
					mock: true,
					severity: "low",
					score: 0,
					findings: [{
						severity: "low",
						type: "mock_clean",
						message: "CLEAN",
					}],
					file_name: String(fileName || ""),
					file_url: fileUrl || null,
				},
			},
		};
	}

	const argusBaseUrl = String(process.env.ARGUS_BASE_URL || "").replace(/\/+$/, "");
	const sharedSecret = process.env.ARGUS_SHARED_SECRET;

	if(!argusBaseUrl || !sharedSecret) {
		return { queued: false, reason: "not_configured" };
	}

	const response = await fetch(`${argusBaseUrl}/scan`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"Authorization": `Bearer ${sharedSecret}`,
		},
		body: JSON.stringify({
			version_id: versionId,
			project_id: projectId,
			project_slug: projectSlug,
			file_url: fileUrl,
			file_name: fileName,
			file_size: fileSize,
			callback_url: `https://api.modifold.com/moderation/argus/versions/${versionId}/report`,
		}),
	});

	if(!response.ok) {
		const body = await response.text().catch(() => "");
		throw new Error(`Argus scan request failed: ${response.status} ${body}`.trim());
	}

	return { queued: true };
};

module.exports = {
	notifyArgusAboutVersion,
};