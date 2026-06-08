"use client";

import Modal from "react-modal";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "react-toastify";

Modal.setAppElement("body");

export default function ModJamVoteButton({ authToken, jamSlug, submissionId, nominations = [], userVotes = [], onVoted, disabled = false, selected = false, visibleWhenDisabled = false, buttonType = "minimal" }) {
	const t = useTranslations("ModJamsPage");
	const router = useRouter();
	const [isVoting, setIsVoting] = useState(false);
	const [hasVoted, setHasVoted] = useState(false);
	const [isNominationModalOpen, setIsNominationModalOpen] = useState(false);
	const hasNominations = nominations.length > 0;
	const isDisabled = disabled || isVoting || hasVoted || (!hasNominations && selected) || !authToken;
	const currentButtonType = selected ? "positive" : buttonType;
	const votedNominationIds = new Set(userVotes.map((vote) => Number(vote.nomination_id) || 0));

	if(!jamSlug || !submissionId || (!visibleWhenDisabled && (!authToken || hasVoted))) {
		return null;
	}

	const submitVote = async (nominationId = 0) => {
		setIsVoting(true);

		try {
			const payload = { submission_id: submissionId };
			if(hasNominations) {
				payload.nomination_id = nominationId;
			}

			const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE}/mod-jams/${jamSlug}/votes`, {
				method: "POST",
				headers: {
					Authorization: `Bearer ${authToken}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify(payload),
			});
			const data = await response.json().catch(() => ({}));

			if(!response.ok) {
				throw new Error(data?.message || t("vote.error"));
			}

			setHasVoted(!hasNominations);
			setIsNominationModalOpen(false);
			onVoted?.(nominationId);
			toast.success(t("vote.success"));
			router.refresh();
		} catch (error) {
			toast.error(error.message);
		} finally {
			setIsVoting(false);
		}
	};

	const vote = async (event) => {
		event.preventDefault();
		event.stopPropagation();

		if(isDisabled) {
			return;
		}

		if(hasNominations) {
			setIsNominationModalOpen(true);
			return;
		}

		await submitVote();
	};

	return (
		<>
			<button className={`button button--size-m button--type-${currentButtonType} button--active-transform button--with-icon mod-jam-vote-button`} type="button" onClick={vote} disabled={isDisabled} data-ripple="true">
				<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon lucide lucide-plus-icon lucide-plus">
					<path d="M5 12h14"></path>
					<path d="M12 5v14"></path>
				</svg>
				
				{isVoting || selected || hasVoted ? t("vote.voted") : t("vote.action")}
			</button>

			<Modal closeTimeoutMS={150} isOpen={isNominationModalOpen} onRequestClose={() => setIsNominationModalOpen(false)} className="modal active" overlayClassName="modal-overlay">
				<div className="modal-window">
					<div className="modal-window__header">
						<h2 className="modal-window__title">{t("vote.nominationTitle")}</h2>

						<button className="icon-button modal-window__close" type="button" onClick={() => setIsNominationModalOpen(false)} aria-label={t("creation.close")}>
							<svg className="icon icon--cross" height="24" width="24">
								<path fillRule="evenodd" clipRule="evenodd" d="M5.293 5.293a1 1 0 0 1 1.414 0L12 10.586l5.293-5.293a1 1 0 0 1 1.414 1.414L13.414 12l5.293 5.293a1 1 0 0 1-1.414 1.414L12 13.414l-5.293 5.293a1 1 0 0 1-1.414-1.414L10.586 12 5.293 6.707a1 1 0 0 1 0-1.414Z"></path>
							</svg>
						</button>
					</div>

					<div className="modal-window__content">
						<p className="mod-jam-vote-nomination-hint">{t("vote.nominationHint")}</p>

						<div className="mod-jam-vote-nominations">
							{nominations.map((nomination) => {
								const nominationId = Number(nomination.id);
								const hasVotedInNomination = votedNominationIds.has(nominationId);

								return (
									<button key={nomination.id} type="button" className="mod-jam-vote-nomination-option" disabled={isVoting || hasVotedInNomination} onClick={() => submitVote(nominationId)}>
										<p>{nomination.title}</p>

										{nomination.description && <span>{nomination.description}</span>}

										{hasVotedInNomination && <div className="mod-jam-vote-nomination-option__already-voted">{t("vote.nominationAlreadyVoted")}</div>}
									</button>
								);
							})}
						</div>
					</div>
				</div>
			</Modal>
		</>
	);
}