"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { useAuth } from "../providers/AuthProvider";
import ProjectSidebar from "../project/ProjectSidebar";
import ProjectInlineGallerySlider from "../project/ProjectInlineGallerySlider";
import ProjectStatusBanner from "../ui/ProjectStatusBanner";
import { prepareProjectDescriptionMarkdown } from "@/utils/projectDescriptionContent";
import { projectDescriptionMarkdownComponents } from "@/utils/projectDescriptionMarkdownComponents";
import { getProjectPath } from "@/utils/projectRoutes";

const MODERATION_PROJECT_STATUSES = new Set(["queued", "pending", "in_review"]);

const getProjectStatusBannerType = (status) => {
    if(status === "draft") {
        return "draft";
    }

    if(MODERATION_PROJECT_STATUSES.has(status)) {
        return "moderation";
    }

    return null;
};

const hasProjectEditPermission = (permissions = {}) => Boolean(
    permissions.can_edit ||
    permissions.can_edit_details ||
    permissions.can_edit_body ||
    permissions.can_edit_gallery ||
    permissions.can_manage_versions
);

export default function ProjectPage({ project, authToken, showInlineGallery = false }) {
    const { user } = useAuth();
    const safeDescription = prepareProjectDescriptionMarkdown(project.description);
    const bannerType = getProjectStatusBannerType(project.status);
    const isProjectAuthor = Boolean(user?.id && Number(project.user_id) === Number(user.id));
    const showStatusBanner = Boolean(bannerType && (isProjectAuthor || hasProjectEditPermission(project.permissions)));
    const moderationSettingsHref = getProjectPath(project, "/settings/moderation");
    const structuredData = {
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        name: project.title,
        description: project.summary,
        applicationCategory: "Game",
        operatingSystem: "Hytale",
        author: {
            "@type": project.owner?.type === "organization" ? "Organization" : "Person",
            name: project.owner.username,
            url: `https://modifold.com${project.owner?.profile_url || `/user/${project.owner.slug}`}`,
        },
        datePublished: project.created_at,
        image: project.icon_url,
        url: `https://modifold.com${getProjectPath(project)}`,
    };

    return (
        <>
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />

            <div className="project__general">
                <div>
                    {showStatusBanner ? (
                        <ProjectStatusBanner type={bannerType} settingsHref={moderationSettingsHref} />
                    ) : null}

                    {showInlineGallery ? (
                        <ProjectInlineGallerySlider images={project?.gallery || []} projectTitle={project?.title || ""} trailerVideoId={project?.trailer_youtube_video_id || ""} />
                    ) : null}

                    <div className="content content--padding markdown-body">
                        <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]} components={projectDescriptionMarkdownComponents}>
                            {safeDescription}
                        </ReactMarkdown>
                    </div>
                </div>

                <ProjectSidebar project={project} authToken={authToken} />
            </div>
        </>
    );
}