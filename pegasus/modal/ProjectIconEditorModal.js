"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Modal from "react-modal";
import axios from "axios";
import { useTranslations } from "next-intl";
import { toast } from "react-toastify";
import ProjectIconCanvas, { renderProjectIconThumbnail } from "@/components/project/ProjectIconCanvas";
import Checkbox from "@/components/ui/Checkbox";
import { loadCatalogs } from "@/utils/prefabViewer/BlockCatalog";

if(typeof window !== "undefined") {
	Modal.setAppElement("body");
}

const BACKGROUNDS = [
	{ id: "sunrise", from: "#ffb02e", to: "#ffe96a" },
	{ id: "coral", from: "#f04473", to: "#ff785b" },
	{ id: "sky", from: "#3b82f6", to: "#71d5ff" },
	{ id: "ocean", from: "#075985", to: "#38bdf8" },
	{ id: "aqua", from: "#0891b2", to: "#5eead4" },
	{ id: "lime", from: "#62d927", to: "#c5f55b" },
	{ id: "forest", from: "#059b57", to: "#59d563" },
	{ id: "violet", from: "#5b45f5", to: "#9d7bff" },
	{ id: "lavender", from: "#8b5cf6", to: "#d8b4fe" },
	{ id: "rose", from: "#e849a4", to: "#ff92c8" },
	{ id: "ruby", from: "#be123c", to: "#fb7185" },
	{ id: "peach", from: "#f97316", to: "#fdba74" },
	{ id: "sand", from: "#a16207", to: "#fde68a" },
	{ id: "slate", from: "#334155", to: "#94a3b8" },
	{ id: "midnight", from: "#111827", to: "#475569" },
];
const CUSTOM_BACKGROUND_ID = "custom";
const DEFAULT_CUSTOM_BACKGROUND = { from: "#e5f0ff", to: "#c9dffc" };
const DEFAULT_CAMERA_SETTINGS = { zoom: 0.8, focus: 0 };
const DEFAULT_SCENE_SETTINGS = { lightIntensity: 1, lightAngle: 35, softShadows: true };
const FILE_REQUEST_INTERVAL_MS = 250;
const FILE_REQUEST_MAX_RETRIES = 3;

const wait = (duration) => new Promise((resolve) => window.setTimeout(resolve, duration));

const getRetryDelay = (response, attempt) => {
	const retryAfter = response.headers.get("retry-after");
	const retryAfterSeconds = Number(retryAfter);
	if(Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
		return retryAfterSeconds * 1000;
	}

	const retryAt = Date.parse(retryAfter || "");
	if(Number.isFinite(retryAt)) {
		return Math.max(0, retryAt - Date.now());
	}

	return 1000 * (2 ** attempt);
};

const normalizeCatalogPath = (value) => String(value || "")
	.replace(/^https?:\/\/[^/]+\/hytale-assets\//i, "")
	.replace(/\\/g, "/")
	.replace(/^\/+/, "")
	.replace(/^Common\//i, "")
	.toLowerCase();

const officialAssetUrl = (value) => {
	const path = String(value || "").replace(/\\/g, "/").replace(/^\/+/, "");
	if(/^https?:\/\//i.test(path)) {
		return path;
	}

	return `https://cdn.modifold.com/hytale-assets/${path.startsWith("Common/") ? path : `Common/${path}`}`;
};

const appendTexturePaths = (value, output) => {
	if(typeof value === "string" && value) {
		output.push(value);
		return;
	}

	if(Array.isArray(value)) {
		for(const entry of value) appendTexturePaths(entry, output);
		return;
	}

	if(value && typeof value === "object") {
		if(typeof value.Texture === "string") output.push(value.Texture);
		else if(typeof value.texture === "string") output.push(value.texture);
		else for(const entry of Object.values(value)) appendTexturePaths(entry, output);
	}
};

const collectDefinitionMatches = (definition, inherited, matches, depth = 0) => {
	if(!definition || typeof definition !== "object" || depth > 3) {
		return;
	}

	const modelPath = definition.customModel || definition.itemModel || inherited.modelPath || null;
	const texturePaths = [];
	appendTexturePaths(definition.customModelTexture, texturePaths);
	appendTexturePaths(definition.itemTexture, texturePaths);
	appendTexturePaths(definition.textures, texturePaths);

	for(const texturePath of texturePaths) {
		if(typeof texturePath === "string" && texturePath) {
			matches.push({ texturePath, modelPath });
		}
	}

	for(const collection of [definition.states, definition.variants]) {
		if(!collection || typeof collection !== "object") {
			continue;
		}

		for(const child of Object.values(collection)) {
			collectDefinitionMatches(child, { modelPath }, matches, depth + 1);
		}
	}
};

const normalizeRangeValue = (value, min, max, step) => {
	const precision = String(step).split(".")[1]?.length || 0;
	const steppedValue = min + Math.round((Math.min(max, Math.max(min, value)) - min) / step) * step;

	return Number(steppedValue.toFixed(precision));
};

function RangeSlider({ label, value, min, max, step, formatValue, onChange }) {
	const progress = ((value - min) / (max - min)) * 100;
	const valueText = formatValue(value);

	const updateFromPointer = (event) => {
		const bounds = event.currentTarget.getBoundingClientRect();
		const ratio = Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width));
		onChange(normalizeRangeValue(min + ratio * (max - min), min, max, step));
	};

	const handlePointerDown = (event) => {
		event.preventDefault();
		event.currentTarget.focus();
		event.currentTarget.setPointerCapture(event.pointerId);
		updateFromPointer(event);
	};

	const handlePointerMove = (event) => {
		if(event.currentTarget.hasPointerCapture(event.pointerId)) {
			updateFromPointer(event);
		}
	};

	const handleKeyDown = (event) => {
		const direction = event.key === "ArrowRight" || event.key === "ArrowUp" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowDown" ? -1 : 0;
		if(direction) {
			event.preventDefault();
			onChange(normalizeRangeValue(value + step * direction, min, max, step));
			return;
		}

		if(event.key === "Home" || event.key === "End") {
			event.preventDefault();
			onChange(event.key === "Home" ? min : max);
		}
	};

	return (
		<div className="project-icon-editor__range">
			<span>{label}<output>{valueText}</output></span>
			<div className="project-icon-editor__slider" role="slider" tabIndex={0} aria-label={label} aria-valuemin={min} aria-valuemax={max} aria-valuenow={value} aria-valuetext={valueText} style={{ "--range-progress": `${progress}%` }} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onKeyDown={handleKeyDown}>
				<div className="project-icon-editor__slider-track" aria-hidden="true">
					<div className="project-icon-editor__slider-fill" />
				</div>
				<div className="project-icon-editor__slider-thumb" aria-hidden="true" />
			</div>
		</div>
	);
}

const resolveVanillaOverrides = (textureOverrides, blocks) => {
	const overridesByPath = new Map(textureOverrides.map((texture) => [normalizeCatalogPath(texture.texture_path), texture]));
	const resolved = [];
	const seen = new Set();

	for(const [blockName, definition] of Object.entries(blocks || {})) {
		const matches = [];
		collectDefinitionMatches(definition, { modelPath: null }, matches);
		for(const match of matches) {
			const override = overridesByPath.get(normalizeCatalogPath(match.texturePath));
			if(!override) {
				continue;
			}

			const key = `${match.modelPath || "cube"}:${override.texture_path}`;
			if(seen.has(key)) {
				continue;
			}

			seen.add(key);
			resolved.push({
				id: `vanilla-${override.id}-${resolved.length}`,
				kind: match.modelPath ? "model" : "cube",
				name: blockName.replace(/_/g, " "),
				official_model_path: match.modelPath,
				texture_path: override.texture_path,
				thumbnail_path: null,
				source: "override",
			});
		}
	}

	return resolved;
};

function AssetThumbnail({ asset, getEntryUrl, alt }) {
	const rootRef = useRef(null);
	const [source, setSource] = useState("");
	const [visible, setVisible] = useState(false);

	useEffect(() => {
		if(!rootRef.current || typeof IntersectionObserver === "undefined") {
			setVisible(true);
			return undefined;
		}

		const observer = new IntersectionObserver(([entry]) => {
			if(entry.isIntersecting) {
				setVisible(true);
				observer.disconnect();
			}
		}, { rootMargin: "120px" });

		observer.observe(rootRef.current);
		return () => observer.disconnect();
	}, []);

	useEffect(() => {
		let active = true;
		if(!visible) {
			return undefined;
		}

		const modelRequest = asset.kind === "cube"
			? Promise.resolve(null)
			: asset.official_model_path
			? Promise.resolve(officialAssetUrl(asset.official_model_path))
			: getEntryUrl(asset.model_path);
		const textureRequest = asset.texture_path ? getEntryUrl(asset.texture_path) : Promise.resolve(null);

		Promise.all([modelRequest, textureRequest]).then(([modelUrl, textureUrl]) => {
			return renderProjectIconThumbnail({
				kind: asset.kind,
				modelUrl,
				textureUrl,
				sourcePath: asset.model_path || asset.official_model_path || "",
			});
		}).then((url) => {
			if(active) {
				setSource(url);
			}
		}).catch(() => {});

		return () => {
			active = false;
		};
	}, [asset, getEntryUrl, visible]);

	if(!source) {
		return (
			<span ref={rootRef} className="project-icon-editor__asset-thumbnail">
				<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-box">
					<path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/>
					<path d="m3.3 7 8.7 5 8.7-5"/>
					<path d="M12 22V12"/>
				</svg>
			</span>
		);
	}

	return (
		<span ref={rootRef} className="project-icon-editor__asset-thumbnail">
			<img src={source} alt={alt} loading="lazy" />
		</span>
	);
}

export default function ProjectIconEditorModal({ isOpen, onRequestClose, project, onSaved }) {
	const t = useTranslations("SettingsProjectPage.general.iconEditor");
	const canvasRef = useRef(null);
	const objectUrlsRef = useRef(new Map());
	const requestCacheRef = useRef(new Map());
	const nextFileRequestAtRef = useRef(0);
	const [manifest, setManifest] = useState(null);
	const [assets, setAssets] = useState([]);
	const [selectedAssetId, setSelectedAssetId] = useState("");
	const [selectedSource, setSelectedSource] = useState(null);
	const [backgroundId, setBackgroundId] = useState(BACKGROUNDS[0].id);
	const [customBackground, setCustomBackground] = useState(DEFAULT_CUSTOM_BACKGROUND);
	const [cameraSettings, setCameraSettings] = useState(DEFAULT_CAMERA_SETTINGS);
	const [sceneSettings, setSceneSettings] = useState(DEFAULT_SCENE_SETTINGS);
	const [snapshot, setSnapshot] = useState("");
	const [loading, setLoading] = useState(false);
	const [saving, setSaving] = useState(false);
	const [previewStatus, setPreviewStatus] = useState("loading");
	const apiBase = String(process.env.NEXT_PUBLIC_API_BASE || "").replace(/\/$/, "");
	const selectedAsset = useMemo(() => assets.find((asset) => asset.id === selectedAssetId) || null, [assets, selectedAssetId]);
	const background = useMemo(() => backgroundId === CUSTOM_BACKGROUND_ID
		? { id: CUSTOM_BACKGROUND_ID, ...customBackground }
		: BACKGROUNDS.find((preset) => preset.id === backgroundId) || BACKGROUNDS[0], [backgroundId, customBackground]);
	const fetchEntryFile = useCallback(async (url, options) => {
		const fetchAttempt = async (attempt) => {
			const now = Date.now();
			const requestAt = Math.max(now, nextFileRequestAtRef.current);
			nextFileRequestAtRef.current = requestAt + FILE_REQUEST_INTERVAL_MS;
			if(requestAt > now) {
				await wait(requestAt - now);
			}

			const response = await fetch(url, options);
			if(response.status !== 429 || attempt >= FILE_REQUEST_MAX_RETRIES) {
				return response;
			}

			await wait(getRetryDelay(response, attempt));
			return fetchAttempt(attempt + 1);
		};

		return fetchAttempt(0);
	}, []);

	const getEntryUrl = useCallback((entryPath) => {
		if(!entryPath || !manifest?.version?.id) {
			return Promise.reject(new Error("asset_path_missing"));
		}

		const key = `${manifest.version.id}:${entryPath}`;
		if(requestCacheRef.current.has(key)) {
			return requestCacheRef.current.get(key);
		}

		const request = fetchEntryFile(`${apiBase}/v2/icon-editor/${encodeURIComponent(project.slug)}/file?version=${encodeURIComponent(manifest.version.id)}&path=${encodeURIComponent(entryPath)}`, {
			headers: { Authorization: `Bearer ${localStorage.getItem("authToken")}` },
		}).then(async (response) => {
			if(!response.ok) {
				throw new Error("asset_fetch_failed");
			}

			const objectUrl = URL.createObjectURL(await response.blob());
			objectUrlsRef.current.set(key, objectUrl);
			return objectUrl;
		}).catch((error) => {
			requestCacheRef.current.delete(key);
			throw error;
		});

		requestCacheRef.current.set(key, request);
		return request;
	}, [apiBase, fetchEntryFile, manifest?.version?.id, project.slug]);

	useEffect(() => () => {
		for(const url of objectUrlsRef.current.values()) {
			URL.revokeObjectURL(url);
		}

		objectUrlsRef.current.clear();
		requestCacheRef.current.clear();
		nextFileRequestAtRef.current = 0;
	}, []);

	useEffect(() => {
		if(!isOpen) {
			return undefined;
		}

		let active = true;
		for(const url of objectUrlsRef.current.values()) {
			URL.revokeObjectURL(url);
		}

		objectUrlsRef.current.clear();
		requestCacheRef.current.clear();
		nextFileRequestAtRef.current = 0;
		setLoading(true);
		setManifest(null);
		setAssets([]);
		setSelectedAssetId("");
		setSelectedSource(null);
		setBackgroundId(BACKGROUNDS[0].id);
		setCustomBackground(DEFAULT_CUSTOM_BACKGROUND);
		setCameraSettings(DEFAULT_CAMERA_SETTINGS);
		setSceneSettings(DEFAULT_SCENE_SETTINGS);
		setSnapshot("");
		setPreviewStatus("loading");

		const authToken = localStorage.getItem("authToken");
		Promise.all([
			axios.get(`${apiBase}/v2/icon-editor/${encodeURIComponent(project.slug)}/assets`, {
				headers: { Authorization: `Bearer ${authToken}` },
			}),
			loadCatalogs("https://cdn.modifold.com/hytale-assets").catch(() => ({ blocks: {} })),
		]).then(([response, catalogs]) => {
			if(!active) {
				return;
			}

			const payload = response.data;
			const modAssets = (payload.assets || []).map((asset) => ({ ...asset, source: "mod" }));
			const vanillaAssets = resolveVanillaOverrides(payload.texture_overrides || [], catalogs.blocks);
			const nextAssets = [...modAssets, ...vanillaAssets];
			setManifest(payload);
			setAssets(nextAssets);
			setSelectedAssetId(nextAssets[0]?.id || "");
			if(!nextAssets.length) setPreviewStatus("idle");
		}).catch((error) => {
			if(active) {
				setManifest({ error: error?.response?.data?.message || "" });
				setPreviewStatus("idle");
			}
		}).finally(() => {
			if(active) {
				setLoading(false);
			}
		});

		return () => {
			active = false;
		};
	}, [apiBase, isOpen, project.slug]);

	useEffect(() => {
		if(!selectedAsset || !manifest?.version?.id) {
			setSelectedSource(null);
			if(manifest) {
				setPreviewStatus("idle");
			}

			return undefined;
		}

		let active = true;
		setSelectedSource(null);
		setSnapshot("");
		setPreviewStatus("loading");
		const modelRequest = selectedAsset.kind === "cube"
			? Promise.resolve(null)
			: selectedAsset.official_model_path
			? Promise.resolve(officialAssetUrl(selectedAsset.official_model_path))
			: getEntryUrl(selectedAsset.model_path);
		const textureRequest = selectedAsset.texture_path ? getEntryUrl(selectedAsset.texture_path) : Promise.resolve(null);
		Promise.all([modelRequest, textureRequest]).then(([modelUrl, textureUrl]) => {
			if(!active) {
				return;
			}

			setSelectedSource({
				kind: selectedAsset.kind,
				modelUrl,
				textureUrl,
				sourcePath: selectedAsset.model_path || selectedAsset.official_model_path || "",
			});
		}).catch(() => {
			if(active) {
				setPreviewStatus("error");
			}
		});

		return () => {
			active = false;
		};
	}, [getEntryUrl, manifest?.version?.id, selectedAsset]);

	const selectAsset = (assetId) => {
		setSelectedAssetId(assetId);
	};

	const randomize = () => {
		if(!assets.length) {
			return;
		}

		const asset = assets[Math.floor(Math.random() * assets.length)];
		const nextBackground = BACKGROUNDS[Math.floor(Math.random() * BACKGROUNDS.length)];
		setBackgroundId(nextBackground.id);
		selectAsset(asset.id);
	};

	const resetView = () => {
		setCameraSettings(DEFAULT_CAMERA_SETTINGS);
		setSceneSettings(DEFAULT_SCENE_SETTINGS);
		canvasRef.current?.resetView(DEFAULT_CAMERA_SETTINGS);
	};

	const saveIcon = async () => {
		if(saving || previewStatus !== "ready") {
			return;
		}

		setSaving(true);

		try {
			const blob = await canvasRef.current.capture();
			const file = new File([blob], `${project.slug}-icon.webp`, { type: "image/webp" });
			const data = new FormData();
			data.append("icon", file);
			const response = await axios.put(`${apiBase}/projects/${encodeURIComponent(project.slug)}/icon`, data, {
				headers: {
					Authorization: `Bearer ${localStorage.getItem("authToken")}`,
					"Content-Type": "multipart/form-data",
				},
			});
			toast.success(t("saveSuccess"));
			onSaved?.(response.data?.icon_url || URL.createObjectURL(blob));
			onRequestClose();
		} catch(error) {
			toast.error(error?.response?.data?.message || t("saveError"));
		} finally {
			setSaving(false);
		}
	};

	return (
		<Modal closeTimeoutMS={150} isOpen={isOpen} onRequestClose={saving ? undefined : onRequestClose} className="modal active" overlayClassName="modal-overlay modal-overlay--icon-editor">
			<div className="modal-window project-icon-editor">
				<header className="modal-window__header project-icon-editor__header">
					<h2 className="modal-window__title">{t("title")}</h2>
					
					<button className="icon-button modal-window__close" type="button" onClick={onRequestClose} disabled={saving} aria-label={t("close")}>
						<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
							<path d="M18 6 6 18"></path>
							<path d="m6 6 12 12"></path>
						</svg>
					</button>
				</header>

				<div className="modal-window__content project-icon-editor__body">
					<aside className="project-icon-editor__preview-column">
						<div className="project-icon-editor__preview" style={{ "--icon-background": `linear-gradient(135deg, ${background.from}, ${background.to})` }}>
							{selectedSource ? <ProjectIconCanvas ref={canvasRef} asset={selectedSource} background={background} cameraSettings={cameraSettings} sceneSettings={sceneSettings} onSnapshot={setSnapshot} onStatusChange={setPreviewStatus} /> : null}
							
							{previewStatus === "loading" ? <span className="project-icon-editor__preview-status">{t("loadingPreview")}</span> : null}
							
							{previewStatus === "error" ? <span className="project-icon-editor__preview-status">{t("previewError")}</span> : null}
						</div>

						<div className="project-icon-editor__sizes" aria-hidden="true">
							{[48, 36, 24].map((size) => <span key={size} style={{ width: size, height: size, background: `linear-gradient(135deg, ${background.from}, ${background.to})` }}>{snapshot ? <img src={snapshot} alt="" /> : null}</span>)}
						</div>

						<div className="project-icon-editor__preview-actions">
							<button type="button" className="button button--size-l button--type-minimal button--with-icon button--active-transform" onClick={resetView} disabled={previewStatus !== "ready"}>
								<svg style={{ width: "20px", height: "20px" }} xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
									<path d="M3 12a9 9 0 1 0 3-6.7L3 8"></path>
									<path d="M3 3v5h5"></path>
								</svg>
								
								{t("resetView")}
							</button>

							<button type="button" className="button button--size-l button--type-minimal button--with-icon button--active-transform" onClick={randomize} disabled={!assets.length}>
								<svg style={{ width: "20px", height: "20px" }} xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
									<path d="m18 14 4 4-4 4"></path>
									<path d="m18 2 4 4-4 4"></path>
									<path d="M2 18h1.5a5 5 0 0 0 4-2l5-8a5 5 0 0 1 4-2H22"></path>
									<path d="M2 6h1.5a5 5 0 0 1 4 2l1 1.5"></path>
									<path d="M14.5 15.5a5 5 0 0 0 2 2.5H22"></path>
								</svg>
								
								{t("randomize")}
							</button>
						</div>
					</aside>

					<main className="project-icon-editor__controls">
						<section className="project-icon-editor__section">
							<h3>{t("background")}</h3>

							<div className="project-icon-editor__backgrounds" role="group" aria-label={t("background")}>
								{BACKGROUNDS.map((preset) => (
									<button key={preset.id} type="button" className={preset.id === backgroundId ? "is-selected" : ""} style={{ background: `linear-gradient(135deg in oklab, ${preset.from}, ${preset.to})` }} onClick={() => setBackgroundId(preset.id)} aria-pressed={preset.id === backgroundId} aria-label={t(`backgrounds.${preset.id}`)}>
										{preset.id === backgroundId ? <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12 4 4L19 6"></path></svg> : null}
									</button>
								))}

								<button type="button" className={backgroundId === CUSTOM_BACKGROUND_ID ? "is-selected" : ""} style={{ background: `linear-gradient(135deg in oklab, ${customBackground.from}, ${customBackground.to})` }} onClick={() => setBackgroundId(CUSTOM_BACKGROUND_ID)} aria-pressed={backgroundId === CUSTOM_BACKGROUND_ID} aria-label={t("backgrounds.custom")}>
									<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
										{backgroundId === CUSTOM_BACKGROUND_ID ? <path d="m5 12 4 4L19 6"></path> : <><path d="M12 5v14"></path><path d="M5 12h14"></path></>}
									</svg>
								</button>
							</div>

							{backgroundId === CUSTOM_BACKGROUND_ID ? (
								<div className="project-icon-editor__custom-gradient" role="group" aria-label={t("backgrounds.custom")}>
									<label>
										<span style={{ lineHeight: "1.2" }}>{t("gradientStart")}</span>

										<span className="project-icon-editor__color-control">
											<i style={{ background: customBackground.from }} aria-hidden="true" />
											
											<code>{customBackground.from.toUpperCase()}</code>
											
											<input type="color" value={customBackground.from} onChange={(event) => setCustomBackground((current) => ({ ...current, from: event.target.value }))} aria-label={t("gradientStart")} />
										</span>
									</label>

									<label>
										<span style={{ lineHeight: "1.2" }}>{t("gradientEnd")}</span>

										<span className="project-icon-editor__color-control">
											<i style={{ background: customBackground.to }} aria-hidden="true" />
											
											<code>{customBackground.to.toUpperCase()}</code>
											
											<input type="color" value={customBackground.to} onChange={(event) => setCustomBackground((current) => ({ ...current, to: event.target.value }))} aria-label={t("gradientEnd")} />
										</span>
									</label>
								</div>
							) : null}
						</section>

						<section className="project-icon-editor__section project-icon-editor__symbols">
							<div className="project-icon-editor__section-heading">
								<h3>{t("symbols")}</h3>
							</div>

							{loading ? <div className="project-icon-editor__message"><span className="project-icon-editor__loader" />{t("loadingAssets")}</div> : null}
							
							{!loading && manifest?.error !== undefined ? <div className="project-icon-editor__message project-icon-editor__message--error"><strong>{t("loadErrorTitle")}</strong><span>{manifest.error || t("loadError")}</span></div> : null}
							
							{!loading && manifest?.error === undefined && !assets.length ? <div className="project-icon-editor__message"><strong>{t("emptyTitle")}</strong><span>{t("emptyDescription")}</span></div> : null}
							
							{assets.length ? (
								<div className="project-icon-editor__asset-grid">
									{assets.map((asset) => (
										<button key={asset.id} type="button" className={asset.id === selectedAssetId ? "is-selected" : ""} onClick={() => selectAsset(asset.id)} aria-label={asset.name} aria-pressed={asset.id === selectedAssetId} title={asset.name}>
											<AssetThumbnail asset={asset} getEntryUrl={getEntryUrl} alt="" />
											
											{asset.id === selectedAssetId ? <i aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 4 4L19 6"></path></svg></i> : null}
										</button>
									))}
								</div>
							) : null}
						</section>

						<section className="project-icon-editor__section project-icon-editor__scene">
							<h3>{t("scene")}</h3>

							<div className="project-icon-editor__scene-controls">
								<RangeSlider label={t("zoom")} value={cameraSettings.zoom} min={0.7} max={1.8} step={0.05} formatValue={(value) => `${Math.round(value * 100)}%`} onChange={(value) => setCameraSettings((current) => ({ ...current, zoom: value }))} />

								<RangeSlider label={t("focus")} value={cameraSettings.focus} min={-0.45} max={0.45} step={0.05} formatValue={(value) => Math.round(value * 100)} onChange={(value) => setCameraSettings((current) => ({ ...current, focus: value }))} />

								<RangeSlider label={t("light")} value={sceneSettings.lightIntensity} min={0.4} max={1.6} step={0.05} formatValue={(value) => `${Math.round(value * 100)}%`} onChange={(value) => setSceneSettings((current) => ({ ...current, lightIntensity: value }))} />

								<RangeSlider label={t("lightAngle")} value={sceneSettings.lightAngle} min={-180} max={180} step={5} formatValue={(value) => `${Math.round(value)}°`} onChange={(value) => setSceneSettings((current) => ({ ...current, lightAngle: value }))} />

								<Checkbox checked={sceneSettings.softShadows} onChange={(checked) => setSceneSettings((current) => ({ ...current, softShadows: checked }))} ariaLabel={t("softShadows")} className="project-icon-editor__toggle">
									{t("softShadows")}
								</Checkbox>
							</div>
						</section>
					</main>
				</div>

				<footer className="project-icon-editor__footer">
					<p>
						<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
							<circle cx="12" cy="12" r="10"></circle>
							<path d="M12 16v-4"></path>
							<path d="M12 8h.01"></path>
						</svg>
						
						{t("footerHint")}
					</p>
					
					<div>
						<button type="button" className="button button--size-m button--type-minimal" onClick={onRequestClose} disabled={saving}>
							{t("cancel")}
						</button>
						
						<button type="button" className="button button--size-m button--type-primary button--with-icon" onClick={saveIcon} disabled={saving || previewStatus !== "ready"}>
							<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
								<path d="M15.2 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8.8L15.2 3Z"></path><path d="M17 21v-8H7v8"></path>
								<path d="M7 3v5h8"></path>
							</svg>
							
							{saving ? t("saving") : t("save")}
						</button>
					</div>
				</footer>
			</div>
		</Modal>
	);
}