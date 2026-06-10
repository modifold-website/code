"use client";

import Modal from "react-modal";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { getProjectPath } from "@/utils/projectRoutes";
import showOverTheTopDownloadAnimation from "@/components/ui/showOverTheTopDownloadAnimation";

Modal.setAppElement("body");

function getDependencyProjectPath(dependency) {
	if(!dependency?.project_slug) {
		return null;
	}

	return getProjectPath({
		slug: dependency.project_slug,
		project_type: dependency.project_type,
	});
}

function getDependencyVersionPath(dependency) {
	const projectPath = getDependencyProjectPath(dependency);
	if(!projectPath) {
		return null;
	}

	return dependency.version_id ? `${projectPath}/version/${dependency.version_id}` : projectPath;
}

function getDependencyDownloadHref(dependency) {
	if(!dependency?.project_slug || !dependency?.version_id) {
		return null;
	}

	return `${process.env.NEXT_PUBLIC_API_BASE}/projects/${dependency.project_slug}/versions/${dependency.version_id}/download`;
}

export default function VersionDownloadDependenciesModal({ isOpen, project, version, dependencies = [], onRequestClose }) {
	const t = useTranslations("ProjectPage.versions.downloadModal");
	const tProject = useTranslations("ProjectPage");
	const projectIconUrl = project?.icon_url || "https://media.modifold.com/static/no-project-icon.svg";

	return (
		<Modal closeTimeoutMS={150} isOpen={isOpen} onRequestClose={onRequestClose} className="modal active version-download-modal" overlayClassName="modal-overlay">
			<div className="modal-window">
				<div className="modal-window__header version-download-modal__header">
					<div className="version-download-modal__project">
						<img src={projectIconUrl} alt="" width="32" height="32" className="version-download-modal__project-icon" />

						<div className="version-download-modal__project-text">
							<h2 className="modal-window__title">{project?.title || tProject("projectNotFound")}</h2>
						</div>
					</div>

					<button className="icon-button modal-window__close" type="button" onClick={onRequestClose} aria-label={tProject("close")}>
						<svg className="icon icon--cross" height="24" width="24">
							<path fillRule="evenodd" clipRule="evenodd" d="M5.293 5.293a1 1 0 0 1 1.414 0L12 10.586l5.293-5.293a1 1 0 0 1 1.414 1.414L13.414 12l5.293 5.293a1 1 0 0 1-1.414 1.414L12 13.414l-5.293 5.293a1 1 0 0 1-1.414-1.414L10.586 12 5.293 6.707a1 1 0 0 1 0-1.414Z" />
						</svg>
					</button>
				</div>

				<div className="modal-window__content version-download-modal__content">
					<p className="version-download-modal__intro">{t("description")}</p>

					<div className="version-download-modal__dependencies">
						{dependencies.map((dependency, index) => {
							const dependencyName = dependency.project_title || dependency.project_slug || dependency.project_id || tProject("versions.dependencies.unknownDependency");
							const dependencyVersion = dependency.version_number || dependency.version_name || dependency.version_id || t("anyVersion");
							const dependencyIconUrl = dependency.project_icon_url || "https://media.modifold.com/static/no-project-icon.svg";
							const dependencyHref = getDependencyVersionPath(dependency);
							const dependencyDownloadHref = getDependencyDownloadHref(dependency);

							return (
								<div key={`${dependency.project_id || dependency.project_slug || "dependency"}:${dependency.version_id || "any"}:${index}`} className="version-download-modal__dependency">
									<img src={dependencyIconUrl} alt="" width="44" height="44" loading="lazy" className="version-download-modal__dependency-icon" />

									<div className="version-download-modal__dependency-main">
										<p>{dependencyName}</p>
										<span>{dependencyVersion}</span>
									</div>

									<div className="version-download-modal__dependency-actions">
										{dependencyDownloadHref && (
											<a className="button button--size-m button--type-download button-with-icon button--active-transform" href={dependencyDownloadHref} onClick={showOverTheTopDownloadAnimation}>
												<svg className="masthead-stats__icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
													<path d="M12 15V3" />
													<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
													<path d="m7 10 5 5 5-5" />
												</svg>

												{tProject("download")}
											</a>
										)}

										{dependencyHref && (
											<Link href={dependencyHref} className="icon-button button--active-transform" onClick={onRequestClose} aria-label={t("openDependency", { dependency: dependencyName })}>
												<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
													<path d="M15 3h6v6"/>
													<path d="M10 14 21 3"/>
													<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
												</svg>
											</Link>
										)}
									</div>
								</div>
							);
						})}
					</div>

				</div>
			</div>
		</Modal>
	);
}