"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Modal from "react-modal";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "react-toastify";
import { useAuth } from "@/components/providers/AuthProvider";
import { getProjectPath } from "@/utils/projectRoutes";

Modal.setAppElement("body");

export default function ModJamSubmitProjectModal({ isOpen, jam, authToken, submissions = [], onRequestClose }) {
	const t = useTranslations("ModJamsPage");
	const router = useRouter();
	const { user } = useAuth();
	const projectFieldRef = useRef(null);
	const [projects, setProjects] = useState([]);
	const [projectId, setProjectId] = useState("");
	const [loading, setLoading] = useState(false);
	const [loaded, setLoaded] = useState(false);
	const [isProjectPopoverOpen, setIsProjectPopoverOpen] = useState(false);
	const selectedProject = projects.find((project) => String(project.id) === String(projectId));
	const currentUserSubmission = user?.id ? submissions.find((submission) => Number(submission.submitter?.id) === Number(user.id)) : null;

	useEffect(() => {
		if(!isOpen) {
			setIsProjectPopoverOpen(false);
		}
	}, [isOpen]);

	useEffect(() => {
		const handleClickOutside = (event) => {
			if(projectFieldRef.current && !projectFieldRef.current.contains(event.target)) {
				setIsProjectPopoverOpen(false);
			}
		};

		document.addEventListener("mousedown", handleClickOutside);
		return () => {
			document.removeEventListener("mousedown", handleClickOutside);
		};
	}, []);

	const loadProjects = async () => {
		if(loading || loaded || !authToken) {
			return;
		}

		setLoading(true);

		try {
			const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE}/projects/user/projects?limit=100`, {
				headers: { Authorization: `Bearer ${authToken}` },
			});

			const data = await response.json().catch(() => ({}));
			if(!response.ok) {
				throw new Error(data?.message || t("submit.loadError"));
			}

			setProjects((data.projects || []).filter((project) => project.project_type === "mod"));
			setLoaded(true);
		} catch (error) {
			toast.error(error.message);
		} finally {
			setLoading(false);
		}
	};

	const openProjectPopover = () => {
		setIsProjectPopoverOpen(true);
		loadProjects();
	};

	const handleSelectProject = (project) => {
		setProjectId(project.id);
		setIsProjectPopoverOpen(false);
	};

	const submitProject = async () => {
		if(!projectId) {
			toast.error(t("submit.selectFirst"));
			return;
		}

		setLoading(true);
		
		try {
			const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE}/mod-jams/${jam.slug}/submissions`, {
				method: "POST",
				headers: {
					Authorization: `Bearer ${authToken}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ project_id: projectId }),
			});

			const data = await response.json().catch(() => ({}));
			if(!response.ok) {
				throw new Error(data?.message || t("submit.submitError"));
			}

			toast.success(t("submit.success"));
			onRequestClose();
			router.refresh();
		} catch (error) {
			toast.error(error.message);
		} finally {
			setLoading(false);
		}
	};

	return (
		<Modal closeTimeoutMS={150} isOpen={isOpen} onRequestClose={onRequestClose} className="modal active" overlayClassName="modal-overlay">
			<div className="modal-window">
				<div className="modal-window__header">
					<h2 className="modal-window__title">{t("submit.title")}</h2>

					<button className="icon-button modal-window__close" type="button" onClick={onRequestClose} aria-label={t("creation.close")}>
						<svg className="icon icon--cross" height="24" width="24">
							<path fillRule="evenodd" clipRule="evenodd" d="M5.293 5.293a1 1 0 0 1 1.414 0L12 10.586l5.293-5.293a1 1 0 0 1 1.414 1.414L13.414 12l5.293 5.293a1 1 0 0 1-1.414 1.414L12 13.414l-5.293 5.293a1 1 0 0 1-1.414-1.414L10.586 12 5.293 6.707a1 1 0 0 1 0-1.414Z"></path>
						</svg>
					</button>
				</div>

				<div className="modal-window__content">
					{!authToken ? (
						<p>{t("submit.loginHint")}</p>
					) : currentUserSubmission ? (
						<div className="mod-jam-submit-panel">
							<p>{t("submit.alreadySubmitted")}</p>
							
							{currentUserSubmission.project?.title && (
								<Link className="mod-jam-submitted-project" href={getProjectPath({ ...currentUserSubmission.project, project_type: "mod" })}>
									<img src={currentUserSubmission.project.icon_url || "https://media.modifold.com/static/no-project-icon.svg"} alt="" width="32" height="32" loading="lazy" />
									
									<strong>{currentUserSubmission.project.title}</strong>
								</Link>
							)}
						</div>
					) : (
						<div className="mod-jam-submit-panel">
							<p>{t("submit.chooseHint")}</p>

							<div className="field field--default mod-jam-project-picker" ref={projectFieldRef}>
								<label className="field__wrapper">
									<span className="field__wrapper-body">
										<input
											type="text"
											className="text-input"
											value={selectedProject?.title || ""}
											onClick={openProjectPopover}
											onFocus={() => {
												if(!isProjectPopoverOpen) {
													openProjectPopover();
												}
											}}
											placeholder={loading ? t("submit.loading") : t("submit.placeholder")}
											readOnly
											disabled={loading && !loaded}
											style={{ cursor: "pointer" }}
										/>
									</span>
								</label>

								{isProjectPopoverOpen && (
									<div className="popover mod-jam-project-picker__popover">
										<div className="context-list" data-scrollable>
											{loading && !loaded ? (
												<div className="context-list-option">
													<div className="context-list-option__label">{t("submit.loading")}</div>
												</div>
											) : projects.length === 0 ? (
												<div className="context-list-option">
													<div className="context-list-option__label">{t("submit.emptyProjects")}</div>
												</div>
											) : (
												projects.map((project) => (
													<div key={project.id} className={`context-list-option ${String(projectId) === String(project.id) ? "context-list-option--selected" : ""}`} style={{ "--press-duration": "140ms" }} onClick={() => handleSelectProject(project)}>
														<div className="context-list-option__label" style={{ display: "flex", alignItems: "center", gap: "10px" }}>
															<img
																src={project.icon_url || "https://media.modifold.com/static/no-project-icon.svg"}
																alt=""
																width="24"
																height="24"
																style={{ width: "24px", height: "24px", borderRadius: "8px", objectFit: "cover", flexShrink: 0 }}
																loading="lazy"
															/>

															<strong>{project.title}</strong>
														</div>
													</div>
												))
											)}
										</div>
									</div>
								)}
							</div>

							<div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "16px" }}>
								<button className="button button--size-m button--type-primary" type="button" disabled={loading || !projectId} onClick={submitProject}>
									{t("submit.action")}
								</button>
							</div>
						</div>
					)}
				</div>
			</div>
		</Modal>
	);
}