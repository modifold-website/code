export default function ModJamEmptyState({ hasJams, t, onCreate }) {
	return (
		<div className="mod-jams-empty">
			<h2>{hasJams ? t("emptyFilteredTitle") : t("emptyTitle")}</h2>
			
			<p>{hasJams ? t("emptyFilteredDescription") : t("emptyDescription")}</p>
			
			<button className="button button--size-m button--type-primary" type="button" onClick={onCreate}>
				{t("createFirst")}
			</button>
		</div>
	);
}