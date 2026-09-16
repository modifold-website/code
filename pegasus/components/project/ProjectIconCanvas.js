"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { loadBlockyModel } from "@/utils/prefabViewer/BlockyModelLoader";

const EXPORT_SIZE = 512;
const THUMBNAIL_CACHE_LIMIT = 160;
let thumbnailRenderer = null;
let thumbnailRenderQueue = Promise.resolve();
const thumbnailCache = new Map();

const fillBackground = (context, background, size) => {
	const gradient = context.createLinearGradient(0, 0, size, size);
	gradient.addColorStop(0, background.from);
	gradient.addColorStop(1, background.to);
	context.fillStyle = gradient;
	context.fillRect(0, 0, size, size);
};

const createSceneBackground = (background) => {
	const canvas = document.createElement("canvas");
	canvas.width = 256;
	canvas.height = 256;
	fillBackground(canvas.getContext("2d"), background, 256);
	const texture = new THREE.CanvasTexture(canvas);
	texture.colorSpace = THREE.SRGBColorSpace;
	texture.generateMipmaps = false;
	texture.minFilter = THREE.LinearFilter;
	texture.magFilter = THREE.LinearFilter;

	return texture;
};

const compositePreview = (sourceCanvas, background, size) => {
	const canvas = document.createElement("canvas");
	canvas.width = size;
	canvas.height = size;
	const context = canvas.getContext("2d");
	fillBackground(context, background, size);
	context.drawImage(sourceCanvas, 0, 0, size, size);
	return canvas;
};

const canvasToBlob = (canvas) => new Promise((resolve, reject) => {
	canvas.toBlob((blob) => {
		if(blob) {
			resolve(blob);
		} else {
			reject(new Error("icon_export_failed"));
		}
	}, "image/webp", 0.9);
});

const loadIconModel = async (asset) => {
	if(asset.kind === "cube") {
		const texture = await new THREE.TextureLoader().loadAsync(asset.textureUrl);
		texture.colorSpace = THREE.SRGBColorSpace;
		texture.magFilter = THREE.NearestFilter;
		texture.minFilter = THREE.NearestFilter;
		texture.generateMipmaps = false;
		return new THREE.Mesh(
			new THREE.BoxGeometry(1, 1, 1),
			new THREE.MeshStandardMaterial({ map: texture, roughness: 0.82, metalness: 0 })
		);
	}

	return loadBlockyModel(asset.modelUrl, asset.textureUrl || null, null, asset.sourcePath || asset.modelUrl);
};

const prepareIconModel = (model) => {
	model.traverse((child) => {
		if(child.isMesh) {
			child.castShadow = true;
			child.receiveShadow = true;
		}
	});

	const initialBounds = new THREE.Box3().setFromObject(model);
	const initialCenter = initialBounds.getCenter(new THREE.Vector3());
	model.position.x -= initialCenter.x;
	model.position.z -= initialCenter.z;
	model.position.y -= initialBounds.min.y;

	const bounds = new THREE.Box3().setFromObject(model);
	const size = bounds.getSize(new THREE.Vector3());
	const center = bounds.getCenter(new THREE.Vector3());
	return {
		size,
		center,
		radius: Math.max(size.length() * 0.5, 0.35),
	};
};

const disposeIconModel = (model) => {
	model.traverse((child) => {
		if(!child.isMesh) {
			return;
		}

		child.geometry?.dispose();
		const materials = Array.isArray(child.material) ? child.material : [child.material];
		for(const material of materials) {
			if(!material) {
				continue;
			}

			for(const value of Object.values(material)) {
				if(value?.isTexture) {
					value.dispose();
				}
			}

			material.dispose?.();
		}
	});
};

const renderStaticThumbnail = async (asset, size) => {
	if(!thumbnailRenderer) {
		thumbnailRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true, powerPreference: "high-performance" });
		thumbnailRenderer.setPixelRatio(1);
		thumbnailRenderer.setClearColor(0x000000, 0);
		thumbnailRenderer.shadowMap.enabled = true;
		thumbnailRenderer.shadowMap.type = THREE.PCFSoftShadowMap;
		thumbnailRenderer.outputColorSpace = THREE.SRGBColorSpace;
	}

	const renderer = thumbnailRenderer;
	const scene = new THREE.Scene();
	const camera = new THREE.PerspectiveCamera(34, 1, 0.01, 500);
	const model = await loadIconModel(asset);
	if(!model) {
		throw new Error("model_unavailable");
	}

	const { size: modelSize, center, radius } = prepareIconModel(model);
	const distance = radius / Math.sin((camera.fov * Math.PI) / 360) * 0.9;
	const target = new THREE.Vector3(0, center.y * 0.92, 0);

	camera.position.set(distance * 0.82, center.y + distance * 0.48, distance * 0.92);
	camera.lookAt(target);
	camera.near = Math.max(0.01, distance / 100);
	camera.far = Math.max(100, distance * 10);
	camera.updateProjectionMatrix();
	scene.add(model);
	scene.add(new THREE.HemisphereLight(0xffffff, 0x526174, 2.35));

	const keyLight = new THREE.DirectionalLight(0xffffff, 3.4);
	keyLight.position.set(radius * 3.8, radius * 6, radius * 4.2);
	keyLight.castShadow = true;
	keyLight.shadow.mapSize.set(512, 512);
	keyLight.shadow.bias = -0.0005;
	keyLight.target.position.copy(target);
	scene.add(keyLight, keyLight.target);

	const rimLight = new THREE.DirectionalLight(0xbdd7ff, 1.15);
	rimLight.position.set(-5, 3, -4);
	scene.add(rimLight);

	const shadowSize = Math.max(modelSize.x, modelSize.z, radius) * 2.4;
	const shadow = new THREE.Mesh(
		new THREE.PlaneGeometry(shadowSize, shadowSize),
		new THREE.ShadowMaterial({ color: 0x142033, opacity: 0.24, transparent: true })
	);
	shadow.rotation.x = -Math.PI / 2;
	shadow.position.y = -0.012;
	shadow.receiveShadow = true;
	scene.add(shadow);
	keyLight.shadow.camera.left = -shadowSize;
	keyLight.shadow.camera.right = shadowSize;
	keyLight.shadow.camera.top = shadowSize;
	keyLight.shadow.camera.bottom = -shadowSize;
	keyLight.shadow.camera.near = 0.01;
	keyLight.shadow.camera.far = radius * 15;
	keyLight.shadow.camera.updateProjectionMatrix();

	renderer.setSize(size, size, false);
	renderer.render(scene, camera);
	const result = renderer.domElement.toDataURL("image/png");
	disposeIconModel(model);
	shadow.geometry.dispose();
	shadow.material.dispose();
	scene.clear();
	return result;
};

export const renderProjectIconThumbnail = (asset, size = 160) => {
	const cacheKey = `${asset.kind}:${asset.modelUrl || "cube"}:${asset.textureUrl || ""}:${asset.sourcePath || ""}:${size}`;
	if(thumbnailCache.has(cacheKey)) {
		return thumbnailCache.get(cacheKey);
	}

	const request = thumbnailRenderQueue.catch(() => undefined).then(() => renderStaticThumbnail(asset, size));
	thumbnailRenderQueue = request;
	thumbnailCache.set(cacheKey, request);
	if(thumbnailCache.size > THUMBNAIL_CACHE_LIMIT) {
		thumbnailCache.delete(thumbnailCache.keys().next().value);
	}

	request.catch(() => thumbnailCache.delete(cacheKey));
	return request;
};

const ProjectIconCanvas = forwardRef(function ProjectIconCanvas({ asset, background, cameraSettings, sceneSettings, onSnapshot, onStatusChange }, forwardedRef) {
	const containerRef = useRef(null);
	const rendererRef = useRef(null);
	const cameraRef = useRef(null);
	const controlsRef = useRef(null);
	const sceneRef = useRef(null);
	const sceneBackgroundRef = useRef(null);
	const hemisphereLightRef = useRef(null);
	const keyLightRef = useRef(null);
	const rimLightRef = useRef(null);
	const renderRef = useRef(null);
	const applyCameraSettingsRef = useRef(null);
	const applySceneSettingsRef = useRef(null);
	const initialViewRef = useRef(null);
	const backgroundRef = useRef(background);
	const cameraSettingsRef = useRef(cameraSettings);
	const sceneSettingsRef = useRef(sceneSettings);
	const [status, setStatus] = useState("loading");

	useEffect(() => {
		backgroundRef.current = background;
		if(sceneRef.current) {
			const previousBackground = sceneBackgroundRef.current;
			const nextBackground = createSceneBackground(background);
			sceneRef.current.background = nextBackground;
			sceneBackgroundRef.current = nextBackground;
			previousBackground?.dispose();
		}

		if(rendererRef.current && renderRef.current) {
			renderRef.current();
		}
	}, [background]);

	useEffect(() => {
		cameraSettingsRef.current = cameraSettings;
		applyCameraSettingsRef.current?.();
	}, [cameraSettings]);

	useEffect(() => {
		sceneSettingsRef.current = sceneSettings;
		applySceneSettingsRef.current?.();
	}, [sceneSettings]);

	useImperativeHandle(forwardedRef, () => ({
		capture: async () => {
			const renderer = rendererRef.current;
			const scene = sceneRef.current;
			const camera = cameraRef.current;
			if(!renderer || !scene || !camera || status !== "ready") {
				throw new Error("icon_preview_not_ready");
			}

			const size = renderer.getSize(new THREE.Vector2());
			const pixelRatio = renderer.getPixelRatio();
			renderer.setPixelRatio(1);
			renderer.setSize(EXPORT_SIZE, EXPORT_SIZE, false);
			camera.aspect = 1;
			camera.updateProjectionMatrix();
			renderRef.current?.();
			const output = compositePreview(renderer.domElement, backgroundRef.current, EXPORT_SIZE);
			const blob = await canvasToBlob(output);
			renderer.setPixelRatio(pixelRatio);
			renderer.setSize(size.x, size.y, false);
			camera.aspect = size.x / Math.max(1, size.y);
			camera.updateProjectionMatrix();
			renderRef.current?.();

			return blob;
		},
		resetView: (cameraSettings) => {
			const initial = initialViewRef.current;
			if(!initial || !cameraRef.current || !controlsRef.current) {
				return;
			}

			cameraRef.current.position.copy(initial.position);
			controlsRef.current.target.copy(initial.target);
			controlsRef.current.update();
			cameraSettingsRef.current = cameraSettings;
			applyCameraSettingsRef.current?.();
		},
	}), [status]);

	useEffect(() => {
		if(!containerRef.current || !asset) {
			return undefined;
		}

		let disposed = false;
		let snapshotFrame = 0;
		const container = containerRef.current;
		const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true, powerPreference: "high-performance" });
		const scene = new THREE.Scene();
		const sceneBackground = createSceneBackground(backgroundRef.current);
		scene.background = sceneBackground;
		const camera = new THREE.PerspectiveCamera(34, 1, 0.01, 500);
		const controls = new OrbitControls(camera, renderer.domElement);
		const resizeObserver = new ResizeObserver(() => {
			const width = Math.max(1, container.clientWidth);
			const height = Math.max(1, container.clientHeight);
			camera.aspect = width / height;
			camera.updateProjectionMatrix();
			renderer.setSize(width, height, false);
			render();
		});

		const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
		renderer.setPixelRatio(pixelRatio);
		renderer.setClearColor(0x000000, 1);
		renderer.shadowMap.enabled = true;
		renderer.shadowMap.type = THREE.PCFSoftShadowMap;
		renderer.outputColorSpace = THREE.SRGBColorSpace;
		renderer.domElement.setAttribute("aria-hidden", "true");
		container.replaceChildren(renderer.domElement);

		controls.enableDamping = false;
		controls.enablePan = true;
		controls.screenSpacePanning = true;
		controls.minDistance = 0.2;
		controls.maxDistance = 80;
		controls.rotateSpeed = 0.65;
		controls.zoomSpeed = 0.7;

		const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x526174, 2.35);
		scene.add(hemisphereLight);
		const keyLight = new THREE.DirectionalLight(0xffffff, 3.4);
		keyLight.position.set(4, 7, 5);
		keyLight.castShadow = true;
		keyLight.shadow.mapSize.set(2048, 2048);
		keyLight.shadow.bias = -0.00015;
		scene.add(keyLight);
		const rimLight = new THREE.DirectionalLight(0xbdd7ff, 1.15);
		rimLight.position.set(-5, 3, -4);
		scene.add(rimLight);

		const publishSnapshot = () => {
			if(!onSnapshot || disposed || snapshotFrame) {
				return;
			}

			snapshotFrame = window.requestAnimationFrame(() => {
				snapshotFrame = 0;

				try {
					const preview = compositePreview(renderer.domElement, backgroundRef.current, 160);
					onSnapshot(preview.toDataURL("image/png"));
				} catch {}
			});
		};

		function render() {
			if(disposed) {
				return;
			}

			renderer.render(scene, camera);

			publishSnapshot();
		}

		rendererRef.current = renderer;
		cameraRef.current = camera;
		controlsRef.current = controls;
		sceneRef.current = scene;
		sceneBackgroundRef.current = sceneBackground;
		hemisphereLightRef.current = hemisphereLight;
		keyLightRef.current = keyLight;
		rimLightRef.current = rimLight;
		renderRef.current = render;
		controls.addEventListener("change", render);
		resizeObserver.observe(container);
		setStatus("loading");
		onStatusChange?.("loading");

		const loadAsset = async () => {
			const model = await loadIconModel(asset);
			if(disposed || !model) {
				throw new Error("model_unavailable");
			}

			const { size, center, radius } = prepareIconModel(model);
			scene.add(model);

			const distance = radius / Math.sin((camera.fov * Math.PI) / 360) * 0.779;
			const target = new THREE.Vector3(0, center.y * 0.92, 0);
			camera.position.set(distance * 0.82, center.y + distance * 0.48, distance * 0.92);
			camera.near = Math.max(0.01, distance / 100);
			camera.far = Math.max(10, distance * 4);
			camera.updateProjectionMatrix();
			controls.target.copy(target);
			controls.minDistance = distance * 0.55;
			controls.maxDistance = distance * 1.8;
			controls.update();
			initialViewRef.current = {
				position: camera.position.clone(),
				target: target.clone(),
				distance,
				modelHeight: Math.max(size.y, 0.1),
				radius,
			};

			applyCameraSettingsRef.current = () => {
				const initial = initialViewRef.current;
				if(!initial || disposed) {
					return;
				}

				const settings = cameraSettingsRef.current || {};
				const zoom = Math.max(0.65, Number(settings.zoom) || 1);
				const focus = Math.max(-0.45, Math.min(0.45, Number(settings.focus) || 0));
				const direction = camera.position.clone().sub(controls.target);
				if(direction.lengthSq() < 0.000001) {
					direction.copy(initial.position).sub(initial.target);
				}

				direction.normalize();
				const nextTarget = initial.target.clone();
				nextTarget.y += initial.modelHeight * focus;
				controls.target.copy(nextTarget);
				camera.position.copy(nextTarget).addScaledVector(direction, initial.distance / zoom);
				controls.update();
				render();
			};

			applySceneSettingsRef.current = () => {
				const settings = sceneSettingsRef.current || {};
				const intensity = Math.max(0.35, Number(settings.lightIntensity) || 1);
				const lightAngle = Number(settings.lightAngle);
				const angle = THREE.MathUtils.degToRad(Number.isFinite(lightAngle) ? lightAngle : 35);
				hemisphereLight.intensity = 2.35 * Math.min(1.4, 0.7 + intensity * 0.3);
				keyLight.intensity = 3.4 * intensity;
				keyLight.position.set(Math.sin(angle) * radius * 5.6, radius * 6, Math.cos(angle) * radius * 5.6);
				rimLight.intensity = 1.15 * Math.min(1.35, intensity);
				const softShadows = settings.softShadows !== false;
				keyLight.castShadow = softShadows;
				shadow.visible = softShadows;
				render();
			};

			const shadowSize = Math.max(size.x, size.z, radius) * 2.4;
			const shadowGeometry = new THREE.PlaneGeometry(shadowSize, shadowSize);
			const shadowMaterial = new THREE.ShadowMaterial({ color: 0x142033, opacity: 0.28, transparent: true });
			const shadow = new THREE.Mesh(shadowGeometry, shadowMaterial);
			shadow.rotation.x = -Math.PI / 2;
			shadow.position.y = -0.012;
			shadow.receiveShadow = true;
			scene.add(shadow);

			keyLight.position.set(radius * 3.8, radius * 6, radius * 4.2);
			keyLight.target.position.copy(target);
			scene.add(keyLight.target);
			keyLight.shadow.camera.left = -shadowSize;
			keyLight.shadow.camera.right = shadowSize;
			keyLight.shadow.camera.top = shadowSize;
			keyLight.shadow.camera.bottom = -shadowSize;
			keyLight.shadow.camera.near = 0.01;
			keyLight.shadow.camera.far = radius * 15;
			keyLight.shadow.normalBias = Math.max(0.001, radius * 0.002);
			keyLight.shadow.camera.updateProjectionMatrix();
			applyCameraSettingsRef.current();
			applySceneSettingsRef.current();

			setStatus("ready");
			onStatusChange?.("ready");
			render();
		};

		loadAsset().catch(() => {
			if(!disposed) {
				setStatus("error");
				onStatusChange?.("error");
			}
		});

		return () => {
			disposed = true;
			if(snapshotFrame) {
				window.cancelAnimationFrame(snapshotFrame);
			}

			resizeObserver.disconnect();
			controls.removeEventListener("change", render);
			controls.dispose();
			sceneBackgroundRef.current?.dispose();
			renderer.dispose();
			container.replaceChildren();
			rendererRef.current = null;
			cameraRef.current = null;
			controlsRef.current = null;
			sceneRef.current = null;
			sceneBackgroundRef.current = null;
			hemisphereLightRef.current = null;
			keyLightRef.current = null;
			rimLightRef.current = null;
			renderRef.current = null;
			applyCameraSettingsRef.current = null;
			applySceneSettingsRef.current = null;
		};
	}, [asset, onSnapshot, onStatusChange]);

	return <div ref={containerRef} className={`project-icon-canvas project-icon-canvas--${status}`} />;
});

export default ProjectIconCanvas;