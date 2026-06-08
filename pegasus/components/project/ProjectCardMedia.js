import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import UserName from "../ui/UserName";
import ProjectTags from "../ui/ProjectTags";
import Tooltip from "../ui/Tooltip";
import { getProjectPath } from "@/utils/projectRoutes";
const MAX_RGB_INT = 16777215;

const clampByte = (value) => Math.max(0, Math.min(255, Math.round(value)));

const intToRgb = (value) => ({
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
});

const rgbToHex = ({ r, g, b }) => `#${[r, g, b].map((channel) => clampByte(channel).toString(16).padStart(2, "0")).join("")}`;

const darkenRgb = (rgb, amount = 0.52) => ({
    r: rgb.r * (1 - amount),
    g: rgb.g * (1 - amount),
    b: rgb.b * (1 - amount),
});

export default function ProjectCardMedia({ project, actions = null, showFollowers = true }) {
    const t = useTranslations("ProjectCard");
    const locale = useLocale();
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

    const formatFullNumber = (num) => {
        return new Intl.NumberFormat(locale).format(Math.max(0, Number(num) || 0));
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

    const featuredImage = project?.gallery?.find((image) => image?.featured === 1) || project?.gallery?.[0] || null;
    const coverUrl = featuredImage?.url || null;
    const rawColor = project?.color;
    const hasRawColor = rawColor !== null && rawColor !== undefined && rawColor !== "";
    const parsedColor = hasRawColor ? Number(rawColor) : NaN;
    const hasProjectColor = Number.isFinite(parsedColor) && parsedColor >= 0 && parsedColor <= MAX_RGB_INT;
    const accentRgb = hasProjectColor ? intToRgb(parsedColor) : null;
    const accentHex = accentRgb ? rgbToHex(accentRgb) : null;
    const accentDarkHex = accentRgb ? rgbToHex(darkenRgb(accentRgb)) : null;
    const fallbackCoverStyle = !coverUrl && accentHex && accentDarkHex ? {
        "--media-cover-color": accentHex,
        "--media-cover-color-dark": accentDarkHex,
    } : undefined;

    return (
        <div className="media-project-card" id={project.slug}>
            <Link className="media-project-card__overlay" href={getProjectPath(project)} aria-label={project.title} />

            <div className={`media-project-cover ${!coverUrl ? "media-project-cover--fallback" : ""}`} style={fallbackCoverStyle}>
                {coverUrl && (
                    <img src={coverUrl} alt="" loading="lazy" />
                )}
            </div>

            <div className="media-project-body">
                <div className="media-project-header">
                    <img className="media-project-icon" alt={t("projectIconAlt", { title: project.title })} src={project.icon_url || "https://media.modifold.com/static/no-project-icon.svg"} />

                    <div className="media-project-header-text">
                        <div className="media-project-title-row">
                            <span className="media-project-title">{project.title}</span>
                            <span className="media-project-author">
                                {t("by")} <Link href={project.owner?.profile_url || `/user/${project.owner?.slug || ""}`}><UserName user={project.owner} /></Link>
                            </span>
                        </div>

                        <p className="media-project-description">{project.summary}</p>
                    </div>
                </div>

                <div className="media-project-center">
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
                    
                    {project?.tags?.length > 0 && (
                        <div className="media-project-tags">
                            <ProjectTags tags={project.tags} />
                        </div>
                    )}
                </div>

                <div className="media-project-stats">
                    <div className="media-project-stat" title={t("downloads")}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-download-icon lucide-download">
                            <path d="M12 15V3"/>
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                            <path d="m7 10 5 5 5-5"/>
                        </svg>
                        
                        <span>{formatNumber(project.downloads)}</span>
                    </div>

                    {showFollowers && (
                        <div className="media-project-stat" title={t("followers")}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-heart-icon lucide-heart">
                                <path d="M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5"/>
                            </svg>
                            
                            <span>{formatNumber(project.followers || 0)}</span>
                        </div>
                    )}

                    <div className="media-project-stat media-project-updated" title={formatDate(project.updated_at)}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" className="lucide lucide-heart-icon lucide-update">
                            <path d="M3 3v5h5"></path>
                            <path d="M3.05 13A9 9 0 1 0 6 5.3L3 8"></path>
                            <path d="M12 7v5l4 2"></path>
                        </svg>
                        
                        <span>{formatDate(project.updated_at)}</span>
                    </div>
                </div>

                {actions && (
                    <div className="media-project-actions">
                        {actions}
                    </div>
                )}
            </div>
        </div>
    );
}