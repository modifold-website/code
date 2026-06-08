"use client";

import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useAuth } from "../providers/AuthProvider";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import ProjectCard from "@/components/project/ProjectCard";
import UserSettingsSidebar from "@/components/ui/UserSettingsSidebar";
import { clearLikesDashboardCache, getLikesDashboardCache, isLikesDashboardCacheFresh, setLikesDashboardCache } from "@/utils/likesDashboardCache";

export default function DashboardLikesClient({ initialProjects, initialTotalPages, initialPage, authToken }) {
	const t = useTranslations("LikesDashboardClient");
	const tSidebar = useTranslations("SettingsBlogPage.sidebar");
	const router = useRouter();
	const { isLoggedIn, user } = useAuth();
	const [projects, setProjects] = useState(initialProjects || []);
	const [loading, setLoading] = useState(false);
	const [currentPage, setCurrentPage] = useState(initialPage || 1);
	const [totalPages, setTotalPages] = useState(initialTotalPages || 1);
	const pageLimit = 20;

	const currentCacheEntry = useMemo(() => getLikesDashboardCache(currentPage, pageLimit), [currentPage, pageLimit]);

	useEffect(() => {
		if(initialPage === currentPage && initialProjects?.length >= 0) {
			setLikesDashboardCache(initialPage, pageLimit, {
				projects: initialProjects || [],
				totalPages: initialTotalPages || 1,
			});
		}
	}, [initialPage, initialProjects, initialTotalPages, currentPage, pageLimit]);

	useEffect(() => {
		if(!isLoggedIn) {
			router.push("/");
			return;
		}

		const fetchLikes = async ({ force = false } = {}) => {
			const cached = getLikesDashboardCache(currentPage, pageLimit);

			if(cached && !force) {
				setProjects(cached.projects || []);
				setTotalPages(cached.totalPages || 1);
			}

			if(cached && !force && isLikesDashboardCacheFresh(cached)) {
				return;
			}

			try {
				setLoading(true);

				const res = await axios.get(`${process.env.NEXT_PUBLIC_API_BASE}/users/me/likes`, {
					headers: {
						Authorization: `Bearer ${authToken}`,
					},
					params: {
						page: currentPage,
						limit: pageLimit,
					},
				});

				const nextProjects = res.data?.projects || [];
				const nextTotalPages = res.data?.totalPages || 1;

				setProjects(nextProjects);
				setTotalPages(nextTotalPages);
				setLikesDashboardCache(currentPage, pageLimit, {
					projects: nextProjects,
					totalPages: nextTotalPages,
				});
			} catch (err) {
				console.error("Error fetching liked projects:", err);
			} finally {
				setLoading(false);
			}
		};

		fetchLikes();
	}, [currentPage, authToken, isLoggedIn, router, pageLimit, currentCacheEntry]);

	useEffect(() => {
		const handleLikesChanged = async (event) => {
			const changedSlug = event?.detail?.projectSlug;
			const nextIsLiked = event?.detail?.isLiked;

			clearLikesDashboardCache();

			if(changedSlug && nextIsLiked === false) {
				setProjects((prev) => prev.filter((project) => project.slug !== changedSlug));
			}

			try {
				setLoading(true);
				const res = await axios.get(`${process.env.NEXT_PUBLIC_API_BASE}/users/me/likes`, {
					headers: {
						Authorization: `Bearer ${authToken}`,
					},
					params: {
						page: currentPage,
						limit: pageLimit,
					},
				});

				const nextProjects = res.data?.projects || [];
				const nextTotalPages = res.data?.totalPages || 1;

				setProjects(nextProjects);
				setTotalPages(nextTotalPages);
				setLikesDashboardCache(currentPage, pageLimit, {
					projects: nextProjects,
					totalPages: nextTotalPages,
				});
			} catch (err) {
				console.error("Error refreshing liked projects cache:", err);
			} finally {
				setLoading(false);
			}
		};

		window.addEventListener("likes:changed", handleLikesChanged);
		return () => window.removeEventListener("likes:changed", handleLikesChanged);
	}, [authToken, currentPage, pageLimit]);

	const getPageButtons = () => {
		const maxButtons = 10;
		let startPage = Math.max(1, currentPage - Math.floor(maxButtons / 2));
		let endPage = Math.min(totalPages, startPage + maxButtons - 1);

		if(endPage - startPage + 1 < maxButtons) {
			startPage = Math.max(1, endPage - maxButtons + 1);
		}

		const buttons = [];
		for(let i = startPage; i <= endPage; i++) {
			buttons.push(
				<button key={i} className={`button button--size-m pagination-button ${currentPage === i ? "button--type-primary" : "button--type-secondary"}`} onClick={() => setCurrentPage(i)} aria-current={currentPage === i ? "page" : undefined}>
					{i}
				</button>
			);
		}

		return buttons;
	};

	return (
		<div className="layout">
			<div className="page-content settings-page">
				<UserSettingsSidebar
					user={user}
					profileIconAlt={tSidebar("profileIconAlt")}
					mode="dashboard"
					labels={{
						projects: tSidebar("projects"),
						likes: tSidebar("likes"),
						organizations: tSidebar("organizations"),
						jams: tSidebar("jams"),
						notifications: tSidebar("notifications"),
						settings: tSidebar("settings"),
						apiTokens: tSidebar("apiTokens"),
						verification: tSidebar("verification"),
					}}
				/>

				<div className="settings-content">
					{loading ? (
						<div className="subsite-empty-feed">
							<p className="subsite-empty-feed__title">{t("loading")}</p>
						</div>
					) : projects.length > 0 ? (
						<div className="projects-grid">
							{projects.map((project) => (
								<ProjectCard key={project.id || project.slug} project={project} />
							))}
						</div>
					) : (
						<div className="notifications">
							<div className="subsite-empty-feed">
								<p className="subsite-empty-feed__title">{t("noLikes")}</p>
							</div>
						</div>
					)}

					{totalPages > 1 && (
						<div className="pagination-controls">
							<button className="button button--size-m button--type-secondary" onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))} disabled={currentPage === 1} aria-disabled={currentPage === 1}>
								{t("previous")}
							</button>

							{getPageButtons()}

							<button className="button button--size-m button--type-secondary" onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))} disabled={currentPage === totalPages} aria-disabled={currentPage === totalPages}>
								{t("next")}
							</button>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}