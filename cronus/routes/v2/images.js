const crypto = require("crypto");
const express = require("express");
const sharp = require("sharp");

const { db } = require("../../config/db");
const auth = require("../../middleware/auth");
const { getPublicUrl, uploadBuffer } = require("../../utils/fileHosting");
const { ORG_PROJECT_PERMISSIONS, hasProjectPermission, resolveProjectAccess } = require("../../utils/organizations");

const router = express.Router();

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_IMAGE_PIXELS = 40_000_000;
const IMAGE_FORMATS = {
	gif: { extension: "gif", mimeType: "image/gif" },
	jpeg: { extension: "jpg", mimeType: "image/jpeg" },
	jpg: { extension: "jpg", mimeType: "image/jpeg" },
	png: { extension: "png", mimeType: "image/png" },
	webp: { extension: "webp", mimeType: "image/webp" },
};

const rawImageBody = express.raw({
	type: ["application/octet-stream", "image/gif", "image/jpeg", "image/png", "image/webp"],
	limit: MAX_IMAGE_BYTES,
});

const getProject = async (identifier) => {
	const [projects] = await db.query(
		"SELECT id, slug, user_id FROM projects WHERE BINARY id = BINARY ? OR slug = ? LIMIT 1",
		[identifier, identifier]
	);

	return projects[0] || null;
};

const optimizeImage = async (buffer, format) => {
	const image = sharp(buffer, {
		animated: format === "gif",
		limitInputPixels: MAX_IMAGE_PIXELS,
		sequentialRead: true,
	}).rotate();

	if(format === "jpeg") {
		return image.jpeg({ quality: 85, mozjpeg: true }).toBuffer();
	}

	if(format === "png") {
		return image.png({ compressionLevel: 9 }).toBuffer();
	}

	if(format === "webp") {
		return image.webp({ quality: 85, effort: 4 }).toBuffer();
	}

	return image.gif({ effort: 4 }).toBuffer();
};

router.post("/", auth, rawImageBody, async (req, res) => {
	try {
		const context = String(req.query?.context || "").trim().toLowerCase();
		const projectIdentifier = String(req.query?.project_id || "").trim();
		const requestedExtension = String(req.query?.ext || "").trim().replace(/^\./, "").toLowerCase();
		const requestedFormat = IMAGE_FORMATS[requestedExtension];

		if(context !== "project") {
			return res.status(400).json({ message: "Context must be project" });
		}

		if(!projectIdentifier) {
			return res.status(400).json({ message: "project_id is required" });
		}

		if(!requestedFormat) {
			return res.status(400).json({ message: "Unsupported image extension" });
		}

		if(!Buffer.isBuffer(req.body) || req.body.length === 0) {
			return res.status(400).json({ message: "Image body is required" });
		}

		const project = await getProject(projectIdentifier);
		if(!project) {
			return res.status(404).json({ message: "Project not found" });
		}

		const access = await resolveProjectAccess(db, project.id, req.user.id);
		if(!hasProjectPermission(access, ORG_PROJECT_PERMISSIONS.EDIT_BODY)) {
			return res.status(403).json({ message: "You do not have permission to edit this project description" });
		}

		let metadata;
		try {
			metadata = await sharp(req.body, { animated: true, limitInputPixels: MAX_IMAGE_PIXELS }).metadata();
		} catch {
			return res.status(415).json({ message: "Invalid image file" });
		}

		const detectedFormat = metadata.format === "jpg" ? "jpeg" : metadata.format;
		const expectedFormat = requestedExtension === "jpg" ? "jpeg" : requestedExtension;
		if(!IMAGE_FORMATS[detectedFormat] || detectedFormat !== expectedFormat) {
			return res.status(415).json({ message: "Image content does not match its extension" });
		}

		const optimizedImage = await optimizeImage(req.body, detectedFormat);
		const hash = crypto.createHash("sha1").update(optimizedImage).digest("hex");
		const fileName = `${hash}.${requestedFormat.extension}`;
		const objectKey = `projects/${project.id}/cached_images/${fileName}`;
		await uploadBuffer({
			key: objectKey,
			body: optimizedImage,
			contentType: requestedFormat.mimeType,
		});
		const url = getPublicUrl(objectKey);

		return res.status(200).json({
			id: hash,
			url,
			raw_url: url,
			size: optimizedImage.length,
			mime_type: requestedFormat.mimeType,
			context,
			project_id: project.id,
		});
	} catch(error) {
		if(error?.name === "InputImageError" || /pixel limit|unsupported image format/i.test(String(error?.message || ""))) {
			return res.status(415).json({ message: "Invalid or unsupported image file" });
		}

		console.error("Error uploading project description image:", error);
		return res.status(500).json({ message: "Error uploading image" });
	}
});

router.use((error, req, res, next) => {
	if(error?.type === "entity.too.large") {
		return res.status(413).json({ message: "Image must be 10 MB or smaller" });
	}

	return next(error);
});

module.exports = router;