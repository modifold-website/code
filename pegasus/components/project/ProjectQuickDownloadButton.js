"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import VersionDownloadDependenciesModal from "@/modal/VersionDownloadDependenciesModal";

function parseGameVersions(value) {
	if(Array.isArray(value)) {
		return value.map((version) => String(version).trim()).filter(Boolean);
	}

	if(!value || String(value).trim() === "null") {
		return [];
	}

	return String(value).split(",").map((version) => version.trim()).filter(Boolean);
}

function getLatestVersionsByGameVersion(versions) {
	const latestVersions = new Map();
	const sortedVersions = [...versions].filter((version) => !version?.moderation_status || version.moderation_status === "approved").sort((left, right) => {
		const dateDifference = new Date(right.created_at).getTime() - new Date(left.created_at).getTime();
		return dateDifference || String(right.id || "").localeCompare(String(left.id || ""), undefined, { numeric: true });
	});

	sortedVersions.forEach((version) => {
		parseGameVersions(version.game_versions).forEach((gameVersion) => {
			if(!latestVersions.has(gameVersion)) {
				latestVersions.set(gameVersion, version);
			}
		});
	});

	return Array.from(latestVersions, ([gameVersion, version]) => ({ gameVersion, version })).sort((left, right) => right.gameVersion.localeCompare(left.gameVersion, undefined, { numeric: true, sensitivity: "base" }));
}

export default function ProjectQuickDownloadButton({ project, authToken }) {
	const t = useTranslations("ProjectPage");
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [isLoading, setIsLoading] = useState(false);
	const [loadError, setLoadError] = useState(false);
	const [downloadOptions, setDownloadOptions] = useState(null);
	const requestControllerRef = useRef(null);

	useEffect(() => {
		return () => {
			requestControllerRef.current?.abort();
		};
	}, []);

	const loadDownloadOptions = async () => {
		requestControllerRef.current?.abort();
		const controller = new AbortController();
		requestControllerRef.current = controller;
		setIsLoading(true);
		setLoadError(false);

		try {
			const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE}/projects/${encodeURIComponent(project.slug)}?versions_limit=100`, {
				headers: {
					Accept: "application/json",
					...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
				},
				signal: controller.signal,
			});

			if(!response.ok) {
				throw new Error(`Could not load project versions: ${response.status}`);
			}

			const data = await response.json();
			setDownloadOptions(getLatestVersionsByGameVersion(Array.isArray(data?.versions) ? data.versions : []));
		} catch(error) {
			if(error.name !== "AbortError") {
				setLoadError(true);
			}
		} finally {
			if(requestControllerRef.current === controller) {
				requestControllerRef.current = null;
				setIsLoading(false);
			}
		}
	};

	const handleOpen = () => {
		setIsModalOpen(true);

		if(downloadOptions === null && !isLoading) {
			loadDownloadOptions();
		}
	};

	return (
		<>
			<button type="button" className="button button--size-l button--with-icon button--type-download button--active-transform project-quick-download__trigger" onClick={handleOpen} aria-haspopup="dialog">
				<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
					<path d="M12 15V3" />
					<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
					<path d="m7 10 5 5 5-5" />
				</svg>

				{t("download")}
			</button>

			<VersionDownloadDependenciesModal
				isOpen={isModalOpen}
				project={project}
				quickDownloadOptions={downloadOptions || []}
				isLoading={isLoading}
				loadError={loadError}
				onRetry={loadDownloadOptions}
				onRequestClose={() => setIsModalOpen(false)}
			/>
		</>
	);
}