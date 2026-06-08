"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import LicenseModal from "../../modal/LicenseModal";
import ModJamVoteButton from "@/components/mod-jams/ModJamVoteButton";
import UserName from "../ui/UserName";
import { getProjectPath } from "@/utils/projectRoutes";
import { LICENSES } from "../Licenses";

function getLicenseDisplayName(license, unknownLicense) {
	const normalizedId = (license?.id || "").toString().toLowerCase();
	if(normalizedId === "arr" || normalizedId === "no-license") {
		return "ARR";
	}

	const matchedLicense = LICENSES.find((item) => {
		const candidates = [item.id, item.key, item.spdx, item.name].filter(Boolean).map((value) => value.toString().toLowerCase());
		return candidates.includes(normalizedId) || candidates.includes((license?.name || "").toString().toLowerCase());
	});

	return matchedLicense?.spdx || license?.spdx || license?.name || unknownLicense;
}

export default function ProjectSidebar({ project, authToken, showLicense = true, showLinks = true }) {
    const t = useTranslations("ProjectPage");
    const tLicense = useTranslations("LicenseModal");
    const locale = useLocale();
    const [showLicenseModal, setShowLicenseModal] = useState(false);
    const licenseToken = "__LICENSE__";
    const licenseName = getLicenseDisplayName(project?.license, tLicense("unknown"));
    const licensedAs = t("licensedAs", { license: licenseToken });
    const [licensedAsBefore, licensedAsAfter = ""] = licensedAs.split(licenseToken);
    const licensedHasToken = licensedAs.includes(licenseToken);

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString(locale, { day: "numeric", month: "short" });
    };

    const createdAtTime = project?.created_at ? new Date(project.created_at).getTime() : null;
    const updatedAtTime = project?.updated_at ? new Date(project.updated_at).getTime() : null;
    const hasValidDates = Number.isFinite(createdAtTime) && Number.isFinite(updatedAtTime);
    const isSameCreatedUpdated = hasValidDates ? createdAtTime === updatedAtTime : project?.created_at === project?.updated_at;
    const showUpdatedAt = Boolean(project?.updated_at) && !isSameCreatedUpdated;
    const projectPath = getProjectPath(project);
    
    return (
        <div style={{ display: "flex", gap: "15px", flexDirection: "column" }}>
            {project.mod_jam_participations?.length > 0 && (
                <div className="content content--padding">
                    <h2>Mod jams</h2>

                    <div className="mod-jam-project-participations">
                        {project.mod_jam_participations.map((jam) => (
                            <Fragment key={jam.submission_id || jam.id}>
                                <div className="mod-jam-project-participation">
                                    <div className="author author-card" style={{ "--1ebedaf6": "40px", display: "flex" }}>
                                        <Link className="author__avatar button--active-transform" href={`/jams/${jam.slug}`}>
                                            <div className="andropov-media andropov-media--rounded andropov-media--bordered andropov-media--loaded andropov-media--has-preview andropov-image" style={{ aspectRatio: "1.77778 / 1", width: "40px", height: "40px", maxWidth: "none", borderRadius: "8px" }}>
                                                <img src={jam.avatar_url} className="magnify" alt={t("ownerAvatarAlt", { username: jam.owner?.username })} />
                                            </div>
                                        </Link>

                                        <div className="author__main">
                                            <Link className="author__name" href={`/jams/${jam.slug}`}>
                                                {jam.title}
                                            </Link>
                                        </div>
                                    </div>
                                </div>

                                {jam.lifecycle === "voting_open" && (
                                    <ModJamVoteButton
                                        authToken={authToken}
                                        jamSlug={jam.slug}
                                        submissionId={jam.submission_id}
                                        disabled={!jam.can_vote}
                                        selected={Boolean(jam.user_voted_this_submission)}
                                        visibleWhenDisabled
                                        buttonType="secondary"
                                    />
                                )}
                            </Fragment>
                        ))}
                    </div>
                </div>
            )}

            <div className="content content--padding">
                <h2>{t("creators")}</h2>

                <div style={{ display: "flex", gap: "12px", flexDirection: "column" }}>
                    {project.owner?.type === "organization" ? (
                        <div className="author author-card" style={{ "--1ebedaf6": "40px" }}>
                            <Link className="author__avatar button--active-transform" href={project.owner?.profile_url || `/user/${project.owner?.slug}`}>
                                <div className="andropov-media andropov-media--rounded andropov-media--bordered andropov-media--loaded andropov-media--has-preview andropov-image" style={{ aspectRatio: "1.77778 / 1", width: "40px", height: "40px", maxWidth: "none", borderRadius: "8px" }}>
                                    <img src={project.owner.avatar} className="magnify" alt={t("ownerAvatarAlt", { username: project.owner.username })} />
                                </div>
                            </Link>

                            <div className="author__main">
                                <Link className="author__name" href={project.owner?.profile_url || `/user/${project.owner?.slug}`}>
                                    <UserName user={project.owner} />
                                </Link>
                            </div>

                            <div className="author__details">
                                <div className="comment__detail" style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                                    <svg style={{ fill: "none" }} xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon lucide lucide-building2-icon lucide-building-2">
                                        <path d="M10 12h4"></path>
                                        <path d="M10 8h4"></path>
                                        <path d="M14 21v-3a2 2 0 0 0-4 0v3"></path>
                                        <path d="M6 10H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-2"></path>
                                        <path d="M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16"></path>
                                    </svg>

                                    <time style={{ lineHeight: "normal" }}>
                                        {t("organizationOwner")}
                                    </time>
                                </div>
                            </div>
                        </div>
                    ) : project.members && project.members.length > 0 ? (
                        project.members.map((member) => (
                            <div key={member.user_id} className="author author-card" style={{ "--1ebedaf6": "40px" }}>
                                <Link className="author__avatar button--active-transform" href={`/user/${member.slug}`}>
                                    <div className="andropov-media andropov-media--rounded andropov-media--bordered andropov-media--loaded andropov-media--has-preview andropov-image" style={{ aspectRatio: "1.77778 / 1", width: "40px", height: "40px", maxWidth: "none" }}>
                                        <img src={member.avatar} className="magnify" alt={t("ownerAvatarAlt", { username: member.username })} />
                                    </div>
                                </Link>

                                <div className="author__main">
                                    <Link className="author__name" href={`/user/${member.slug}`}>
                                        <UserName user={member} />
                                    </Link>
                                </div>

                                <div className="author__details">
                                    <div className="comment__detail" style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                                        <time style={{ lineHeight: "normal" }}>{member.role}</time>

                                        {project.owner?.type !== "organization" && project.owner.slug === member.slug && (
                                            <svg style={{ fill: "none", color: "#f0a530" }} xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-crown-icon lucide-crown">
                                                <path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z" />
                                                <path d="M5 21h14" />
                                            </svg>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="author author-card" style={{ "--1ebedaf6": "40px" }}>
                            <Link className="author__avatar button--active-transform" href={project.owner?.profile_url || `/user/${project.owner?.slug}`}>
                                <div className="andropov-media andropov-media--rounded andropov-media--bordered andropov-media--loaded andropov-media--has-preview andropov-image" style={{ aspectRatio: "1.77778 / 1", width: "40px", height: "40px", maxWidth: "none" }}>
                                    <img src={project.owner.avatar} className="magnify" alt={t("ownerAvatarAlt", { username: project.owner.username })} />
                                </div>
                            </Link>

                            <div className="author__main">
                                <Link className="author__name" href={project.owner?.profile_url || `/user/${project.owner?.slug}`}>
                                    <UserName user={project.owner} />
                                </Link>
                            </div>

                            <div className="author__details">
                                <div className="comment__detail" style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                                    <time style={{ lineHeight: "normal" }}>{t("owner")}</time>

                                    <svg style={{ fill: "none", color: "#f0a530" }} xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-crown-icon lucide-crown">
                                        <path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z" />
                                        <path d="M5 21h14" />
                                    </svg>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="content content--padding">
                <h2>{t("detailsTitle")}</h2>

                <div className="details-list">
                    {showLicense && project?.license?.id && (
                        <div className="license">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-copyright-icon lucide-copyright">
                                <circle cx="12" cy="12" r="10"/>
                                <path d="M14.83 14.83a4 4 0 1 1 0-5.66"/>
                            </svg>

                            <span>
                                {licensedHasToken ? (
                                    <>
                                        {licensedAsBefore}
                                        <span style={{ color: "#1f68c0", cursor: "pointer" }} onClick={() => setShowLicenseModal(true)}>
                                            {licenseName}
                                        </span>
                                        {licensedAsAfter}
                                    </>
                                ) : (
                                    <>
                                        {licensedAs}{" "}
                                        <span style={{ color: "#1f68c0", cursor: "pointer" }} onClick={() => setShowLicenseModal(true)}>
                                            {licenseName}
                                        </span>
                                    </>
                                )}
                            </span>
                        </div>
                    )}

                    <div className="license">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-calendar-icon lucide-calendar">
                            <path d="M8 2v4"/>
                            <path d="M16 2v4"/>
                            <rect width="18" height="18" x="3" y="4" rx="2"/>
                            <path d="M3 10h18"/>
                        </svg>

                        <span>{t("created")} {formatDate(project.created_at)}</span>
                    </div>

                    {showUpdatedAt && (
                        <div className="license">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" className="lucide lucide-heart-icon lucide-update">
                                <path d="M3 3v5h5"/>
                                <path d="M3.05 13A9 9 0 1 0 6 5.3L3 8"/>
                                <path d="M12 7v5l4 2"/>
                            </svg>

                            <span>{t("updated")} {formatDate(project.updated_at)}</span>
                        </div>
                    )}

                    <div className="license">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-hash-icon lucide-hash">
                            <line x1="4" x2="20" y1="9" y2="9"/>
                            <line x1="4" x2="20" y1="15" y2="15"/>
                            <line x1="10" x2="8" y1="3" y2="21"/>
                            <line x1="16" x2="14" y1="3" y2="21"/>
                        </svg>

                        <span>{t("id")} {project.id}</span>
                    </div>
                </div>
            </div>

            {showLicense && project?.license?.id && (
                <LicenseModal isOpen={showLicenseModal} licenseId={project?.license?.id} onRequestClose={() => setShowLicenseModal(false)} />
            )}

            {showLinks && (project.issue_url || project.source_url || project.wiki_url || project.discord_url) && (
                <div className="content content--padding">
                    <h2>{t("links")}</h2>

                    <ul className="links-list">
                        {project.issue_url && (
                            <li>
                                <a href={project.issue_url} target="_blank" rel="noopener noreferrer">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0M12 9v4M12 17h.01"></path></svg>

                                    {t("reportIssues")}

                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>
                                </a>
                            </li>
                        )}

                        {project.source_url && (
                            <li>
                                <a href={project.source_url} target="_blank" rel="noopener noreferrer">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m10 20 4-16m4 4 4 4-4 4M6 16l-4-4 4-4"></path></svg>

                                    {t("viewSource")}

                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>
                                </a>
                            </li>
                        )}

                        {project.wiki_url && (
                            <li>
                                <a href={project.wiki_url} target="_blank" rel="noopener noreferrer">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2zM22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path></svg>

                                    {t("wiki")}

                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>
                                </a>
                            </li>
                        )}

                        {project.discord_url && (
                            <li>
                                <a href={project.discord_url} target="_blank" rel="noopener noreferrer">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="71" height="55" fill="none" viewBox="0 0 71 55" className="shrink" aria-hidden="true"><g clipPath="url(#a)"><path fill="currentColor" d="M60.105 4.898A58.6 58.6 0 0 0 45.653.415a.22.22 0 0 0-.233.11 41 41 0 0 0-1.8 3.697c-5.456-.817-10.885-.817-16.23 0-.485-1.164-1.201-2.587-1.828-3.697a.23.23 0 0 0-.233-.11 58.4 58.4 0 0 0-14.451 4.483.2.2 0 0 0-.095.082C1.578 18.73-.944 32.144.293 45.39a.24.24 0 0 0 .093.167c6.073 4.46 11.955 7.167 17.729 8.962a.23.23 0 0 0 .249-.082 42 42 0 0 0 3.627-5.9.225.225 0 0 0-.123-.312 39 39 0 0 1-5.539-2.64.228.228 0 0 1-.022-.378c.372-.279.744-.569 1.1-.862a.22.22 0 0 1 .23-.03c11.619 5.304 24.198 5.304 35.68 0a.22.22 0 0 1 .233.027c.356.293.728.586 1.103.865a.228.228 0 0 1-.02.378 36.4 36.4 0 0 1-5.54 2.637.227.227 0 0 0-.121.315 47 47 0 0 0 3.624 5.897.225.225 0 0 0 .249.084c5.801-1.794 11.684-4.502 17.757-8.961a.23.23 0 0 0 .092-.164c1.48-15.315-2.48-28.618-10.497-40.412a.18.18 0 0 0-.093-.084m-36.38 32.427c-3.497 0-6.38-3.211-6.38-7.156s2.827-7.156 6.38-7.156c3.583 0 6.438 3.24 6.382 7.156 0 3.945-2.827 7.156-6.381 7.156m23.593 0c-3.498 0-6.38-3.211-6.38-7.156s2.826-7.156 6.38-7.156c3.582 0 6.437 3.24 6.38 7.156 0 3.945-2.798 7.156-6.38 7.156"></path></g><defs><clipPath id="a"><path fill="#fff" d="M0 0h71v55H0z"></path></clipPath></defs></svg>

                                    {t("joinDiscord")}

                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>
                                </a>
                            </li>
                        )}
                    </ul>
                </div>
            )}
        </div>
    );
}