const crypto = require("crypto");
const fs = require("fs");
const fsp = require("fs/promises");
const os = require("os");
const path = require("path");
const { pipeline } = require("stream/promises");
const { DeleteObjectCommand, DeleteObjectsCommand, GetObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client } = require("@aws-sdk/client-s3");
const { Upload } = require("@aws-sdk/lib-storage");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

const DEFAULT_PUBLIC_BASE = "https://cdn.modifold.com";
const IMMUTABLE_CACHE_CONTROL = "public, max-age=31536000, immutable";
const bucketCache = new Map();
const localObjectPromises = new Map();

const parseBoolean = (value) => ["1", "true", "yes", "on"].includes(String(value || "").trim().toLowerCase());

const isUnsetStorageValue = (value) => {
	const normalized = String(value || "").trim().toLowerCase();
	return !normalized || normalized === "none";
};

const buildSafeObjectFilename = (value) => {
	const parsed = path.parse(path.basename(String(value || "file")));
	const stem = parsed.name.replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/^[_\-.]+|[_\-.]+$/g, "") || "file";
	const extension = parsed.ext.replace(/^\./, "").replace(/[^a-zA-Z0-9]+/g, "").toLowerCase();
	const suffix = crypto.randomBytes(6).toString("hex");
	return extension ? `${stem}_${suffix}.${extension}` : `${stem}_${suffix}`;
};

const validateStorageConfiguration = () => {
	getBucket("public");
};

const validatePrivateStorageConfiguration = () => {
	getBucket("private");
};

const normalizeObjectKey = (value) => {
	const normalized = path.posix.normalize(String(value || "").replace(/\\/g, "/").replace(/^\/+/, ""));
	if(!normalized || normalized === "." || normalized === ".." || normalized.startsWith("../") || normalized.includes("\0")) {
		throw new Error("Invalid storage object key");
	}

	return normalized;
};

const normalizeStorageScope = (value) => {
	const scope = String(value || "public").trim().toLowerCase();
	if(scope !== "public" && scope !== "private") {
		throw new Error("Invalid storage scope");
	}

	return scope;
};

const getBucketConfig = (publicity = "public") => {
	const normalizedScope = normalizeStorageScope(publicity);
	const scope = normalizedScope.toUpperCase();
	const bucketName = String(process.env[`S3_${scope}_BUCKET_NAME`] || "").trim();
	const configuredUrl = String(process.env[`S3_${scope}_URL`] || "").trim();
	const accessKeyId = String(process.env[`S3_${scope}_ACCESS_TOKEN`] || "").trim();
	const secretAccessKey = String(process.env[`S3_${scope}_SECRET`] || "").trim();

	if([bucketName, configuredUrl, accessKeyId, secretAccessKey].some(isUnsetStorageValue)) {
		throw new Error(`S3 ${normalizedScope} storage is not fully configured`);
	}

	const endpoint = /^https?:\/\//i.test(configuredUrl) ? configuredUrl.replace(/\/+$/, "") : `https://${configuredUrl}.r2.cloudflarestorage.com`;

	return {
		bucketName,
		clientConfig: {
			region: "auto",
			endpoint,
			forcePathStyle: parseBoolean(process.env[`S3_${scope}_USES_PATH_STYLE_BUCKET`]),
			credentials: {
				accessKeyId,
				secretAccessKey,
			},
		},
	};
};

const getBucket = (publicity = "public") => {
	const scope = normalizeStorageScope(publicity);
	if(bucketCache.has(scope)) {
		return bucketCache.get(scope);
	}

	const config = getBucketConfig(scope);
	const bucket = {
		name: config.bucketName,
		client: new S3Client(config.clientConfig),
	};
	
	bucketCache.set(scope, bucket);
	return bucket;
};

const getPublicBase = () => DEFAULT_PUBLIC_BASE;

const getRuntimeTempRoot = () => fs.existsSync("/app/tmp") ? "/app/tmp" : path.join(os.tmpdir(), "modifold");

const getUploadTempRoot = () => path.join(getRuntimeTempRoot(), "uploads");

const getPublicUrl = (key) => `${getPublicBase()}/${normalizeObjectKey(key).split("/").map(encodeURIComponent).join("/")}`;

const ensureParentDirectory = async (filePath) => {
	await fsp.mkdir(path.dirname(filePath), { recursive: true });
};

const safelyRemoveFile = async (filePath) => {
	if(!filePath) {
		return;
	}

	try {
		await fsp.unlink(filePath);
	} catch(error) {
		if(error.code !== "ENOENT") {
			throw error;
		}
	}
};

const uploadBuffer = async ({ key, body, contentType, cacheControl = IMMUTABLE_CACHE_CONTROL, publicity = "public" }) => {
	const objectKey = normalizeObjectKey(key);
	const bucket = getBucket(publicity);
	await bucket.client.send(new PutObjectCommand({
		Bucket: bucket.name,
		Key: objectKey,
		Body: body,
		ContentType: contentType || "application/octet-stream",
		CacheControl: publicity === "public" ? cacheControl : undefined,
	}));
};

const uploadFile = async ({ key, filePath, contentType, cacheControl = IMMUTABLE_CACHE_CONTROL, publicity = "public", removeSource = true }) => {
	const objectKey = normalizeObjectKey(key);
	const bucket = getBucket(publicity);
	const fileStat = await fsp.stat(filePath);
	const partSize = 16 * 1024 * 1024;
	const upload = new Upload({
		client: bucket.client,
		params: {
			Bucket: bucket.name,
			Key: objectKey,
			Body: fs.createReadStream(filePath),
			ContentLength: fileStat.size,
			ContentType: contentType || "application/octet-stream",
			CacheControl: publicity === "public" ? cacheControl : undefined,
		},
		queueSize: 4,
		partSize,
		leavePartsOnError: false,
	});

	await upload.done();
	if(removeSource) {
		await safelyRemoveFile(filePath);
	}
};

const deleteObject = async (key, publicity = "public") => {
	const objectKey = normalizeObjectKey(key);
	const bucket = getBucket(publicity);
	await bucket.client.send(new DeleteObjectCommand({ Bucket: bucket.name, Key: objectKey }));
};

const getPrivateObjectDownloadUrl = async (key, { expiresInSeconds = 6 * 60 * 60 } = {}) => {
	const objectKey = normalizeObjectKey(key);
	const bucket = getBucket("private");
	const expiresIn = Math.min(7 * 24 * 60 * 60, Math.max(60, Number(expiresInSeconds) || 6 * 60 * 60));

	return getSignedUrl(
		bucket.client,
		new GetObjectCommand({ Bucket: bucket.name, Key: objectKey }),
		{ expiresIn }
	);
};

const transferObject = async ({ sourceKey, sourcePublicity, destinationKey, destinationPublicity }) => {
	const normalizedSourceKey = normalizeObjectKey(sourceKey);
	const normalizedDestinationKey = normalizeObjectKey(destinationKey);
	const sourceBucket = getBucket(sourcePublicity);
	const destinationBucket = getBucket(destinationPublicity);
	const source = await sourceBucket.client.send(new GetObjectCommand({
		Bucket: sourceBucket.name,
		Key: normalizedSourceKey,
	}));
	const upload = new Upload({
		client: destinationBucket.client,
		params: {
			Bucket: destinationBucket.name,
			Key: normalizedDestinationKey,
			Body: source.Body,
			ContentLength: source.ContentLength,
			ContentType: source.ContentType || "application/octet-stream",
			CacheControl: destinationPublicity === "public" ? IMMUTABLE_CACHE_CONTROL : undefined,
		},
		queueSize: 4,
		partSize: 16 * 1024 * 1024,
		leavePartsOnError: false,
	});

	await upload.done();
	return normalizedDestinationKey;
};

const promotePrivateObject = async ({ key, destinationKey }) => {
	const publicKey = await transferObject({
		sourceKey: key,
		sourcePublicity: "private",
		destinationKey,
		destinationPublicity: "public",
	});

	return {
		key: publicKey,
		url: getPublicUrl(publicKey),
	};
};

const quarantinePublicObject = async ({ key, destinationKey }) => {
	return transferObject({
		sourceKey: key,
		sourcePublicity: "public",
		destinationKey,
		destinationPublicity: "private",
	});
};

const getPublicObjectKeyFromUrl = (value) => {
	if(!value) {
		return null;
	}

	let url;
	try {
		url = new URL(String(value));
	} catch {
		return null;
	}

	const publicBases = [getPublicBase(), DEFAULT_PUBLIC_BASE].map((base) => String(base || "").replace(/\/+$/, "")).filter(Boolean);

	for(const base of new Set(publicBases)) {
		try {
			const parsedBase = new URL(base);
			const basePath = parsedBase.pathname.replace(/\/+$/, "");
			if(url.origin === parsedBase.origin && (url.pathname === basePath || url.pathname.startsWith(`${basePath}/`))) {
				return normalizeObjectKey(decodeURIComponent(url.pathname.slice(basePath.length)));
			}
		} catch {
			continue;
		}
	}

	return null;
};

const deletePublicUrl = async (url) => {
	const key = getPublicObjectKeyFromUrl(url);
	if(key) {
		await deleteObject(key, "public");
	}
};

const deletePublicUrlWithinPrefix = async (url, prefix) => {
	const key = getPublicObjectKeyFromUrl(url);
	const objectPrefix = `${normalizeObjectKey(prefix).replace(/\/+$/, "")}/`;
	if(key?.startsWith(objectPrefix)) {
		await deleteObject(key, "public");
	}
};

const deletePrefix = async (prefix, publicity = "public") => {
	const objectPrefix = `${normalizeObjectKey(prefix).replace(/\/+$/, "")}/`;
	const bucket = getBucket(publicity);
	let continuationToken;

	do {
		const result = await bucket.client.send(new ListObjectsV2Command({
			Bucket: bucket.name,
			Prefix: objectPrefix,
			ContinuationToken: continuationToken,
		}));

		const objects = (result.Contents || []).map((item) => ({ Key: item.Key })).filter((item) => item.Key);
		if(objects.length > 0) {
			await bucket.client.send(new DeleteObjectsCommand({
				Bucket: bucket.name,
				Delete: { Objects: objects, Quiet: true },
			}));
		}

		continuationToken = result.IsTruncated ? result.NextContinuationToken : undefined;
	} while(continuationToken);
};

const getLocalReadableObjectPath = async (key, publicity = "public") => {
	const objectKey = normalizeObjectKey(key);
	const cacheRoot = path.join(getRuntimeTempRoot(), "storage-cache");
	const cachePath = path.join(cacheRoot, publicity, ...objectKey.split("/"));
	
	try {
		await fsp.access(cachePath, fs.constants.R_OK);
		return cachePath;
	} catch {
		// continue and fill the process-local cache
	}

	const promiseKey = `${publicity}:${objectKey}`;
	if(localObjectPromises.has(promiseKey)) {
		return localObjectPromises.get(promiseKey);
	}

	const downloadPromise = (async () => {
		const bucket = getBucket(publicity);
		const temporaryPath = `${cachePath}.${crypto.randomBytes(6).toString("hex")}.tmp`;
		await ensureParentDirectory(cachePath);
		
		try {
			const response = await bucket.client.send(new GetObjectCommand({ Bucket: bucket.name, Key: objectKey }));
			await pipeline(response.Body, fs.createWriteStream(temporaryPath, { flags: "wx" }));
			await fsp.rename(temporaryPath, cachePath);
			return cachePath;
		} catch(error) {
			await safelyRemoveFile(temporaryPath).catch(() => {});
			throw error;
		}
	})();

	localObjectPromises.set(promiseKey, downloadPromise);

	try {
		return await downloadPromise;
	} finally {
		localObjectPromises.delete(promiseKey);
	}
};

module.exports = {
	DEFAULT_PUBLIC_BASE,
	IMMUTABLE_CACHE_CONTROL,
	buildSafeObjectFilename,
	deleteObject,
	deletePrefix,
	deletePublicUrl,
	deletePublicUrlWithinPrefix,
	getPrivateObjectDownloadUrl,
	getLocalReadableObjectPath,
	getPublicBase,
	getPublicObjectKeyFromUrl,
	getPublicUrl,
	getUploadTempRoot,
	normalizeObjectKey,
	promotePrivateObject,
	quarantinePublicObject,
	safelyRemoveFile,
	uploadBuffer,
	uploadFile,
	validatePrivateStorageConfiguration,
	validateStorageConfiguration,
};