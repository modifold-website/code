"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import VersionDownloadDependenciesModal from "@/modal/VersionDownloadDependenciesModal";
import showOverTheTopDownloadAnimation from "@/components/ui/showOverTheTopDownloadAnimation";
import { trackVersionDownload } from "@/utils/projects/downloadTracking";

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
	const modalTimerRef = useRef(null);
	const requiredDependencies = useMemo(() => getRequiredDependencies(version), [version]);
	const hasRequiredDependencies = requiredDependencies.length > 0;

	useEffect(() => {
		return () => {
			if(modalTimerRef.current) {
				window.clearTimeout(modalTimerRef.current);
			}
		};
	}, []);

	const openModalAfterDownloadAnimation = () => {
		if(modalTimerRef.current) {
			window.clearTimeout(modalTimerRef.current);
		}

		modalTimerRef.current = window.setTimeout(() => {
			setIsModalOpen(true);
			modalTimerRef.current = null;
		}, DOWNLOAD_MODAL_DELAY_MS);
	};

	const handleClick = (event) => {
		if(!href) {
			event.preventDefault();
			return;
		}

		trackVersionDownload({ project, version });
		showOverTheTopDownloadAnimation();
		if(hasRequiredDependencies) {
			openModalAfterDownloadAnimation();
		}
	};

	return (
		<>
			<a className={className} style={style} href={href || undefined} download onClick={handleClick} aria-label={ariaLabel}>
				{children}
			</a>

			{hasRequiredDependencies && (
				<VersionDownloadDependenciesModal
					isOpen={isModalOpen}
					project={project}
					version={version}
					dependencies={requiredDependencies}
					onRequestClose={() => setIsModalOpen(false)}
				/>
			)}
		</>
	);
}