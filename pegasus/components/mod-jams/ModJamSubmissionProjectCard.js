import ProjectCard from "@/components/project/ProjectCard";
import ProjectCardMedia from "@/components/project/ProjectCardMedia";
import ModJamVoteButton from "@/components/mod-jams/ModJamVoteButton";

export default function ModJamSubmissionProjectCard({ submission, cardView, jam, authToken, canVote, nominations = [], userVotes = [], onVoted, selected = false, showVoteButton = false, rank, showResult = false }) {
	const project = {
		...submission.project,
		project_type: "mod",
		downloads: submission.project.downloads || 0,
		updated_at: submission.project.updated_at || submission.created_at,
		tags: submission.project.tags || [],
		owner: submission.submitter,
	};
	const voteButton = showVoteButton ? (
		<ModJamVoteButton
			authToken={authToken}
			jamSlug={jam.slug}
			submissionId={submission.id}
			nominations={nominations}
			userVotes={userVotes}
			onVoted={(nominationId) => onVoted?.(submission.id, nominationId)}
			disabled={!canVote}
			selected={selected}
			visibleWhenDisabled
			buttonType="minimal"
		/>
	) : null;
	const resultRank = Number(rank) || null;
	const className = [
		"mod-jam-submission-item",
		`mod-jam-submission-item--${cardView === "media" ? "media" : "list"}`,
		showResult ? "mod-jam-submission-item--result" : null,
		resultRank ? `mod-jam-submission-item--rank-${Math.min(resultRank, 3)}` : null,
	].filter(Boolean).join(" ");

	return (
		<div className={className}>
			{showResult && resultRank && (
				<span className="mod-jam-submission-result-rank">#{resultRank}</span>
			)}

			{cardView === "media" ? <ProjectCardMedia project={project} actions={voteButton} showFollowers={false} /> : <ProjectCard project={project} actions={voteButton} />}
		</div>
	);
}