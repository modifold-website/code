import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import UserName from "../ui/UserName";
import ProjectTags from "../ui/ProjectTags";
import Tooltip from "../ui/Tooltip";
import { getProjectPath } from "@/utils/projectRoutes";

export default function ProjectCard({ project, maxTags = 5, actions = null }) {
    const t = useTranslations("ProjectCard");
    const locale = useLocale();
    const hasTags = project.tags?.length > 0;
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
    const playersLast14Days = Math.max(0, Number(project?.players_last_14d) || 0);
    const showPlayersLast14Days = project?.show_players_last_14d === true || project?.show_players_last_14d === 1 || project?.show_players_last_14d === "1";

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = date - now;
        const seconds = Math.round(diffMs / 1000);
        const minutes = Math.round(seconds / 60);
        const hours = Math.round(minutes / 60);
        const days = Math.round(hours / 24);
        const months = Math.round(days / 30);
        const years = Math.round(days / 365);

        if(Math.abs(seconds) < 60) {
            return rtf.format(seconds, "second");
        }

        if(Math.abs(minutes) < 60) {
            return rtf.format(minutes, "minute");
        }

        if(Math.abs(hours) < 24) {
            return rtf.format(hours, "hour");
        }

        if(Math.abs(days) < 30) {
            return rtf.format(days, "day");
        }

        if(Math.abs(months) < 12) {
            return rtf.format(months, "month");
        }

        return rtf.format(years, "year");
    };

    const formatNumber = (num) => {
        if(num >= 1000000) {
            return `${(num / 1000000).toFixed(2)}M`;
        }

        if(num >= 1000) {
            return `${(num / 1000).toFixed(2)}K`;
        }

        return num;
    };

    const formatFullNumber = (num) => {
        return new Intl.NumberFormat(locale).format(Math.max(0, Number(num) || 0));
    };

    const getUpdatedTooltipDateOptions = (date) => {
        const options = {
            day: "numeric",
            month: "long",
            hour: "2-digit",
            minute: "2-digit",
        };

        if(date.getFullYear() !== new Date().getFullYear()) {
            options.year = "numeric";
        }

        return options;
    };

    const formatUpdatedTooltip = (dateString) => {
        const date = new Date(dateString);

        return `${t("updated")} ${new Intl.DateTimeFormat(locale, getUpdatedTooltipDateOptions(date)).format(date)}`;
    };

    return (
        <div className="new-project-card" id={project.slug}>
            <Link className="new-project-card__overlay" href={getProjectPath(project)} aria-label={project.title} />

            <div style={{ display: "flex", gap: "12px", borderBottom: hasTags ? "1px solid var(--theme-color-border)" : "none", paddingBottom: hasTags ? "12px" : "16px", paddingTop: "16px", paddingRight: "16px", paddingLeft: "16px" }}>
                <img className="new-project-icon" alt={t("projectIconAlt", { title: project.title })} src={project.icon_url || "https://media.modifold.com/static/no-project-icon.svg"} />

                <div className="new-project-info">
                    <div className="new-project-header">
                        <span className="new-project-title">{project.title}</span>
                        <span className="new-project-author">
                            {t("by")} <Link className="new-project-author__link" href={project.owner?.profile_url || `/user/${project.owner?.slug || ""}`}><UserName user={project.owner} /></Link>
                        </span>
                    </div>

                    <p className="new-project-description">{project.summary}</p>

                    <div className="new-project-bottom">
                        <div className="new-stat" style={{ fontWeight: "400" }}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-download-icon lucide-download">
                                <path d="M12 15V3"/><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                                <path d="m7 10 5 5 5-5"/>
                            </svg>

                            <Tooltip content={`${formatNumber(project.downloads)} ${t("downloads")}`}>
                                <span>{formatNumber(project.downloads)}</span>
                            </Tooltip>
                        </div>

                        {showPlayersLast14Days && (
                            <div className="new-project-players">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
                                    <path d="m5 3 14 9-14 9z"></path>
                                </svg>

                                <Tooltip content={t("playersLast14dTooltip", { count: formatFullNumber(playersLast14Days) })}>
                                    <span>{formatFullNumber(playersLast14Days)}</span>
                                </Tooltip>
                            </div>
                        )}

                        <div className="new-stat new-updated">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" className="lucide lucide-heart-icon lucide-update">
                                <path d="M3 3v5h5"></path>
                                <path d="M3.05 13A9 9 0 1 0 6 5.3L3 8"></path>
                                <path d="M12 7v5l4 2"></path>
                            </svg>

                            <Tooltip content={formatUpdatedTooltip(project.updated_at)}>
                                <span>{formatDate(project.updated_at)}</span>
                            </Tooltip>
                        </div>
                    </div>
                </div>

                {actions && (
                    <div className="new-project-actions">
                        {actions}
                    </div>
                )}
            </div>

            {hasTags && (
                <div className="new-project-tags" style={{ padding: "8px 16px" }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-tags-icon lucide-tags">
                        <path d="M13.172 2a2 2 0 0 1 1.414.586l6.71 6.71a2.4 2.4 0 0 1 0 3.408l-4.592 4.592a2.4 2.4 0 0 1-3.408 0l-6.71-6.71A2 2 0 0 1 6 9.172V3a1 1 0 0 1 1-1z"/>
                        <path d="M2 7v6.172a2 2 0 0 0 .586 1.414l6.71 6.71a2.4 2.4 0 0 0 3.191.193"/>
                        <circle cx="10.5" cy="6.5" r=".5" fill="currentColor"/>
                    </svg>

                    <ProjectTags limit={maxTags} tags={project.tags} />
                </div>
            )}
        </div>
    );
}