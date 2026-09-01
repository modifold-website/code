import * as THREE from "three";
import { assetUrl } from "./BlockCatalog.js";

export const BLOCK_MODEL_UNITS = 32;
export const CHARACTER_MODEL_UNITS = 64;

export function isCharacterDensityModel(modelPath) {
	const p = String(modelPath || "").replace(/\\/g, "/");
	if(!p) {
		return false;
	}

	if(/^Characters\//i.test(p)) {
		return true;
	}

	if(/^Items\/(Weapons|Projectiles|Armors|Tools)\//i.test(p)) {
		return true;
	}

	if(!/^NPC\//i.test(p)) {
		return false;
	}

	if(/^NPC\/[^/]+\.blockymodel$/i.test(p)) {
		return false;
	}

	return true;
}

export function modelRootScale(modelPath) {
	return 1 / (isCharacterDensityModel(modelPath) ? CHARACTER_MODEL_UNITS : BLOCK_MODEL_UNITS);
}

const textureCache = new Map();
const textureRequestCache = new Map();
const modelDocumentCache = new Map();
const modelCache = new Map();

function texturePixelSize(tex) {
	const fromUser = tex?.userData;
	if(fromUser?.pixelWidth > 0 && fromUser?.pixelHeight > 0) {
		return { w: Number(fromUser.pixelWidth), h: Number(fromUser.pixelHeight) };
	}

	const img = tex?.image ?? tex?.source?.data ?? null;
	if(!img) {
		return null;
	}

	const w = Number(img.width || img.naturalWidth || img.videoWidth || 0);
	const h = Number(img.height || img.naturalHeight || img.videoHeight || 0);
	if(w > 0 && h > 0) {
		return { w, h };
	}

	return null;
}

function pngSizeFromBuffer(buf) {
	const bytes = new Uint8Array(buf);
	if(bytes.length < 24) {
		return null;
	}

	if(bytes[0] !== 0x89 || bytes[1] !== 0x50 || bytes[2] !== 0x4e || bytes[3] !== 0x47) {
		return null;
	}

	const view = new DataView(buf);
	const w = view.getUint32(16);
	const h = view.getUint32(20);
	if(w > 0 && h > 0 && w < 65536 && h < 65536) {
		return { w, h };
	}

	return null;
}

async function loadTextureUncached(url) {
	const res = await fetch(url);
	if(!res.ok) {
		throw new Error(`texture ${res.status} ${url}`);
	}

	const buffer = await res.arrayBuffer();
	const headerSize = pngSizeFromBuffer(buffer);
	const blob = new Blob([buffer]);
	let width = 0;
	let height = 0;
	let sourceImage = null;

	try {
		const bitmap = await createImageBitmap(blob);
		width = bitmap.width || 0;
		height = bitmap.height || 0;
		sourceImage = bitmap;
	} catch {}

	if((!width || !height) && headerSize) {
		width = headerSize.w;
		height = headerSize.h;
	}

	if(!width || !height || !sourceImage) {
		const objectUrl = URL.createObjectURL(blob);
		try {
			const img = await new Promise((resolve, reject) => {
				const el = new Image();
				el.onload = () => resolve(el);
				el.onerror = () => reject(new Error(`image decode failed ${url}`));
				el.src = objectUrl;
			});
			width = img.naturalWidth || img.width || headerSize?.w || 0;
			height = img.naturalHeight || img.height || headerSize?.h || 0;
			sourceImage = img;
		} finally {
			URL.revokeObjectURL(objectUrl);
		}
	}

	if(!width || !height) {
		sourceImage?.close?.();
		throw new Error(`texture has no dimensions ${url}`);
	}

	const canvas = document.createElement("canvas");
	canvas.width = width;
	canvas.height = height;
	const ctx = canvas.getContext("2d");
	if(!ctx) {
		sourceImage?.close?.();
		throw new Error("texture canvas unavailable");
	}

	ctx.drawImage(sourceImage, 0, 0);
	sourceImage?.close?.();

	const tex = new THREE.CanvasTexture(canvas);
	tex.colorSpace = THREE.SRGBColorSpace;
	tex.flipY = true;
	tex.magFilter = THREE.NearestFilter;
	tex.minFilter = THREE.NearestFilter;
	tex.generateMipmaps = false;
	tex.wrapS = THREE.ClampToEdgeWrapping;
	tex.wrapT = THREE.ClampToEdgeWrapping;
	tex.needsUpdate = true;
	tex.userData.pixelWidth = width;
	tex.userData.pixelHeight = height;
	return tex;
}

async function loadTexture(url) {
	const hit = textureCache.get(url);
	if(hit) {
		return hit;
	}

	if(textureRequestCache.has(url)) {
		return textureRequestCache.get(url);
	}

	const request = loadTextureUncached(url);
	textureRequestCache.set(url, request);
	try {
		const texture = await request;
		textureCache.set(url, texture);
		return texture;
	} finally {
		textureRequestCache.delete(url);
	}
}

async function loadModelDocument(modelPath) {
	const modelUrl = assetUrl(modelPath);
	if(modelDocumentCache.has(modelUrl)) {
		return modelDocumentCache.get(modelUrl);
	}

	const request = (async () => {
		try {
			const response = await fetch(modelUrl);
			if(!response.ok) {
				console.warn(`Blocky model ${response.status}`, modelUrl);
				return null;
			}

			return response.json();
		} catch(error) {
			console.warn("Blocky model unreadable", modelUrl, error);
			return null;
		}
	})();

	modelDocumentCache.set(modelUrl, request);
	return request;
}

function vec3(obj, dx = 0, dy = 0, dz = 0) {
	if(!obj) {
		return new THREE.Vector3(dx, dy, dz);
	}

	return new THREE.Vector3(
		Number(obj.x ?? dx),
		Number(obj.y ?? dy),
		Number(obj.z ?? dz)
	);
}

function quat(obj) {
	if(!obj) {
		return new THREE.Quaternion();
	}

	return new THREE.Quaternion(
		Number(obj.x || 0),
		Number(obj.y || 0),
		Number(obj.z || 0),
		Number(obj.w ?? 1)
	).normalize();
}

function switchIndices(arr, i1, i2) {
	const t = arr[i1];
	arr[i1] = arr[i2];
	arr[i2] = t;
}

function faceUvsThree(layout, faceW, faceH, denomW, denomH) {
	const ox = Number(layout?.offset?.x || 0);
	const oy = Number(layout?.offset?.y || 0);
	let uvSize = [Math.abs(faceW) || 0.01, Math.abs(faceH) || 0.01];
	let uvMirror = [layout?.mirror?.x ? -1 : 1, layout?.mirror?.y ? -1 : 1];
	const angle = Number(layout?.angle || 0);

	let result;
	let transposeCorners = false;
	switch (angle) {
		case 90: {
			switchIndices(uvSize, 0, 1);
			switchIndices(uvMirror, 0, 1);
			uvMirror[0] *= -1;
			result = [
				ox,
				oy + uvSize[1] * uvMirror[1],
				ox + uvSize[0] * uvMirror[0],
				oy,
			];
			transposeCorners = true;
			break;
		}
		case 270: {
			switchIndices(uvSize, 0, 1);
			switchIndices(uvMirror, 0, 1);
			uvMirror[1] *= -1;
			result = [
				ox + uvSize[0] * uvMirror[0],
				oy,
				ox,
				oy + uvSize[1] * uvMirror[1],
			];
			transposeCorners = true;
			break;
		}
		case 180: {
			uvMirror[0] *= -1;
			uvMirror[1] *= -1;
			result = [
				ox + uvSize[0] * uvMirror[0],
				oy + uvSize[1] * uvMirror[1],
				ox,
				oy,
			];
			break;
		}
		default: {
			result = [
				ox,
				oy,
				ox + uvSize[0] * uvMirror[0],
				oy + uvSize[1] * uvMirror[1],
			];
			break;
		}
	}

	const [x0, y0, x1, y1] = result;
	const toUv = (x, y) => [x / denomW, 1 - y / denomH];
	if(transposeCorners) {
		return [toUv(x0, y0), toUv(x0, y1), toUv(x1, y0), toUv(x1, y1)];
	}

	return [toUv(x0, y0), toUv(x1, y0), toUv(x0, y1), toUv(x1, y1)];
}

function measureUvLayout(nodes) {
	let maxX = 0;
	let maxY = 0;

	function walk(node) {
		const shape = node?.shape;
		if(shape && shape.visible !== false) {
			const size = shape.settings?.size || {};
			const sx = Math.abs(Number(size.x) || 0);
			const sy = Math.abs(Number(size.y) || 0);
			const sz = Math.abs(Number(size.z) || 0);
			const layout = shape.textureLayout || {};
			for(const [key, face] of Object.entries(layout)) {
				if(!face || typeof face !== "object") {
					continue;
				}

				let fw = sx;
				let fh = sy;
				const k = String(key);
				if(k === "top" || k === "bottom" || k === "up" || k === "down") {
					fw = sx;
					fh = sz || sy;
				} else if(k === "left" || k === "right" || k === "east" || k === "west") {
					fw = sz || sx;
					fh = sy;
				} else if(k === "front" || k === "back" || k === "north" || k === "south") {
					fw = sx;
					fh = sy;
				}

				const angle = Number(face.angle || 0);
				if(angle === 90 || angle === 270) {
					const t = fw;
					fw = fh;
					fh = t;
				}

				const ox = Number(face.offset?.x || 0);
				const oy = Number(face.offset?.y || 0);
				const x0 = ox;
				const x1 = ox + (face.mirror?.x ? -fw : fw);
				const y0 = oy;
				const y1 = oy + (face.mirror?.y ? -fh : fh);
				maxX = Math.max(maxX, x0, x1);
				maxY = Math.max(maxY, y0, y1);
			}
		}

		if(Array.isArray(node?.children)) {
			for(const child of node.children) {
				walk(child);
			}
		}
	}

	for(const node of nodes || []) {
		walk(node);
	}

	return { maxX, maxY };
}

function makeFaceMaterial(texture, shape, tintHex = null) {
	const mat = new THREE.MeshLambertMaterial({
		map: texture,
		color: tintHex ? new THREE.Color(tintHex) : 0xffffff,
		transparent: false,
		alphaTest: 0.05,
		alphaToCoverage: true,
		depthTest: true,
		depthWrite: true,
		side: THREE.DoubleSide,
		shadowSide: THREE.FrontSide,
	});

	if(shape.shadingMode === "fullbright") {
		mat.emissive = new THREE.Color(0xffffff);
		mat.emissiveMap = texture;
		mat.emissiveIntensity = 0.35;
	}

	return mat;
}

function buildBoxMesh(shape, texture, denomW, denomH, tintHex = null) {
	const size = vec3(shape.settings?.size, 1, 1, 1);
	const stretch = vec3(shape.stretch, 1, 1, 1);
	const sx = Math.abs(size.x * stretch.x);
	const sy = Math.abs(size.y * stretch.y);
	const sz = Math.abs(size.z * stretch.z);
	if(sx < 1e-6 && sy < 1e-6 && sz < 1e-6) {
		return null;
	}

	const uvX = Math.abs(size.x) || 0.01;
	const uvY = Math.abs(size.y) || 0.01;
	const uvZ = Math.abs(size.z) || 0.01;

	const layout = shape.textureLayout || {};
	const sharedMat = makeFaceMaterial(texture, shape, tintHex);
	const layoutKeys = Object.keys(layout);
	const hideMissingFaces = layoutKeys.length > 0;
	const hiddenMat = hideMissingFaces ? new THREE.MeshBasicMaterial({ visible: false }) : null;

	const geom = new THREE.BoxGeometry(sx || 0.01, sy || 0.01, sz || 0.01);
	const uvAttr = geom.getAttribute("uv");
	const faceLayouts = [
		layout.right || layout.east,
		layout.left || layout.west,
		layout.top || layout.up,
		layout.bottom || layout.down,
		layout.front || layout.south,
		layout.back || layout.north,
	];
	const faceSizes = [
		[uvZ, uvY], 
		[uvZ, uvY], 
		[uvX, uvZ], 
		[uvX, uvZ], 
		[uvX, uvY], 
		[uvX, uvY], 
	];
	const materials = [];
	for(let f = 0; f < 6; f += 1) {
		const faceLayout = faceLayouts[f];
		if(hideMissingFaces && !faceLayout) {
			materials.push(hiddenMat);
			continue;
		}

		materials.push(sharedMat);
		const uvs = faceUvsThree(faceLayout, faceSizes[f][0], faceSizes[f][1], denomW, denomH);
		const base = f * 4;
		for(let i = 0; i < 4; i += 1) {
			uvAttr.setXY(base + i, uvs[i][0], uvs[i][1]);
		}
	}

	uvAttr.needsUpdate = true;

	const mesh = new THREE.Mesh(geom, materials);
	if(stretch.x < 0) {
		mesh.scale.x *= -1;
	}

	if(stretch.y < 0) {
		mesh.scale.y *= -1;
	}

	if(stretch.z < 0) {
		mesh.scale.z *= -1;
	}

	return mesh;
}

function buildQuadMesh(shape, texture, denomW, denomH, tintHex = null) {
	const size = vec3(shape.settings?.size, 1, 1, 0);
	const stretch = vec3(shape.stretch, 1, 1, 1);
	const normal = String(shape.settings?.normal || "+Z");
	let w = Math.abs(size.x * stretch.x) || 0.01;
	let h = Math.abs(size.y * stretch.y) || 0.01;
	let uvW = Math.abs(size.x) || 0.01;
	let uvH = Math.abs(size.y) || 0.01;
	if(normal.endsWith("X")) {
		w = Math.abs((size.z || size.x) * stretch.z) || w;
		h = Math.abs(size.y * stretch.y) || h;
		uvW = Math.abs(size.z || size.x) || uvW;
		uvH = Math.abs(size.y) || uvH;
	} else if(normal.endsWith("Y")) {
		w = Math.abs(size.x * stretch.x) || w;
		h = Math.abs((size.z || size.y) * stretch.z) || h;
		uvW = Math.abs(size.x) || uvW;
		uvH = Math.abs(size.z || size.y) || uvH;
	}

	const layout = shape.textureLayout?.front || shape.textureLayout?.south || null;
	const uvs = faceUvsThree(layout, uvW, uvH, denomW, denomH);
	const geom = new THREE.PlaneGeometry(w, h);
	const uvAttr = geom.getAttribute("uv");
	uvAttr.setXY(0, uvs[0][0], uvs[0][1]);
	uvAttr.setXY(1, uvs[1][0], uvs[1][1]);
	uvAttr.setXY(2, uvs[2][0], uvs[2][1]);
	uvAttr.setXY(3, uvs[3][0], uvs[3][1]);
	uvAttr.needsUpdate = true;

	const mat = makeFaceMaterial(texture, { ...shape, doubleSided: true }, tintHex);
	const mesh = new THREE.Mesh(geom, mat);
	if(normal === "+X") {
		mesh.rotation.y = Math.PI / 2;
	} else if(normal === "-X") {
		mesh.rotation.y = -Math.PI / 2;
	} else if(normal === "+Y") {
		mesh.rotation.x = -Math.PI / 2;
	} else if(normal === "-Y") {
		mesh.rotation.x = Math.PI / 2;
	} else if(normal === "-Z") {
		mesh.rotation.y = Math.PI;
	}

	if(stretch.x < 0) {
		mesh.scale.x *= -1;
	}

	if(stretch.y < 0) {
		mesh.scale.y *= -1;
	}

	return mesh;
}

function accumulateNode(node, parent, texture, denomW, denomH, tintHex) {
	const shape = node.shape;
	const visible = !shape || shape.visible !== false;

	const position = vec3(node.position);
	const orientation = quat(node.orientation);
	const offset = shape ? vec3(shape.offset) : new THREE.Vector3();

	const localPos = offset.clone().applyQuaternion(orientation).add(position);
	const group = new THREE.Group();
	group.position.copy(localPos);
	group.quaternion.copy(orientation);
	parent.add(group);

	if(visible && shape) {
		const type = shape.type || "none";
		let mesh = null;
		if(type === "box") {
			mesh = buildBoxMesh(shape, texture, denomW, denomH, tintHex);
		} else if(type === "quad") {
			mesh = buildQuadMesh(shape, texture, denomW, denomH, tintHex);
		}

		if(mesh) {
			group.add(mesh);
		}
	}

	if(Array.isArray(node.children)) {
		for(const child of node.children) {
			accumulateNode(child, group, texture, denomW, denomH, tintHex);
		}
	}
}

export async function loadBlockyModel(modelPath, texturePath = null, tintHex = null) {
	const tintKey = tintHex ? String(tintHex).toLowerCase() : "";
	const key = `${modelPath}|${texturePath || ""}|${tintKey}`;
	if(modelCache.has(key)) {
		const cached = await modelCache.get(key);
		return cached ? cached.clone(true) : null;
	}

	const promise = (async () => {
		const json = await loadModelDocument(modelPath);
		if(!json) {
			return null;
		}

		let texPath = texturePath;
		if(!texPath) {
			const base = modelPath.replace(/\.blockymodel$/i, "");
			texPath = `${base}_Texture.png`;
		}

		let texture = null;
		let bitmapSize = null;
		const tryPaths = [
			texPath,
			modelPath.replace(/\.blockymodel$/i, ".png"),
			modelPath.replace(/\.blockymodel$/i, "_Texture.png"),
			modelPath.replace(/[^/]+$/, "Texture.png"),
			modelPath.replace(/\.blockymodel$/i, "_Textures/Texture.png"),
		].filter(Boolean);

		for(const candidate of tryPaths) {
			try {
				const baseTex = await loadTexture(assetUrl(candidate));
				const size = texturePixelSize(baseTex);
				if(!size) {
					continue;
				}

				texture = baseTex.clone();
				texture.colorSpace = THREE.SRGBColorSpace;
				texture.needsUpdate = true;
				texture.userData.pixelWidth = size.w;
				texture.userData.pixelHeight = size.h;
				if(baseTex.image) {
					texture.image = baseTex.image;
				} else if(baseTex.source) {
					texture.source = baseTex.source;
				}

				bitmapSize = size;
				break;
			} catch {}
		}

		if(!texture) {
			console.warn("Blocky model texture missing, drawing grey", modelPath, tryPaths);
			const data = new Uint8Array([180, 180, 180, 255]);
			texture = new THREE.DataTexture(data, 1, 1, THREE.RGBAFormat);
			texture.needsUpdate = true;
			texture.magFilter = THREE.NearestFilter;
			texture.minFilter = THREE.NearestFilter;
		}

		const nodes = Array.isArray(json.nodes) ? json.nodes : [];
		const { maxX, maxY } = measureUvLayout(nodes);
		let texW = bitmapSize?.w || 0;
		let texH = bitmapSize?.h || 0;
		if(texW <= 0) {
			texW = Math.max(64, Math.ceil(maxX) || 64);
		}

		if(texH <= 0) {
			texH = Math.max(64, Math.ceil(maxY) || 64);
		}

		if(bitmapSize && (maxX > bitmapSize.w + 1 || maxY > bitmapSize.h + 1)) {
			texture.wrapS = THREE.RepeatWrapping;
			texture.wrapT = THREE.RepeatWrapping;
		}

		const root = new THREE.Group();
		root.name = modelPath;
		root.userData.hytaleCachedModel = true;
		for(const node of nodes) {
			accumulateNode(node, root, texture, texW, texH, tintHex);
		}

		root.scale.setScalar(modelRootScale(modelPath));
		return root;
	})();

	modelCache.set(key, promise);
	try {
		const result = await promise;
		return result ? result.clone(true) : null;
	} catch (err) {
		modelCache.delete(key);
		console.warn("Blocky model load failed", modelPath, err);
		return null;
	}
}

export function clearModelCaches() {
	for(const tex of textureCache.values()) {
		tex.dispose();
	}

	textureCache.clear();
	textureRequestCache.clear();
	modelDocumentCache.clear();
	modelCache.clear();
}