"use client";

import Link from "next/link";
import { getProjectPath } from "@/utils/projectRoutes";
import { useTranslations, useLocale } from "next-intl";
import VersionDisplay from "../VersionDisplay";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import ProjectSidebar from "../project/ProjectSidebar";
import VersionDownloadButton from "../project/VersionDownloadButton";

const getSafeMarkdownHref = (href) => {
    if(typeof href !== "string") {
        return null;
    }

    if(href.startsWith("/") || href.startsWith("#")) {
        return href;
    }

    try {
        const parsed = new URL(href);
        if(!["http:", "https:", "mailto:"].includes(parsed.protocol)) {
            return null;
        }

        return parsed.toString();
    } catch {
        return null;
    }
};

export default function VersionPage({ project, version, authToken }) {
    const t = useTranslations("ProjectPage");
    const locale = useLocale();

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleString(locale, {
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
        });
    };

    const primaryFile = version.files?.find((file) => file.primary) || version.files?.[0];
    const versionDisplayName = version.name || version.version_number;
    const releaseChannel = typeof version.release_channel === "string" ? version.release_channel.trim().toLowerCase() : "";
    const knownReleaseChannels = ["release", "beta", "alpha"];
    const hasKnownReleaseChannel = knownReleaseChannels.includes(releaseChannel);
    const releaseChannelLabel = hasKnownReleaseChannel ? t(`versions.channels.${releaseChannel}`) : (version.release_channel || t("versions.notSpecified"));
	const dependencies = Array.isArray(version.dependencies) ? version.dependencies : [];
	const hasChangelog = Boolean(version.changelog);
	const hasDependencies = dependencies.length > 0;
	const versionPageClassName = [
		"version-page",
		!hasChangelog ? "version-page--no-changelog" : null,
		!hasDependencies ? "version-page--no-dependencies" : null,
	].filter(Boolean).join(" ");

    const formatDependencyType = (dependencyType) => {
        const normalized = String(dependencyType || "").trim().toLowerCase();
        if(!["required", "optional", "incompatible", "embedded"].includes(normalized)) {
            return t("versions.dependencies.types.required");
        }

        return t(`versions.dependencies.types.${normalized}`);
    };

    return (
        <>
            <div className="project__general">
                <div>
                    <div className={versionPageClassName}>
                        <div className="version-page__title content content--padding">
                            <div className="version-page__breadcrumb">
                                <Link href={`${getProjectPath(project)}/versions`} className="version-page__back-link button--active-transform">
                                    {t("backToVersions")}
                                </Link>

                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-chevron-right-icon lucide-chevron-right">
                                    <path d="m9 18 6-6-6-6"/>
                                </svg>

                                <span className="version-page__breadcrumb-current">
                                    {versionDisplayName}
                                </span>
                            </div>

                            <div className="version-header">
                                <h2>{versionDisplayName}</h2>
                            </div>

                            <div className="input-group">
                                {primaryFile && (
                                    <VersionDownloadButton project={project} version={version} className="button button--size-m button--type-primary" href={`${process.env.NEXT_PUBLIC_API_BASE}/projects/${project.slug}/versions/${version.id}/download`}>
                                        <svg className="masthead-stats__icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M12 15V3" />
                                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                            <path d="m7 10 5 5 5-5" />
                                        </svg>
                                        
                                        {t("download")}
                                    </VersionDownloadButton>
                                )}
                            </div>
                        </div>
                        
                        {hasChangelog && (
                            <div className="version-page__changelog content content--padding">
                                <h3>{t("changesTitle")}</h3>

                                <div className="markdown-body">
                                    <ReactMarkdown
                                        remarkPlugins={[remarkGfm]}
                                        components={{
                                            a: ({ href, children }) => {
                                                const safeHref = getSafeMarkdownHref(href);
                                                if(!safeHref) {
                                                    return <>{children}</>;
                                                }

                                                const isExternal = /^https?:\/\//i.test(safeHref);
                                                return (
                                                    <a href={safeHref} target={isExternal ? "_blank" : undefined} rel={isExternal ? "noopener noreferrer" : undefined}>
                                                        {children}
                                                    </a>
                                                );
                                            },
                                        }}
                                    >
                                        {version.changelog}
                                    </ReactMarkdown>
                                </div>
                            </div>
                        )}

                        {hasDependencies && (
                            <div className="version-page__dependencies content content--padding">
                                <h3>{t("versions.dependencies.title")}</h3>

                                <div style={{ display: "grid", gap: "10px" }}>
                                    {dependencies.map((dependency, index) => {
                                        const dependencyProject = dependency.project_slug ? { slug: dependency.project_slug, project_type: dependency.project_type } : null;
                                        const dependencyProjectPath = dependencyProject ? getProjectPath(dependencyProject) : null;
                                        const dependencyHref = dependencyProjectPath ? (dependency.version_id ? `${dependencyProjectPath}/version/${dependency.version_id}` : dependencyProjectPath) : null;
                                        const dependencyName = dependency.project_title || dependency.project_slug || dependency.project_id || t("versions.dependencies.unknownDependency");
                                        const dependencyType = formatDependencyType(dependency.dependency_type);
                                        const dependencyIconUrl = dependency.project_icon_url || "https://media.modifold.com/static/no-project-icon.svg";

                                        return (
                                            <div key={`${dependency.project_id || "none"}:${dependency.version_id || "none"}:${dependencyType}:${index}`} className="dependencies-content">
                                                <Link href={dependencyHref}>
                                                    <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: "0" }}>
                                                        <img
                                                            src={dependencyIconUrl}
                                                            alt=""
                                                            width="45"
                                                            height="45"
                                                            loading="lazy"
                                                            className="dependencies-content__icon"
                                                        />

                                                        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: "6px" }}>
                                                            <span style={{ fontSize: "18px", fontWeight: "500", lineHeight: "1" }}>{dependencyName}</span>

                                                            <span style={{ color: "var(--theme-color-text-secondary)", fontSize: "16px", lineHeight: "1" }}>{dependencyType}</span>
                                                        </div>
                                                    </div>
                                                </Link>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        <div className="version-page__files content content--padding">
                            <h3>{t("filesTitle")}</h3>

                            {version.files?.map((file, index) => (
                                <div key={index} className="file">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5z"></path><path d="M14 2v6h6"></path></svg>
                                    
                                    <span className="filename">
                                        {versionDisplayName}

                                        <span className="file-size">({formatBytes(file.size)})</span>
                                    </span>

                                    <VersionDownloadButton project={project} version={version} style={{ marginLeft: "auto", "--button-radius": "100px", "--button-padding": "0 16px" }} className="button button--size-m button--type-secondary button--active-transform button-with-icon" href={`${process.env.NEXT_PUBLIC_API_BASE}/projects/${project.slug}/versions/${version.id}/download`}>
                                        <svg className="masthead-stats__icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M12 15V3"></path>
                                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                            <path d="m7 10 5 5 5-5"></path>
                                        </svg>
                                        
                                        {t("download")}
                                    </VersionDownloadButton>
                                </div>
                            )) || <span>{t("noFiles")}</span>}
                        </div>

                        <div className="version-page__metadata content content--padding">
                            <h3>{t("versions.metadata.title")}</h3>

                            <div className="metadata-item">
                                <strong className="metadata-label">{t("versions.metadata.gameVersion")}</strong>

                                <div className="metadata-value">
                                    <VersionDisplay gameVersions={version.game_versions ? version.game_versions : []} />
                                </div>
                            </div>

                            <div className="metadata-item">
                                <strong className="metadata-label">{t("versions.metadata.platform")}</strong>

                                <div className="metadata-value">
                                    {version.loaders ? version.loaders.map((loader) => (
                                        <span key={loader} className="version__game-platform">
                                            {loader.trim()}
                                        </span>
                                    )) : <span>{t("versions.notSpecified")}</span>}
                                </div>
                            </div>

                            <div className="metadata-item">
                                <strong className="metadata-label">{t("versions.metadata.releaseChannel")}</strong>
                                <div className="metadata-value">
                                    {hasKnownReleaseChannel ? (
                                        <span className={`version__badge type--${releaseChannel}`}>
                                            <span className="circle"></span>
                                            {releaseChannelLabel}
                                        </span>
                                    ) : (
                                        <span>{releaseChannelLabel}</span>
                                    )}
                                </div>
                            </div>

                            <div className="metadata-item">
                                <strong className="metadata-label">{t("versions.metadata.downloads")}</strong>
                                <span className="metadata-value">{version.downloads}</span>
                            </div>

                            <div className="metadata-item">
                                <strong className="metadata-label">{t("versions.metadata.publicationDate")}</strong>
                                <span className="metadata-value">{formatDate(version.created_at)}</span>
                            </div>

                            <div className="metadata-item">
                                <strong className="metadata-label">{t("versions.metadata.versionId")}</strong>
                                <span className="version-page__version-id">{version.id}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <ProjectSidebar project={project} />
            </div>
        </>
    );
}

function formatBytes(bytes, decimals = 2) {
    if(bytes === 0) {
        return "0 Bytes";
    }

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}