export default function ModJamExternalLinks({ links = {}, t }) {
	if(!links.discord && !links.website) {
		return null;
	}

	return (
		<div className="content content--padding">
			<h2>{t("links.title")}</h2>

			<ul className="links-list">
				{links.website && (
					<li>
						<a href={links.website} target="_blank" rel="noopener noreferrer">
							<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
								<circle cx="12" cy="12" r="10"></circle>
								<path d="M2 12h20"></path>
								<path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10"></path>
							</svg>

							{t("links.website")}

							<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
								<path d="M15 3h6v6"></path>
								<path d="M10 14 21 3"></path>
								<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
							</svg>
						</a>
					</li>
				)}

				{links.discord && (
					<li>
						<a href={links.discord} target="_blank" rel="noopener noreferrer">
							<svg xmlns="http://www.w3.org/2000/svg" width="71" height="55" fill="none" viewBox="0 0 71 55" className="shrink" aria-hidden="true">
								<g clipPath="url(#mod-jam-discord-icon)">
									<path fill="currentColor" d="M60.105 4.898A58.6 58.6 0 0 0 45.653.415a.22.22 0 0 0-.233.11 41 41 0 0 0-1.8 3.697c-5.456-.817-10.885-.817-16.23 0-.485-1.164-1.201-2.587-1.828-3.697a.23.23 0 0 0-.233-.11 58.4 58.4 0 0 0-14.451 4.483.2.2 0 0 0-.095.082C1.578 18.73-.944 32.144.293 45.39a.24.24 0 0 0 .093.167c6.073 4.46 11.955 7.167 17.729 8.962a.23.23 0 0 0 .249-.082 42 42 0 0 0 3.627-5.9.225.225 0 0 0-.123-.312 39 39 0 0 1-5.539-2.64.228.228 0 0 1-.022-.378c.372-.279.744-.569 1.1-.862a.22.22 0 0 1 .23-.03c11.619 5.304 24.198 5.304 35.68 0a.22.22 0 0 1 .233.027c.356.293.728.586 1.103.865a.228.228 0 0 1-.02.378 36.4 36.4 0 0 1-5.54 2.637.227.227 0 0 0-.121.315 47 47 0 0 0 3.624 5.897.225.225 0 0 0 .249.084c5.801-1.794 11.684-4.502 17.757-8.961a.23.23 0 0 0 .092-.164c1.48-15.315-2.48-28.618-10.497-40.412a.18.18 0 0 0-.093-.084m-36.38 32.427c-3.497 0-6.38-3.211-6.38-7.156s2.827-7.156 6.38-7.156c3.583 0 6.438 3.24 6.382 7.156 0 3.945-2.827 7.156-6.381 7.156m23.593 0c-3.498 0-6.38-3.211-6.38-7.156s2.826-7.156 6.38-7.156c3.582 0 6.437 3.24 6.38 7.156 0 3.945-2.798 7.156-6.38 7.156"></path>
								</g>
								<defs>
									<clipPath id="mod-jam-discord-icon">
										<path fill="#fff" d="M0 0h71v55H0z"></path>
									</clipPath>
								</defs>
							</svg>

							{t("links.discord")}

							<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
								<path d="M15 3h6v6"></path>
								<path d="M10 14 21 3"></path>
								<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
							</svg>
						</a>
					</li>
				)}
			</ul>
		</div>
	);
}