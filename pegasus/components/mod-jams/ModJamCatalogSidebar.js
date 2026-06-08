export default function ModJamCatalogSidebar({ filters, activeFilter, title, createLabel, onFilterSelect, onCreate }) {
	return (
		<aside className="issues-left-rail">
			<div className="content content--padding">
				<h2>{title}</h2>
				
				<div className="issues-sidebar-actions">
					{filters.map((item) => {
						const isActive = activeFilter === item.key;
						return (
							<button key={item.key} type="button" className={`issues-filter-link mod-jams-filter-button ${isActive ? "issues-filter-link--active" : ""}`} aria-current={isActive ? "page" : undefined} data-ripple onClick={() => onFilterSelect(item.key)}>
								<span className="issues-filter-link__left">
									{item.key === "active" ? (
										<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
											<path d="M12 6v6l4 2"></path>
											<circle cx="12" cy="12" r="10"></circle>
										</svg>
									) : (
										<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
											<circle cx="12" cy="12" r="10"></circle>
											<path d="m9 12 2 2 4-4"></path>
										</svg>
									)}
									
									<span>{item.label}</span>
								</span>

								<span className="issues-filter-link__count">{item.count}</span>
							</button>
						);
					})}
				</div>
			</div>

			<div className="content content--padding">
				<div className="issues-sidebar-actions" style={{ gap: "8px" }}>
					<button className="button button--size-m button--type-primary button--active-transform button--with-icon" type="button" data-ripple onClick={onCreate}>
						<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
							<path d="M5 12h14"></path>
							<path d="M12 5v14"></path>
						</svg>

						{createLabel}
					</button>
				</div>
			</div>
		</aside>
	);
}