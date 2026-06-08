"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "react-toastify";
import ModJamCreationModal from "@/modal/ModJamCreationModal";
import ModJamCard from "@/components/ui/ModJamCard";
import ModJamCatalogHero from "@/components/mod-jams/ModJamCatalogHero";
import ModJamCatalogSidebar from "@/components/mod-jams/ModJamCatalogSidebar";
import ModJamEmptyState from "@/components/mod-jams/ModJamEmptyState";

export { default as ModJamCard } from "@/components/ui/ModJamCard";

export default function ModJamCatalog({ initialJams = [], authToken = "" }) {
	const t = useTranslations("ModJamsPage");
	const [filter, setFilter] = useState("active");
	const [isCreationModalOpen, setIsCreationModalOpen] = useState(false);
	const stats = useMemo(() => {
		const active = initialJams.filter((jam) => ["upcoming", "running", "submissions_open", "voting_pending", "voting_open"].includes(jam.lifecycle)).length;
		const completed = initialJams.filter((jam) => jam.lifecycle === "completed").length;

		return { active, completed };
	}, [initialJams]);

	const filteredJams = useMemo(() => {
		if(filter === "active") {
			return initialJams.filter((jam) => ["upcoming", "running", "submissions_open", "voting_pending", "voting_open"].includes(jam.lifecycle));
		}

		if(filter === "completed") {
			return initialJams.filter((jam) => jam.lifecycle === "completed");
		}

		return initialJams.filter((jam) => ["upcoming", "running", "submissions_open", "voting_pending", "voting_open"].includes(jam.lifecycle));
	}, [filter, initialJams]);

	const filters = [
		{ key: "active", label: t("filters.active"), count: stats.active },
		{ key: "completed", label: t("filters.completed"), count: stats.completed },
	];

	const openCreationModal = () => {
		if(!authToken) {
			toast.error(t("loginToCreate"));
			return;
		}

		setIsCreationModalOpen(true);
	};

	return (
		<>
			<div className="fixed-background-teleport-color" style={{ "--_color": "#8E85EE" }}></div>

			<div className="layout">
				<div className="page-content mod-jams-page">
					<ModJamCatalogHero t={t} onCreate={openCreationModal} />

					<div className="issues-shell">
						<ModJamCatalogSidebar filters={filters} activeFilter={filter} title={t("sidebar.status")} createLabel={t("create")} onFilterSelect={setFilter} onCreate={openCreationModal} />

						<section className="issues-content">
							{filteredJams.length > 0 ? (
								<div className="mod-jams-grid">
									{filteredJams.map((jam) => <ModJamCard key={jam.id} jam={jam} />)}
								</div>
							) : (
								<ModJamEmptyState hasJams={initialJams.length > 0} t={t} onCreate={openCreationModal} />
							)}
						</section>
					</div>
				</div>
			</div>

			<ModJamCreationModal isOpen={isCreationModalOpen} authToken={authToken} onRequestClose={() => setIsCreationModalOpen(false)} />
		</>
	);
}