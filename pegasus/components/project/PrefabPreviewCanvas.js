"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { assetUrl, loadCatalogs, resolveCubeFaces, resolveFaceTint } from "@/utils/prefabViewer/BlockCatalog";
import { buildOptimizedPrefabMesh } from "@/utils/prefabViewer/OptimizedPrefabMeshBuilder";

const prefabRequestCache = new Map();

const getFullscreenElement = () => document.fullscreenElement || document.webkitFullscreenElement || document.webkitCurrentFullScreenElement;

// soft grid with faded edges
const createFadedGrid = (size, divisions) => {
	const grid = new THREE.GridHelper(size, divisions, 0x7b8289, 0x9ca2a8);
	grid.material.transparent = true;
	grid.material.opacity = 1;
	grid.material.depthWrite = false;
	grid.material.onBeforeCompile = (shader) => {
		shader.uniforms.gridHalfSize = { value: size / 2 };
		shader.uniforms.gridOpacity = { value: 0.3 };
		shader.vertexShader = `
			varying vec2 gridPosition;
			${shader.vertexShader}
		`.replace(
			"#include <begin_vertex>",
			"#include <begin_vertex>\n\tgridPosition = position.xz;",
		);
		shader.fragmentShader = `
			uniform float gridHalfSize;
			uniform float gridOpacity;
			varying vec2 gridPosition;
			${shader.fragmentShader}
		`.replace(
			"#include <opaque_fragment>",
			"float gridDistance = max(abs(gridPosition.x), abs(gridPosition.y));\n\tdiffuseColor.a *= gridOpacity * (1.0 - smoothstep(gridHalfSize * 0.62, gridHalfSize, gridDistance));\n\t#include <opaque_fragment>",
		);
	};
	grid.material.customProgramCacheKey = () => "faded-prefab-grid-v2";

	return grid;
};

const fetchPrefab = (url) => {
	if(prefabRequestCache.has(url)) {
		return prefabRequestCache.get(url);
	}
	
	const request = fetch(url).then((response) => {
		if(!response.ok) {
			throw new Error("preview_unavailable");
		}

		return response.json();
	}).catch((error) => {
		prefabRequestCache.delete(url);
		throw error;
	});

	prefabRequestCache.set(url, request);
	window.setTimeout(() => prefabRequestCache.delete(url), 30_000);
	return request;
};

const isRenderableBlock = (block) => {
	const name = String(block?.name || "").replace(/^\*/, "");
	return Boolean(name && name !== "Empty" && Number(block?.filler || 0) === 0);
};

const getBounds = (blocks) => {
	let minX = Infinity;
	let minY = Infinity;
	let minZ = Infinity;
	let maxX = -Infinity;
	let maxY = -Infinity;
	let maxZ = -Infinity;

	for(const block of blocks) {
		if(!isRenderableBlock(block)) {
			continue;
		}

		const x = Number(block.x) || 0;
		const y = Number(block.y) || 0;
		const z = Number(block.z) || 0;
		minX = Math.min(minX, x);
		minY = Math.min(minY, y);
		minZ = Math.min(minZ, z);
		maxX = Math.max(maxX, x);
		maxY = Math.max(maxY, y);
		maxZ = Math.max(maxZ, z);
	}

	if(!Number.isFinite(minX)) {
		return null;
	}

	return { minX, minY, minZ, maxX, maxY, maxZ };
};

export default function PrefabPreviewCanvas({ prefabUrl, active = true }) {
	const t = useTranslations("ProjectPage");
	const containerRef = useRef(null);
	const [status, setStatus] = useState("loading");
	const [progress, setProgress] = useState(null);
	const [isFullscreen, setIsFullscreen] = useState(false);
	const [isFallbackFullscreen, setIsFallbackFullscreen] = useState(false);
	const [hasInteracted, setHasInteracted] = useState(false);
	const fallbackFullscreenRef = useRef(false);
	const apiBase = String(process.env.NEXT_PUBLIC_API_BASE || "").replace(/\/$/, "");

	useEffect(() => {
		if(!active || !containerRef.current || !prefabUrl) {
			return undefined;
		}

		let disposed = false;
		let frameId = 0;
		let autoRotateTimer = 0;
		let lastProgressUpdate = 0;
		let cameraTransition = null;
		let userInteracted = false;
		const container = containerRef.current;
		const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
		const scene = new THREE.Scene();
		const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 1_200);
		const controls = new OrbitControls(camera, renderer.domElement);
		let previewRoot = null;
		let grid = null;
		let sunLight = null;
		let sunTarget = null;
		const textureLoader = new THREE.TextureLoader();
		const textureCache = new Map();
		const compositeTextureCache = new Map();
		const materialCache = new Map();
		const transitionMaterialCache = new Map();
		const textureQueue = [];
		let activeTextureLoads = 0;
		const runTextureQueue = () => {
			while(activeTextureLoads < 6 && textureQueue.length) {
				const task = textureQueue.shift();
				activeTextureLoads += 1;
				void task().finally(() => {
					activeTextureLoads -= 1;
					runTextureQueue();
				});
			}
		};
		
		const enqueueTextureLoad = (task) => new Promise((resolve) => {
			textureQueue.push(async () => {
				if(disposed) {
					resolve(null);
					return;
				}

				resolve(await task());
			});

			runTextureQueue();
		});

		const scheduleRender = () => {
			if(disposed || frameId) {
				return;
			}

			frameId = window.requestAnimationFrame(render);
		};

		const resize = () => {
			const width = Math.max(1, container.clientWidth);
			const height = Math.max(1, container.clientHeight);
			camera.aspect = width / height;
			camera.updateProjectionMatrix();
			renderer.setSize(width, height, false);
			scheduleRender();
		};

		const framePreview = (bounds) => {
			const center = bounds.getCenter(new THREE.Vector3());
			const size = bounds.getSize(new THREE.Vector3());
			const radius = Math.max(size.length() / 2, 4);
			const distance = radius / Math.sin((camera.fov * Math.PI) / 360) * 1.2;
			controls.target.copy(center);
			camera.position.set(center.x + distance * 0.75, center.y + distance * 0.48, center.z + distance * 0.75);
			camera.near = Math.max(0.025, distance / 1_000);
			camera.far = Math.max(1_200, distance * 12);
			camera.updateProjectionMatrix();
			controls.update();
			if(sunLight && sunTarget) {
				const maxDimension = Math.max(size.x, size.y, size.z, 8);
				const shadowExtent = Math.max(size.length() * 0.56, 8);
				const sunDistance = maxDimension * 2;
				sunTarget.position.copy(center);
				sunLight.position.set(center.x + sunDistance * 0.55, center.y + sunDistance, center.z + sunDistance * 0.45);
				sunLight.shadow.camera.left = -shadowExtent;
				sunLight.shadow.camera.right = shadowExtent;
				sunLight.shadow.camera.top = shadowExtent;
				sunLight.shadow.camera.bottom = -shadowExtent;
				sunLight.shadow.camera.near = 0.1;
				sunLight.shadow.camera.far = sunDistance * 3;
				sunLight.shadow.camera.updateProjectionMatrix();
				renderer.shadowMap.needsUpdate = true;
			}

			if(grid) {
				scene.remove(grid);
				grid.geometry.dispose();
				grid.material.dispose();
			}
			const gridSize = Math.max(16, Math.ceil(Math.max(size.x, size.z, 1) * 2.6 / 4) * 4);
			grid = createFadedGrid(gridSize, Math.min(128, Math.max(16, Math.round(gridSize / 2))));
			grid.position.set(center.x, bounds.min.y - 0.02, center.z);
			scene.add(grid);
			scheduleRender();
		};

		const stopAutoRotate = () => {
			controls.autoRotate = false;
			window.clearTimeout(autoRotateTimer);
			scheduleRender();
		};

		const handleControlsStart = () => {
			userInteracted = true;
			setHasInteracted(true);
			cameraTransition = null;
			stopAutoRotate();
		};

		function render(timestamp) {
			frameId = 0;
			if(disposed) {
				return;
			}

			if(cameraTransition) {
				const progress = Math.min(1, (timestamp - cameraTransition.startedAt) / cameraTransition.duration);
				const easedProgress = 1 - Math.pow(1 - progress, 3);
				camera.position.lerpVectors(cameraTransition.start, cameraTransition.end, easedProgress);
				if(progress === 1) {
					cameraTransition = null;
					if(!userInteracted) {
						controls.autoRotate = true;
						autoRotateTimer = window.setTimeout(stopAutoRotate, 5_000);
					}
				}
			}

			const controlsChanged = controls.update();
			const nextNear = Math.max(0.025, controls.getDistance() / 1_000);
			if(Math.abs(camera.near - nextNear) > 0.005) {
				camera.near = nextNear;
				camera.updateProjectionMatrix();
			}

			renderer.render(scene, camera);
			if(cameraTransition || controls.autoRotate || controlsChanged) {
				scheduleRender();
			}
		}

		const loadTexture = (assetPath) => {
			const url = assetUrl(assetPath);
			if(textureCache.has(url)) {
				return textureCache.get(url);
			}

			const texturePromise = enqueueTextureLoad(() => new Promise((resolve) => {
				textureLoader.load(url, (texture) => {
					texture.colorSpace = THREE.SRGBColorSpace;
					texture.magFilter = THREE.NearestFilter;
					texture.minFilter = THREE.NearestFilter;
					texture.generateMipmaps = false;
					resolve(texture);
				}, undefined, () => resolve(null));
			}));

			textureCache.set(url, texturePromise);
			return texturePromise;
		};

		const loadMaskedTexture = (basePath, maskPath, tint) => {
			const key = `${basePath}|${maskPath}|${tint}`;
			if(compositeTextureCache.has(key)) {
				return compositeTextureCache.get(key);
			}

			const texturePromise = Promise.all([loadTexture(basePath), loadTexture(maskPath)]).then(([baseTexture, maskTexture]) => {
				const baseImage = baseTexture?.image;
				const maskImage = maskTexture?.image;
				const width = Number(baseImage?.naturalWidth || baseImage?.width || 0);
				const height = Number(baseImage?.naturalHeight || baseImage?.height || 0);
				if(!baseImage || !maskImage || !width || !height) {
					return null;
				}

				const canvas = document.createElement("canvas");
				canvas.width = width;
				canvas.height = height;
				const context = canvas.getContext("2d");
				const maskCanvas = document.createElement("canvas");
				maskCanvas.width = width;
				maskCanvas.height = height;
				const maskContext = maskCanvas.getContext("2d");
				if(!context || !maskContext) {
					return null;
				}

				context.drawImage(baseImage, 0, 0, width, height);
				maskContext.drawImage(maskImage, 0, 0, width, height);
				maskContext.globalCompositeOperation = "multiply";
				maskContext.fillStyle = tint;
				maskContext.fillRect(0, 0, width, height);
				maskContext.globalCompositeOperation = "destination-in";
				maskContext.drawImage(maskImage, 0, 0, width, height);
				context.drawImage(maskCanvas, 0, 0);

				const texture = new THREE.CanvasTexture(canvas);
				texture.colorSpace = THREE.SRGBColorSpace;
				texture.magFilter = THREE.NearestFilter;
				texture.minFilter = THREE.NearestFilter;
				texture.generateMipmaps = false;
				return texture;
			});

			compositeTextureCache.set(key, texturePromise);
			return texturePromise;
		};

		const getMaterials = (definition) => {
			const resolvedFaces = resolveCubeFaces(definition);
			const faces = [resolvedFaces.east, resolvedFaces.west, resolvedFaces.up, resolvedFaces.down, resolvedFaces.south, resolvedFaces.north];
			const faceNames = ["east", "west", "up", "down", "south", "north"];
			const tints = faceNames.map((face) => resolveFaceTint(definition, face));
			const sideMaskTint = resolveFaceTint(definition, "up");
			const key = `${faces.join("|")}|${tints.join("|")}|${definition?.textureSideMask || ""}|${sideMaskTint}`;
			if(materialCache.has(key)) {
				return materialCache.get(key);
			}

			const materials = faces.map((face, index) => {
				const tint = tints[index];
				const useSideMask = Boolean(face && definition?.textureSideMask && index !== 2 && index !== 3);
				const material = new THREE.MeshLambertMaterial({
					color: face ? (useSideMask ? 0xffffff : tint) : 0x8b7864,
					alphaTest: 0.05,
				});

				if(face) {
					const texturePromise = useSideMask ? loadMaskedTexture(face, definition.textureSideMask, sideMaskTint) : loadTexture(face);
					void texturePromise.then((map) => {
						if(disposed || !map) {
							return;
						}

						material.map = map;
						material.color.set(useSideMask ? 0xffffff : tint);
						material.needsUpdate = true;
						scheduleRender();
					});
				}

				return material;
			});

			materialCache.set(key, materials);
			return materials;
		};

		const getTransitionMaterial = (definition) => {
			const tint = resolveFaceTint(definition, "up");
			const key = `${definition.transitionTexture}|${tint}`;
			if(transitionMaterialCache.has(key)) {
				return transitionMaterialCache.get(key);
			}

			const material = new THREE.MeshLambertMaterial({
				color: tint,
				transparent: true,
				alphaTest: 0.05,
				depthWrite: false,
				polygonOffset: true,
				polygonOffsetFactor: -2,
				polygonOffsetUnits: -2,
				side: THREE.DoubleSide,
			});

			void loadTexture(definition.transitionTexture).then((map) => {
				if(disposed || !map) {
					return;
				}

				material.map = map;
				material.needsUpdate = true;
				scheduleRender();
			});

			transitionMaterialCache.set(key, material);
			return material;
		};

		renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
		renderer.outputColorSpace = THREE.SRGBColorSpace;
		renderer.toneMapping = THREE.NoToneMapping;
		renderer.toneMappingExposure = 1;
		// soft shadows updated only when the scene is ready
		renderer.shadowMap.enabled = true;
		renderer.shadowMap.type = THREE.PCFSoftShadowMap;
		renderer.shadowMap.autoUpdate = false;
		renderer.domElement.className = "prefab-preview__canvas";
		container.appendChild(renderer.domElement);
		renderer.setClearColor(0x000000, 0);
		// neutral light keeps the original texture colors
		scene.add(new THREE.AmbientLight(0xffffff, 0.18));
		scene.add(new THREE.HemisphereLight(0xffffff, 0x777777, 0.45));
		// sun is the main light and shadow source
		sunTarget = new THREE.Object3D();
		sunLight = new THREE.DirectionalLight(0xffffff, 0.9);
		sunLight.position.set(90, 160, 70);
		sunLight.target = sunTarget;
		sunLight.castShadow = true;
		sunLight.shadow.mapSize.set(2_048, 2_048);
		sunLight.shadow.bias = -0.00005;
		sunLight.shadow.normalBias = 0.04;
		sunLight.shadow.radius = 2;
		scene.add(sunLight, sunTarget);
		// softly lights the opposite side
		const fillLight = new THREE.DirectionalLight(0xffffff, 0.18);
		fillLight.position.set(-90, 60, -80);
		scene.add(fillLight);
		// soft light from the camera side
		const cameraLightTarget = new THREE.Object3D();
		cameraLightTarget.position.set(0, 0, -1);
		const cameraLight = new THREE.DirectionalLight(0xffffff, 0.25);
		cameraLight.position.set(2.5, 4, 3);
		cameraLight.target = cameraLightTarget;
		camera.add(cameraLight, cameraLightTarget);
		scene.add(camera);
		// smooth and slower controls
		controls.enableDamping = true;
		controls.dampingFactor = 0.06;
		controls.rotateSpeed = 0.4;
		controls.enablePan = true;
		controls.screenSpacePanning = true;
		controls.zoomToCursor = true;
		controls.minDistance = 0.25;
		controls.maxDistance = 800;
		const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
		const moveCameraCloser = () => {
			if(userInteracted) {
				return;
			}

			const start = camera.position.clone();
			const end = controls.target.clone().add(start.clone().sub(controls.target).multiplyScalar(0.5));
			controls.autoRotate = false;
			if(prefersReducedMotion) {
				camera.position.copy(end);
				controls.update();
				scheduleRender();
				return;
			}

			cameraTransition = {
				start,
				end,
				startedAt: performance.now(),
				duration: 480,
			};
			scheduleRender();
		};
		controls.autoRotate = false;
		controls.autoRotateSpeed = 0.45;
		controls.addEventListener("start", handleControlsStart);
		controls.addEventListener("change", scheduleRender);
		const resizeObserver = new ResizeObserver(resize);
		resizeObserver.observe(container);
		window.addEventListener("resize", resize);
		resize();

		const load = async () => {
			try {
				setStatus("loading");
				setHasInteracted(false);
				const [prefab] = await Promise.all([
					fetchPrefab(`${apiBase}${prefabUrl}`),
					loadCatalogs("https://cdn.modifold.com/hytale-assets"),
				]);

				if(disposed) {
					return;
				}

				const blocks = Array.isArray(prefab?.blocks) ? prefab.blocks : [];
				const bounds = getBounds(blocks);
				if(bounds) {
					framePreview(new THREE.Box3(new THREE.Vector3(bounds.minX, bounds.minY, bounds.minZ), new THREE.Vector3(bounds.maxX + 1, bounds.maxY + 1, bounds.maxZ + 1)));
				}

				const prepared = await buildOptimizedPrefabMesh(prefab, {
					getMaterials,
					getTransitionMaterial,
					onProgress: (current, total) => {
						renderer.shadowMap.needsUpdate = true;
						scheduleRender();
						const now = performance.now();
						if(!disposed && (current === total || now - lastProgressUpdate >= 100)) {
							lastProgressUpdate = now;
							setProgress({ current, total });
						}
					},
					onRoot: (root) => {
						if(!disposed) {
							previewRoot = root;
							scene.add(root);
							renderer.shadowMap.needsUpdate = true;
							scheduleRender();
						}
					},
					isCancelled: () => disposed,
				});

				if(!prepared || disposed) {
					return;
				}

				if(!bounds) {
					framePreview(new THREE.Box3().setFromObject(prepared.root));
				}

				setStatus("ready");
				moveCameraCloser();
			} catch {
				if(!disposed) {
					setStatus("error");
				}
			}
		};
		
		void load();

		return () => {
			disposed = true;
			window.clearTimeout(autoRotateTimer);
			window.cancelAnimationFrame(frameId);
			window.removeEventListener("resize", resize);
			resizeObserver.disconnect();
			controls.removeEventListener("start", handleControlsStart);
			controls.removeEventListener("change", scheduleRender);
			controls.dispose();
			if(previewRoot) {
				scene.remove(previewRoot);
				previewRoot.traverse((child) => {
					if(child.userData?.prefabOwned) {
						child.geometry?.dispose();
						const materials = Array.isArray(child.material) ? child.material : [child.material];
						materials.forEach((material) => material?.dispose());
					}
				});
			}

			if(grid) {
				scene.remove(grid);
				grid.geometry.dispose();
				grid.material.dispose();
			}

			materialCache.forEach((materials) => materials.forEach((material) => material.dispose()));
			transitionMaterialCache.forEach((material) => material.dispose());
			compositeTextureCache.forEach((texturePromise) => {
				void texturePromise.then((texture) => texture?.dispose());
			});
			textureCache.forEach((texturePromise) => {
				void texturePromise.then((texture) => texture?.dispose());
			});

			renderer.dispose();
			renderer.domElement.remove();
		};
	}, [active, apiBase, prefabUrl]);

	useEffect(() => {
		const syncFullscreenState = () => {
			const fullscreenElement = getFullscreenElement();
			setIsFullscreen(fullscreenElement === containerRef.current || fallbackFullscreenRef.current);
		};

		document.addEventListener("fullscreenchange", syncFullscreenState);
		document.addEventListener("webkitfullscreenchange", syncFullscreenState);
		return () => {
			document.removeEventListener("fullscreenchange", syncFullscreenState);
			document.removeEventListener("webkitfullscreenchange", syncFullscreenState);
		};
	}, []);

	useEffect(() => {
		if(!isFallbackFullscreen || !containerRef.current) {
			return undefined;
		}

		const container = containerRef.current;
		const placeholder = document.createComment("prefab-preview");
		const scrollX = window.scrollX;
		const scrollY = window.scrollY;
		container.parentNode?.insertBefore(placeholder, container);
		document.body.appendChild(container);
		document.body.style.setProperty("--prefab-preview-scroll-offset", `${-scrollY}px`);
		document.documentElement.classList.add("prefab-preview-fullscreen-open");
		document.body.classList.add("prefab-preview-fullscreen-open");
		const handleKeyDown = (event) => {
			if(event.key === "Escape") {
				fallbackFullscreenRef.current = false;
				setIsFallbackFullscreen(false);
				setIsFullscreen(false);
			}
		};
		window.addEventListener("keydown", handleKeyDown);

		return () => {
			window.removeEventListener("keydown", handleKeyDown);
			if(placeholder.parentNode) {
				placeholder.parentNode.replaceChild(container, placeholder);
			} else {
				container.remove();
			}

			document.documentElement.classList.remove("prefab-preview-fullscreen-open");
			document.body.classList.remove("prefab-preview-fullscreen-open");
			document.body.style.removeProperty("--prefab-preview-scroll-offset");
			window.scrollTo(scrollX, scrollY);
		};
	}, [isFallbackFullscreen]);

	const closeFallbackFullscreen = () => {
		fallbackFullscreenRef.current = false;
		setIsFallbackFullscreen(false);
		setIsFullscreen(false);
	};

	const openFallbackFullscreen = () => {
		fallbackFullscreenRef.current = true;
		setIsFallbackFullscreen(true);
		setIsFullscreen(true);
	};

	const toggleFullscreen = async () => {
		const container = containerRef.current;
		if(!container) {
			return;
		}

		if(fallbackFullscreenRef.current) {
			closeFallbackFullscreen();
			return;
		}

		const fullscreenElement = getFullscreenElement();
		if(fullscreenElement === container) {
			const exitFullscreen = document.exitFullscreen || document.webkitExitFullscreen || document.webkitCancelFullScreen;
			if(exitFullscreen) {
				try {
					await exitFullscreen.call(document);
				} catch {}
			}

			setIsFullscreen(false);
			return;
		}

		const requestFullscreen = container.requestFullscreen || container.webkitRequestFullscreen || container.webkitRequestFullScreen;
		if(requestFullscreen) {
			try {
				await requestFullscreen.call(container);
				const activeElement = getFullscreenElement();
				if(activeElement === container) {
					setIsFullscreen(true);
					return;
				}
			} catch {}
		}

		openFallbackFullscreen();
	};
	const progressLabel = progress ? t("prefabPreview.progress", { current: progress.current.toLocaleString(), total: progress.total.toLocaleString() }) : t("prefabPreview.loading");

	return (
		<div className={`prefab-preview ${status === "ready" ? "is-ready" : ""} ${isFallbackFullscreen ? "is-fallback-fullscreen" : ""}`} ref={containerRef}>
			{status !== "ready" ? (
				<div className="prefab-preview__status" role={status === "error" ? "alert" : "status"}>
					{status === "error" ? t("prefabPreview.error") : progressLabel}
				</div>
			) : null}
			
			<div className="prefab-preview__label">{t("prefabPreview.label")}</div>
			
			<button type="button" className="prefab-preview__fullscreen" onClick={toggleFullscreen} aria-label={isFullscreen ? t("prefabPreview.exitFullscreen") : t("prefabPreview.fullscreen")}>
				<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
					<path d={isFullscreen ? "M8 3v5a2 2 0 0 1-2 2H3M21 10h-3a2 2 0 0 1-2-2V3M3 14h3a2 2 0 0 1 2 2v5M21 14h-3a2 2 0 0 0-2 2v5" : "M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5"}/>
				</svg>
			</button>

			{status === "ready" ? (
				<div className={`prefab-preview__hints ${hasInteracted ? "is-hidden" : ""}`} aria-hidden={hasInteracted}>
					<div className="prefab-preview__hint">{t("prefabPreview.dragHint")}</div>
					
					<div className="prefab-preview__hint">{t("prefabPreview.zoomHint")}</div>
					
					<div className="prefab-preview__hint">{t("prefabPreview.panHint")}</div>
				</div>
			) : null}
		</div>
	);
}