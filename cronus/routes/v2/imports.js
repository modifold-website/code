const express = require("express");

const { logger } = require("../../packages/shared/logger");
const { db } = require("../../config/db");
const auth = require("../../middleware/auth");
const { findProfileProjects, findProjectByUrl, getModDescription } = require("../../utils/curseForge");
const { MAX_PROJECTS_PER_IMPORT, buildVerificationCode, createImportSession, getImportForUser, hashVerificationCode, retryImportItem, startImport } = require("../../utils/curseForgeImport");

const router = express.Router();
const skipOwnershipVerification = process.env.CURSEFORGE_IMPORT_SKIP_OWNERSHIP_VERIFICATION === "true";

if(skipOwnershipVerification) {
	logger.warn("CurseForge import ownership verification is disabled by test configuration");
}

const handleError = (res, error, fallbackMessage) => {
	if(!error.statusCode || error.statusCode >= 500) {
		logger.error(fallbackMessage, error);
	}

	return res.status(error.statusCode || 500).json({ message: error.statusCode ? error.message : fallbackMessage });
};

const serializeImport = (session, { includeCandidates = true } = {}) => ({
	id: session.id,
	method: session.method,
	status: session.status,
	profileUrl: session.profile_url,
	totalItems: Number(session.total_items || 0),
	completedItems: Number(session.completed_items || 0),
	failedItems: Number(session.failed_items || 0),
	currentStage: session.current_stage,
	errorMessage: session.error_message,
	expiresInSeconds: session.verification_expires_at
		? Math.max(0, Math.ceil((new Date(session.verification_expires_at).getTime() - Date.now()) / 1000))
		: null,
	items: includeCandidates ? session.items.map((item) => ({
		id: item.id,
		curseforgeProjectId: Number(item.curseforge_project_id),
		name: item.source_data.name,
		summary: item.source_data.summary,
		iconUrl: item.source_data.iconUrl,
		sourceUrl: item.source_url,
		projectType: item.source_data.projectType || "mod",
		alreadyImported: Boolean(item.source_data.alreadyImported),
		nameConflict: Boolean(item.source_data.nameConflict),
		selected: item.selected,
		status: item.status,
		stage: item.stage,
		progress: Number(item.progress || 0),
		projectSlug: item.modifold_project_slug,
		warningMessage: item.warning_message,
		errorMessage: item.error_message,
	})) : [],
});

router.post("/curseforge/profile", auth, async (req, res) => {
	try {
		const { profile_url: profileUrl } = req.body || {};
		const result = await findProfileProjects(profileUrl);
		if(!result.projects.length) {
			return res.status(404).json({ message: "No Hytale projects were found for this profile" });
		}

		const candidates = result.projects;
		const verificationProject = candidates[0];
		const verificationCode = buildVerificationCode();
		const importId = await createImportSession({
			userId: req.user.id,
			method: "profile",
			profileUrl: result.profile.url,
			candidates,
			verificationCode,
			verificationProjectId: verificationProject.id,
		});
		const session = await getImportForUser(importId, req.user.id);

		return res.status(201).json({
			...serializeImport(session, { includeCandidates: false }),
			verificationCode,
			verificationProject: {
				id: verificationProject.id,
				name: verificationProject.name,
				url: verificationProject.websiteUrl,
			},
		});
	} catch(error) {
		return handleError(res, error, "Unable to prepare CurseForge profile import");
	}
});

router.post("/curseforge/:importId/verify", auth, async (req, res) => {
	try {
		const session = await getImportForUser(req.params.importId, req.user.id);
		if(session.status !== "awaiting_verification") {
			return res.status(409).json({ message: "This import is not awaiting verification" });
		}

		if(!session.verification_expires_at || new Date(session.verification_expires_at).getTime() <= Date.now()) {
			return res.status(410).json({ message: "Verification code expired. Start a new import." });
		}

		const submittedCode = String(req.body?.code || "").trim().toUpperCase();
		if(!submittedCode || hashVerificationCode(submittedCode) !== session.verification_code_hash) {
			return res.status(400).json({ message: "Invalid verification code" });
		}
		
		const unverifiedProjects = [];
		if(!skipOwnershipVerification) {
			const verificationProjectIds = session.method === "profile" ? [Number(session.verification_project_id)] : session.items.map((item) => Number(item.curseforge_project_id));
			for(const projectId of verificationProjectIds) {
				const description = String(await getModDescription(projectId));
				if(!description.toUpperCase().includes(submittedCode)) {
					const item = session.items.find((candidate) => Number(candidate.curseforge_project_id) === projectId);
					unverifiedProjects.push(item?.source_data?.name || String(projectId));
				}
			}
		}

		if(unverifiedProjects.length) {
			return res.status(409).json({
				message: "The temporary code was not found in every CurseForge project description yet",
				unverifiedProjects,
			});
		}

		await db.query(
			"UPDATE project_imports SET status = 'ready', verification_code_hash = NULL, verification_expires_at = NULL, current_stage = 'selecting' WHERE id = ?",
			[session.id]
		);

		const verified = await getImportForUser(session.id, req.user.id);
		return res.json(serializeImport(verified));
	} catch(error) {
		return handleError(res, error, "Unable to verify CurseForge project ownership");
	}
});

router.post("/curseforge/projects", auth, async (req, res) => {
	try {
		const projectUrls = Array.isArray(req.body?.project_urls) ? req.body.project_urls.map((value) => String(value || "").trim()).filter(Boolean) : [];
		const uniqueUrls = [...new Set(projectUrls)];
		if(!uniqueUrls.length || uniqueUrls.length > MAX_PROJECTS_PER_IMPORT) {
			return res.status(400).json({ message: `Provide between 1 and ${MAX_PROJECTS_PER_IMPORT} project URLs` });
		}

		const candidates = [];
		const rejected = [];
		for(const projectUrl of uniqueUrls) {
			try {
				const candidate = await findProjectByUrl(projectUrl);
				if(!candidates.some((item) => item.id === candidate.id)) {
					candidates.push(candidate);
				}
			} catch(error) {
				rejected.push({ url: projectUrl, message: error.message });
			}
		}

		if(!candidates.length) {
			return res.status(400).json({ message: "None of the provided Hytale CurseForge project URLs could be resolved", rejected });
		}

		const verificationCode = buildVerificationCode();
		const importId = await createImportSession({ userId: req.user.id, method: "links", candidates, verificationCode });
		const session = await getImportForUser(importId, req.user.id);
		return res.status(201).json({ ...serializeImport(session), verificationCode, rejected });
	} catch(error) {
		return handleError(res, error, "Unable to prepare CurseForge project import");
	}
});

router.post("/curseforge/:importId/start", auth, async (req, res) => {
	try {
		await startImport({
			importId: req.params.importId,
			userId: req.user.id,
			selectedProjectIds: req.body?.project_ids,
		});

		const session = await getImportForUser(req.params.importId, req.user.id);
		return res.status(202).json(serializeImport(session));
	} catch(error) {
		return handleError(res, error, "Unable to start CurseForge import");
	}
});

router.post("/curseforge/:importId/items/:itemId/retry", auth, async (req, res) => {
	try {
		await retryImportItem({
			importId: req.params.importId,
			itemId: req.params.itemId,
			userId: req.user.id,
		});

		const session = await getImportForUser(req.params.importId, req.user.id);
		return res.status(202).json(serializeImport(session));
	} catch(error) {
		return handleError(res, error, "Unable to retry CurseForge project import");
	}
});

router.get("/curseforge/:importId", auth, async (req, res) => {
	try {
		const session = await getImportForUser(req.params.importId, req.user.id);
		return res.json(serializeImport(session));
	} catch(error) {
		return handleError(res, error, "Unable to load CurseForge import");
	}
});

module.exports = router;