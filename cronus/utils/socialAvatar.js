const crypto = require("crypto");
const sharp = require("sharp");
const { getPublicUrl, uploadBuffer } = require("./fileHosting");

const importSocialAvatar = async ({ userId, provider, sourceUrl }) => {
	if(!sourceUrl) {
		return null;
	}

	const response = await fetch(sourceUrl, {
		headers: {
			Accept: "image/*",
			"User-Agent": "ModifoldSocialAvatarImporter/1.0",
		},
		signal: AbortSignal.timeout(10_000),
	});

	if(!response.ok) {
		throw new Error("Social avatar request failed with status " + response.status);
	}

	const avatarBuffer = await sharp(Buffer.from(await response.arrayBuffer()))
		.rotate()
		.resize({ width: 512, height: 512, fit: "inside", withoutEnlargement: true })
		.webp({ quality: 82, effort: 4 })
		.toBuffer();
	const objectKey = "users/" + userId + "/avatar/" + provider + "-" + crypto.randomBytes(6).toString("hex") + ".webp";

	await uploadBuffer({
		key: objectKey,
		body: avatarBuffer,
		contentType: "image/webp",
	});

	return getPublicUrl(objectKey);
};

module.exports = {
	importSocialAvatar,
};