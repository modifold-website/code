"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import ModJamExternalLinks from "@/components/mod-jams/ModJamExternalLinks";
import ModJamJuryPanel from "@/components/mod-jams/ModJamJuryPanel";
import ModJamMasthead from "@/components/mod-jams/ModJamMasthead";
import ModJamMarkdownBlock from "@/components/mod-jams/ModJamMarkdownBlock";
import ModJamSubmissionProjectCard from "@/components/mod-jams/ModJamSubmissionProjectCard";
import ModJamTimeline from "@/components/mod-jams/ModJamTimeline";

function getColorHex(value) {
	if(value === null || value === undefined || value === "") {
		return null;
	}

	const color = Number(value);
	return Number.isFinite(color) ? `#${Math.max(0, Math.min(0xFFFFFF, Math.round(color))).toString(16).padStart(6, "0").toUpperCase()}` : null;
}

export default function ModJamPage({ jam, submissions = [], jury = [], nominations = [], authToken, permissions = {} }) {
	const t = useTranslations("ModJamsPage");
	const jamColorHex = getColorHex(jam.color);
	const hasKnownResults = jam.lifecycle === "completed";
	const hasNominations = nominations.length > 0;
	const [userVotes, setUserVotes] = useState(() => submissions.flatMap((submission) => (submission.user_votes || []).map((vote) => ({
		submission_id: submission.id,
		nomination_id: Number(vote.nomination_id) || 0,
	}))));
	const votedSubmissionId = userVotes.find((vote) => vote.nomination_id === 0)?.submission_id || null;
	const votedNominationIds = new Set(userVotes.map((vote) => Number(vote.nomination_id) || 0));
	const hasUserVoteInJam = hasNominations ? votedNominationIds.size >= nominations.length : Boolean(votedSubmissionId);

	useEffect(() => {
		setUserVotes(submissions.flatMap((submission) => (submission.user_votes || []).map((vote) => ({
			submission_id: submission.id,
			nomination_id: Number(vote.nomination_id) || 0,
		}))));
	}, [submissions]);

	const submissionResultRanks = useMemo(() => {
		if(!hasKnownResults) {
			return new Map();
		}

		return new Map([...submissions].sort((first, second) => {
			const votesDelta = (Number(second.votes_count) || 0) - (Number(first.votes_count) || 0);

			if(votesDelta !== 0) {
				return votesDelta;
			}

			return new Date(first.created_at).getTime() - new Date(second.created_at).getTime();
		}).map((submission, index) => [submission.id, index + 1]));
	}, [hasKnownResults, submissions]);

	const sortedSubmissions = useMemo(() => {
		const nextSubmissions = [...submissions];

		nextSubmissions.sort((first, second) => {
			if(hasKnownResults) {
				return (submissionResultRanks.get(first.id) || 0) - (submissionResultRanks.get(second.id) || 0);
			}

			const firstProject = {
				...first.project,
				project_type: "mod",
				downloads: first.project.downloads || 0,
				updated_at: first.project.updated_at || first.created_at,
				tags: first.project.tags || [],
				owner: first.submitter,
			};

			const secondProject = {
				...second.project,
				project_type: "mod",
				downloads: second.project.downloads || 0,
				updated_at: second.project.updated_at || second.created_at,
				tags: second.project.tags || [],
				owner: second.submitter,
			};

			return (Number(secondProject.downloads) || 0) - (Number(firstProject.downloads) || 0);
		});

		return nextSubmissions;
	}, [hasKnownResults, submissionResultRanks, submissions]);
	
	const nominationResultGroups = useMemo(() => {
		if(!hasKnownResults || !hasNominations) {
			return [];
		}

		return nominations.map((nomination) => {
			const nominationId = Number(nomination.id);
			const nominationSubmissions = [...submissions].map((submission) => ({
				submission,
				score: Number(submission.nomination_votes?.[nominationId]) || 0,
			})).filter((item) => item.score > 0).sort((first, second) => {
				const scoreDelta = second.score - first.score;

				if(scoreDelta !== 0) {
					return scoreDelta;
				}

				return new Date(first.submission.created_at).getTime() - new Date(second.submission.created_at).getTime();
			}).slice(0, 3).map((item) => item.submission);

			return {
				nomination,
				submissions: nominationSubmissions,
			};
		}).filter((group) => group.submissions.length > 0);
	}, [hasKnownResults, hasNominations, nominations, submissions]);

	const overallResultSubmissions = useMemo(() => {
		if(!hasKnownResults) {
			return [];
		}

		return sortedSubmissions.slice(0, 10);
	}, [hasKnownResults, sortedSubmissions]);

	const resultWinnerIds = useMemo(() => {
		const winnerIds = new Set();

		for(const submission of overallResultSubmissions) {
			winnerIds.add(Number(submission.id));
		}

		for(const group of nominationResultGroups) {
			for(const submission of group.submissions) {
				winnerIds.add(Number(submission.id));
			}
		}

		return winnerIds;
	}, [nominationResultGroups, overallResultSubmissions]);

	const remainingResultSubmissions = useMemo(() => {
		if(!hasKnownResults) {
			return [];
		}

		return sortedSubmissions.filter((submission) => !resultWinnerIds.has(Number(submission.id)));
	}, [hasKnownResults, resultWinnerIds, sortedSubmissions]);

	const handleVoted = (submissionId, nominationId = 0) => {
		setUserVotes((currentVotes) => {
			const normalizedNominationId = Number(nominationId) || 0;
			const nextVotes = currentVotes.filter((vote) => Number(vote.nomination_id) !== normalizedNominationId);
			return [...nextVotes, { submission_id: submissionId, nomination_id: normalizedNominationId }];
		});
	};

	return (
		<>
			{jamColorHex && (
				<div className="fixed-background-teleport-color" style={{ "--_color": jamColorHex }} />
			)}

			<div className="layout">
				<div className="page-content mod-jam-detail-page">
					<div className="project__general">
						<div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
							<div className="content content--padding">
								<h2>{t("detail.description")}</h2>

								<ModJamMarkdownBlock>{jam.description}</ModJamMarkdownBlock>
							</div>
							
							<ModJamTimeline jam={jam} />

							<section className="mod-jam-submissions-section">
								{submissions.length > 0 ? (
									hasKnownResults ? (
										<div className="mod-jam-results">
											{nominationResultGroups.map((group) => (
												<div key={group.nomination.id} className="mod-jam-results-group">
													<h2>{t("detail.bestByNomination", { title: group.nomination.title })}</h2>

													<div className="browse-project-grid mod-jam-submissions-list">
														{group.submissions.map((submission, index) => (
															<ModJamSubmissionProjectCard key={submission.id} submission={submission} cardView="media" jam={jam} authToken={authToken} nominations={nominations} rank={index + 1} showResult />
														))}
													</div>
												</div>
											))}

											<div className="mod-jam-results-group">
												<h2>{t("detail.bestByPoints")}</h2>

												<div className="browse-project-grid mod-jam-submissions-list">
													{overallResultSubmissions.map((submission) => (
														<ModJamSubmissionProjectCard key={submission.id} submission={submission} cardView="media" jam={jam} authToken={authToken} nominations={nominations} rank={submissionResultRanks.get(submission.id)} showResult />
													))}
												</div>
											</div>

											{remainingResultSubmissions.length > 0 && (
												<div className="mod-jam-results-group">
													<h2>{t("detail.otherProjects")}</h2>

													<div className="mod-jam-results-list">
														{remainingResultSubmissions.map((submission) => (
															<ModJamSubmissionProjectCard key={submission.id} submission={submission} cardView="list" jam={jam} authToken={authToken} nominations={nominations} />
														))}
													</div>
												</div>
											)}
										</div>
									) : (
										<div className="browse-project-grid mod-jam-submissions-list">
											{sortedSubmissions.map((submission) => (
												<ModJamSubmissionProjectCard
													key={submission.id}
													submission={submission}
													cardView="media"
													jam={jam}
													authToken={authToken}
													canVote={Boolean(permissions.can_vote && !hasUserVoteInJam)}
													nominations={nominations}
													userVotes={userVotes}
													onVoted={handleVoted}
													selected={userVotes.some((vote) => Number(vote.submission_id) === Number(submission.id)) || Number(votedSubmissionId) === Number(submission.id)}
													showVoteButton={Boolean(authToken && permissions.can_vote)}
												/>
											))}
										</div>
									)
								) : (
									<div className="subsite-empty-feed">
										<p className="subsite-empty-feed__title">{t("detail.emptySubmissions")}</p>
									</div>
								)}
							</section>
						</div>

						<aside className="mod-jam-sidebar">
							<ModJamMasthead jam={jam} permissions={permissions} submissionsCount={submissions.length} authToken={authToken} submissions={submissions} />

							<ModJamJuryPanel owner={jam.owner} jury={jury} />

							<div className="content content--padding">
								<h2>{t("detail.rules")}</h2>

								<ModJamMarkdownBlock>{jam.rules}</ModJamMarkdownBlock>
							</div>

							<ModJamExternalLinks links={jam.external_links} t={t} />
						</aside>
					</div>
				</div>
			</div>
		</>
	);
}