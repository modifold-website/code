"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import VersionDownloadDependenciesModal from "@/modal/VersionDownloadDependenciesModal";
import showOverTheTopDownloadAnimation from "@/components/ui/showOverTheTopDownloadAnimation";

const DOWNLOAD_MODAL_DELAY_MS = 2300;

function getRequiredDependencies(version) {
	if(!Array.isArray(version?.dependencies)) {
		return [];
	}

	return version.dependencies.filter((dependency) => {
		const dependencyType = String(dependency?.dependency_type || dependency?.type || "required").trim().toLowerCase();
		return dependencyType === "required";
	});
}

export default function VersionDownloadButton({ project, version, href, className, style, ariaLabel, children }) {
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [resolvedVersion, setResolvedVersion] = useState(null);
	const [isCheckingDependencies, setIsCheckingDependencies] = useState(false);
	const modalTimerRef = useRef(null);
	const displayVersion = resolvedVersion || version;
	const requiredDependencies = useMemo(() => getRequiredDependencies(displayVersion), [displayVersion]);
	const hasRequiredDependencies = requiredDependencies.length > 0;
	const dependenciesKnown = Array.isArray(displayVersion?.dependencies);

	useEffect(() => {
		return () => {
			if(modalTimerRef.current) {
				window.clearTimeout(modalTimerRef.current);
			}
		};
	}, []);

	const startDownload = () => {
		showOverTheTopDownloadAnimation();
		window.location.href = href;
	};

	const openModalAfterDownloadAnimation = () => {
		if(modalTimerRef.current) {
			window.clearTimeout(modalTimerRef.current);
		}

		modalTimerRef.current = window.setTimeout(() => {
			setIsModalOpen(true);
			modalTimerRef.current = null;
		}, DOWNLOAD_MODAL_DELAY_MS);
	};

	const fetchVersionDetails = async () => {
		const versionId = version?.id || version?.version_number;
		if(!project?.slug || !versionId) {
			return null;
		}

		const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE}/projects/${project.slug}/version/${versionId}`, {
			headers: { Accept: "application/json" },
		});

		if(!response.ok) {
			return null;
		}

		return response.json();
	};

	const handleClick = async (event) => {
		if(hasRequiredDependencies) {
			event.preventDefault();
			startDownload();
			openModalAfterDownloadAnimation();
			return;
		}

		if(dependenciesKnown) {
			showOverTheTopDownloadAnimation();
			return;
		}

		event.preventDefault();
		if(isCheckingDependencies) {
			return;
		}

		setIsCheckingDependencies(true);

		try {
			const detailedVersion = await fetchVersionDetails();
			const detailedRequiredDependencies = getRequiredDependencies(detailedVersion);

			if(detailedVersion && detailedRequiredDependencies.length > 0) {
				setResolvedVersion(detailedVersion);
				startDownload();
				openModalAfterDownloadAnimation();
				return;
			}

			startDownload();
		} catch {
			startDownload();
		} finally {
			setIsCheckingDependencies(false);
		}
	};

	return (
		<>
			<a className={className} style={style} href={href} onClick={handleClick} aria-label={ariaLabel} aria-busy={isCheckingDependencies}>
				{children}
			</a>

			{hasRequiredDependencies && (
				<VersionDownloadDependenciesModal
					isOpen={isModalOpen}
					project={project}
					version={displayVersion}
					dependencies={requiredDependencies}
					onRequestClose={() => setIsModalOpen(false)}
				/>
			)}
		</>
	);
}